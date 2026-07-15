/**
 * Simulate packs with the live odds model → set packCost for ~80% win rate.
 * packCost = 20th percentile of pack totals (rounded).
 */
const { PrismaClient } = require("@prisma/client");

const BASE_WEIGHTS = {
  1: 45,
  2: 28,
  3: 12,
  4: 7,
  5: 3.5,
  6: 2.2,
  7: 1.2,
  8: 0.5,
  9: 0.25,
  10: 0.15,
};

function cleanPokemonName(raw) {
  if (!raw) return "";
  let name = String(raw).trim();
  name = name.replace(/[\u2018\u2019\u02BC\u0060]/g, "'");
  name = name.replace(
    /^(?:The\s+)?(?:Team\s+)?(?:Rocket|Magma|Aqua|Plasma|Galactic)'?s?\s+/i,
    ""
  );
  name = name.replace(
    /^(?:Lt\.?\s+)?[A-Za-z][A-Za-z.-]*(?:\s+[A-Za-z][A-Za-z.-]*)?'s\s+/i,
    ""
  );
  name = name.replace(/^[A-Za-z][A-Za-z.-]*'s\s+/i, "");
  name = name.replace(/^(?:Dark|Light)\s+/i, "");
  name = name.replace(
    /\s+(?:ex|EX|GX|VMAX|VSTAR|V-UNION|V|BREAK|LV\.?X|Prime|LEGEND|Radiant)\s*$/i,
    ""
  );
  return name.replace(/\s+/g, " ").trim() || raw.trim();
}

function speciesKey(name) {
  return cleanPokemonName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function cardWeight(card) {
  if (card.remaining <= 0 || card.maxSupply <= 0) return 0;
  const base = BASE_WEIGHTS[card.rarityTier] ?? 1;
  const scarcity = Math.pow(card.remaining / card.maxSupply, 1.35);
  const priceSoft = 1 / (1 + Math.max(0, card.marketPrice) / 40);
  return base * scarcity * (0.55 + 0.45 * priceSoft);
}

function slotFilter(card, slot) {
  const t = card.rarityTier;
  if (slot === "common") return t <= 2;
  if (slot === "uncommon") return t >= 1 && t <= 3;
  if (slot === "rare") return t >= 3 && t <= 4;
  if (slot === "chase") return t >= 3;
  return true;
}

function slotWeight(card, slot) {
  let w = cardWeight(card);
  if (!slotFilter(card, slot)) return 0;
  if (slot === "common") w *= card.rarityTier <= 1 ? 1.4 : 0.9;
  if (slot === "chase") {
    if (card.rarityTier >= 8) w *= 0.06;
    else if (card.rarityTier >= 6) w *= 0.18;
    else if (card.rarityTier >= 5) w *= 0.35;
    else if (card.rarityTier >= 4) w *= 0.85;
    if (card.marketPrice > 80) w *= 0.12;
    else if (card.marketPrice > 30) w *= 0.4;
  }
  if (slot === "rare" && card.marketPrice > 25) w *= 0.35;
  return w;
}

function weightedPick(items) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  if (total <= 0 || !items.length) return null;
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function buildSlots(packSize) {
  const slots = [];
  for (let i = 0; i < packSize; i++) {
    if (i === packSize - 1) {
      const roll = Math.random();
      if (roll < 0.28) slots.push("chase");
      else if (roll < 0.75) slots.push("rare");
      else slots.push("uncommon");
    } else if (i === packSize - 2)
      slots.push(Math.random() < 0.7 ? "uncommon" : "common");
    else if (i >= packSize - 4)
      slots.push(Math.random() < 0.55 ? "uncommon" : "common");
    else slots.push("common");
  }
  return slots;
}

function simulatePack(allCards, packSize) {
  const usedIds = new Set();
  const usedSpecies = new Set();
  const picked = [];
  const pokemon = allCards.filter(
    (c) =>
      (c.supertype && /pok/i.test(c.supertype)) ||
      (c.types && c.types !== "[]")
  );
  const pool = pokemon.length >= packSize ? pokemon : allCards;
  const slots = buildSlots(packSize);

  for (const slot of slots) {
    const build = (allowRepeat) =>
      pool
        .map((card) => {
          if (usedIds.has(card.id) || card.remaining <= 0) return null;
          const sp = speciesKey(card.name);
          if (!allowRepeat && sp && usedSpecies.has(sp)) return null;
          const weight = slotWeight(card, slot);
          if (weight <= 0) return null;
          return { card, weight };
        })
        .filter((x) => x && x.weight > 0);

    let choice = weightedPick(build(false));
    if (!choice) choice = weightedPick(build(true));
    if (!choice) {
      choice = weightedPick(
        pool
          .map((card) => {
            if (usedIds.has(card.id) || card.remaining <= 0) return null;
            return { card, weight: cardWeight(card) };
          })
          .filter((x) => x && x.weight > 0)
      );
    }
    if (!choice) break;
    picked.push(choice.card);
    usedIds.add(choice.card.id);
    const sp = speciesKey(choice.card.name);
    if (sp) usedSpecies.add(sp);
  }

  return picked.reduce((s, c) => s + (c.marketPrice || 0), 0);
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((p / 100) * (sorted.length - 1)))
  );
  return sorted[idx];
}

const prisma = new PrismaClient();
const SIMS = 500;

async function main() {
  const expansions = await prisma.expansion.findMany({
    where: { active: true },
  });
  const results = [];

  for (const exp of expansions) {
    const cards = await prisma.card.findMany({
      where: { setId: exp.id, remaining: { gt: 0 } },
    });

    // Skip thin catalogs — deactivate for pack menu cleanliness
    if (cards.length < 20) {
      await prisma.expansion.update({
        where: { id: exp.id },
        data: { active: false },
      });
      console.log("deactivated thin set", exp.id, cards.length);
      continue;
    }

    const packSize = exp.packSize || 10;
    const totals = [];
    for (let i = 0; i < SIMS; i++) {
      totals.push(simulatePack(cards, packSize));
    }
    totals.sort((a, b) => a - b);

    const p20 = percentile(totals, 20);
    const p50 = percentile(totals, 50);
    const mean = totals.reduce((a, b) => a + b, 0) / totals.length;

    // Target ~80% win rate: start at 20th percentile
    let packCost = Math.max(2, Math.round(p20 * 0.95));

    let winRate = totals.filter((t) => t >= packCost).length / totals.length;
    let guard = 0;
    while (winRate < 0.78 && packCost > 2 && guard < 80) {
      packCost -= 1;
      winRate = totals.filter((t) => t >= packCost).length / totals.length;
      guard++;
    }
    while (winRate > 0.85 && guard < 120) {
      packCost += 1;
      winRate = totals.filter((t) => t >= packCost).length / totals.length;
      guard++;
    }
    packCost = Math.max(2, Math.min(150, packCost));
    winRate = totals.filter((t) => t >= packCost).length / totals.length;

    await prisma.expansion.update({
      where: { id: exp.id },
      data: { packCost },
    });

    results.push({
      id: exp.id,
      name: exp.name,
      packCost,
      p20: +p20.toFixed(2),
      p50: +p50.toFixed(2),
      mean: +mean.toFixed(2),
      winRate: +(winRate * 100).toFixed(1),
      n: cards.length,
    });
  }

  // Demo user bankroll: enough for ~8–12 packs of mid cost
  const avgCost =
    results.reduce((s, r) => s + r.packCost, 0) / Math.max(1, results.length);
  const bankroll = Math.max(60, Math.round(avgCost * 10));
  await prisma.user.updateMany({
    where: { email: "demo@holovault.app" },
    data: { coins: bankroll },
  });

  results.sort((a, b) => b.packCost - a.packCost);
  console.log(JSON.stringify({ bankroll, results }, null, 2));
  console.log(
    "\nAvg win rate",
    (
      results.reduce((s, r) => s + r.winRate, 0) / Math.max(1, results.length)
    ).toFixed(1) + "%"
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
