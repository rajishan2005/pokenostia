/**
 * Rebalance entire catalog:
 *  - Clean card names
 *  - Compress prices to game Pikadollars (no $500 packs)
 *  - Sim 5 packs per expansion → set packCost so ~70% profitable
 *  - Starting balance → 500
 *
 *   node --env-file=.env scripts/rebalance-economy.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const STARTING = 500;
const MAX_PRICE = 65;
const SIMS = 5;
const PACK_SIZE = 10;
const TARGET_WIN = 0.7;

const TIER_BAND = {
  1: [0.25, 0.55, 0.95],
  2: [0.7, 1.25, 2.0],
  3: [1.8, 3.2, 5.0],
  4: [4.0, 6.8, 11],
  5: [6.5, 10.5, 16],
  6: [9, 14.5, 22],
  7: [12, 19, 28],
  8: [16, 25, 38],
  9: [22, 33, 48],
  10: [28, 42, 65],
};

function cleanName(raw) {
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
  name = name.replace(/^(?:Dark|Light|Shining|Crystal)\s+/i, "");
  name = name.replace(/^M\s+/i, "Mega ");
  name = name.replace(/-(?:EX|GX|VMAX|VSTAR|V)\s*$/i, "");
  name = name.replace(
    /\s+(?:ex|EX|GX|VMAX|VSTAR|V-UNION|V|BREAK|LV\.?X|Prime|LEGEND|Radiant|δ|Delta)\s*$/i,
    ""
  );
  name = name.replace(/\s*\((?:Full Art|Secret|Promo|Holo)\)\s*$/i, "");
  return name.replace(/\s+/g, " ").trim() || String(raw).trim();
}

function hash01(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

function gamePrice(tier, rawPrice, name, seed) {
  const t = Math.min(10, Math.max(1, tier || 1));
  const [lo, mid, hi] = TIER_BAND[t] || TIER_BAND[1];
  // Ignore previously-compressed game prices as "raw" — use tier mid + hash
  // so re-runs don't keep crushing values. Slight spread from seed only.
  const h = hash01(seed || name || String(t));
  let price = lo + (hi - lo) * (0.25 + h * 0.55);
  if (
    /charizard|mewtwo|lugia|umbreon|rayquaza|pikachu|gengar|mew\b|arceus|giratina|miraidon|koraidon/i.test(
      name || ""
    )
  ) {
    price = mid + (hi - mid) * (0.55 + h * 0.45);
  }
  // If raw still looks like real-world TCG ($50+), push toward upper band
  const raw = Math.max(0, rawPrice || 0);
  if (raw >= 50) price = mid + (hi - mid) * (0.6 + h * 0.4);
  else if (raw >= 15 && raw < 50 && t >= 3) price = Math.max(price, mid);

  price = Math.min(MAX_PRICE, Math.max(lo, price));
  return Math.round(price * 100) / 100;
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function baseWeight(tier) {
  const w = {
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
  return w[tier] ?? 1;
}

function cardWeight(card, rand) {
  if (card.remaining <= 0) return 0;
  const scarcity = Math.pow(
    Math.max(0.05, card.remaining / Math.max(1, card.maxSupply)),
    1.35
  );
  const priceSoft = 1 / (1 + Math.max(0, card.marketPrice) / 12);
  let w = baseWeight(card.rarityTier) * scarcity * (0.5 + 0.5 * priceSoft);
  if (card.marketPrice > 12) w *= 0.5;
  if (card.marketPrice > 22) w *= 0.45;
  if (card.marketPrice > 35) w *= 0.4;
  w *= 0.65 + rand() * 0.7;
  return w;
}

function weightedPick(items, rand) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  if (total <= 0 || !items.length) return null;
  let r = rand() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function buildSlots(packSize, rand) {
  const slots = Array.from({ length: packSize }, () =>
    rand() < 0.55 ? "common" : "uncommon"
  );
  const spicy = rand() < 0.42;
  const rareCount = spicy
    ? 1 + (rand() < 0.55 ? 1 : 0) + (rand() < 0.25 ? 1 : 0)
    : rand() < 0.55
      ? 1
      : rand() < 0.35
        ? 1
        : 0;
  const used = new Set();
  for (let n = 0; n < rareCount; n++) {
    let pick = Math.floor(rand() * packSize);
    let guard = 0;
    while (used.has(pick) && guard++ < 20) pick = Math.floor(rand() * packSize);
    used.add(pick);
    slots[pick] = spicy
      ? rand() < 0.5
        ? "chase"
        : "rare"
      : rand() < 0.28
        ? "chase"
        : "rare";
  }
  return slots;
}

function slotOk(card, slot) {
  const t = card.rarityTier;
  if (slot === "common") return t <= 2;
  if (slot === "uncommon") return t >= 1 && t <= 3;
  if (slot === "rare") return t >= 3 && t <= 4;
  if (slot === "chase") return t >= 3;
  return true;
}

function simPack(pool, packSize, seed) {
  const rand = mulberry32(seed);
  const working = pool.map((c) => ({ ...c }));
  const used = new Set();
  const slots = buildSlots(packSize, rand);
  const prices = working.map((c) => c.marketPrice).sort((a, b) => a - b);
  const p70 = prices[Math.floor(prices.length * 0.7)] ?? 4;
  const picked = [];

  for (const slot of slots) {
    const jackpot = slot === "chase" && rand() < 0.18;
    const ceiling =
      slot === "chase"
        ? jackpot
          ? null
          : Math.max(8, p70 * 1.5)
        : slot === "rare"
          ? Math.max(5, p70 * 1.2)
          : null;

    const cands = working
      .map((card) => {
        if (used.has(card.id) || card.remaining <= 0) return null;
        if (!slotOk(card, slot)) return null;
        if (
          ceiling != null &&
          card.marketPrice > ceiling &&
          card.rarityTier < 6
        )
          return null;
        const w = cardWeight(card, rand);
        if (w <= 0) return null;
        return { card, weight: w };
      })
      .filter(Boolean);

    let choice = weightedPick(cands, rand);
    if (!choice) {
      const any = working
        .filter((c) => !used.has(c.id) && c.remaining > 0)
        .map((card) => ({ card, weight: cardWeight(card, rand) }))
        .filter((x) => x.weight > 0);
      choice = weightedPick(any, rand);
    }
    if (!choice) break;
    picked.push(choice.card);
    used.add(choice.card.id);
  }

  return picked.reduce((s, c) => s + c.marketPrice, 0);
}

function costFromSims(totals) {
  const sorted = [...totals].sort((a, b) => a - b);
  const avg = totals.reduce((s, v) => s + v, 0) / totals.length;
  // Start at $10, nudge so ~70% of the 5 sims beat the cost
  let cost = 10;
  let wins = totals.filter((v) => v > cost).length;
  let winRate = wins / totals.length;

  // Too few wins → cheaper packs (down to $7)
  while (winRate < TARGET_WIN - 0.05 && cost > 7) {
    cost -= 1;
    wins = totals.filter((v) => v > cost).length;
    winRate = wins / totals.length;
  }
  // Too many wins / jackpots → slightly pricier (up to $12)
  while (winRate > 0.9 && cost < 12) {
    cost += 1;
    wins = totals.filter((v) => v > cost).length;
    winRate = wins / totals.length;
  }
  // Prefer $10 when avg pack value is healthy
  if (avg >= 11 && avg <= 18 && winRate >= 0.55) {
    cost = 10;
    wins = totals.filter((v) => v > cost).length;
    winRate = wins / totals.length;
  }

  return {
    cost,
    avg: Math.round(avg * 100) / 100,
    winRate: Math.round(winRate * 1000) / 10,
  };
}

async function main() {
  console.log("=== HoloVault economy rebalance ===");

  // 1) Reprice + rename every card
  const cards = await prisma.card.findMany({
    select: {
      id: true,
      name: true,
      rarityTier: true,
      marketPrice: true,
      setId: true,
      remaining: true,
      maxSupply: true,
    },
  });
  console.log(`Cards: ${cards.length}`);

  let renamed = 0;
  let repriced = 0;
  const BATCH = 100;
  for (let i = 0; i < cards.length; i += BATCH) {
    const chunk = cards.slice(i, i + BATCH);
    await Promise.all(
      chunk.map(async (c) => {
        const name = cleanName(c.name);
        // Use previous price as "raw" rank signal before we overwrote — for first run
        // high prices compress down; already-low stay mid-band
        const price = gamePrice(c.rarityTier, c.marketPrice, name, c.id);
        const data = {};
        if (name !== c.name) {
          data.name = name;
          renamed++;
        }
        if (Math.abs(price - c.marketPrice) > 0.001) {
          data.marketPrice = price;
          repriced++;
        }
        if (Object.keys(data).length) {
          await prisma.card.update({ where: { id: c.id }, data });
          c.name = name;
          c.marketPrice = price;
        }
      })
    );
    if ((i / BATCH) % 20 === 0) {
      console.log(`  priced ${Math.min(i + BATCH, cards.length)}/${cards.length}`);
    }
  }
  console.log(`Renamed ${renamed}, repriced ${repriced}`);

  // Hard cap leftovers
  const capped = await prisma.card.updateMany({
    where: { marketPrice: { gt: MAX_PRICE } },
    data: { marketPrice: MAX_PRICE },
  });
  console.log(`Hard-capped ${capped.count} cards at $${MAX_PRICE}`);

  // 2) Load pools + sim 5 packs per expansion with cards
  const expansions = await prisma.expansion.findMany({
    where: { active: true },
  });
  console.log(`Expansions: ${expansions.length}`);

  // Global filler pool
  const globalPool = await prisma.card.findMany({
    where: { remaining: { gt: 0 } },
    select: {
      id: true,
      name: true,
      rarityTier: true,
      marketPrice: true,
      remaining: true,
      maxSupply: true,
      setId: true,
    },
    take: 4000,
  });

  const setReports = [];
  let globalTotals = [];

  for (const exp of expansions) {
    let pool = await prisma.card.findMany({
      where: { setId: exp.id, remaining: { gt: 0 } },
      select: {
        id: true,
        name: true,
        rarityTier: true,
        marketPrice: true,
        remaining: true,
        maxSupply: true,
        setId: true,
      },
    });
    if (pool.length < 40) {
      const seen = new Set(pool.map((c) => c.id));
      for (const c of globalPool) {
        if (!seen.has(c.id)) {
          pool.push(c);
          seen.add(c.id);
        }
        if (pool.length >= 400) break;
      }
    }
    if (pool.length < 10) {
      await prisma.expansion.update({
        where: { id: exp.id },
        data: { packSize: PACK_SIZE, packCost: 10 },
      });
      continue;
    }

    const totals = [];
    for (let s = 0; s < SIMS; s++) {
      const v = simPack(pool, PACK_SIZE, (exp.id.charCodeAt(0) || 1) * 1000 + s * 97 + pool.length);
      totals.push(Math.round(v * 100) / 100);
    }
    const { cost, avg, winRate } = costFromSims(totals);
    await prisma.expansion.update({
      where: { id: exp.id },
      data: { packSize: PACK_SIZE, packCost: cost },
    });
    setReports.push({
      id: exp.id,
      name: exp.name,
      sims: totals,
      avg,
      cost,
      winRate,
    });
    globalTotals = globalTotals.concat(totals);
  }

  // 3) Starting balance
  const demo = await prisma.user.updateMany({
    where: { email: "demo@holovault.app" },
    data: { coins: STARTING },
  });
  // Top up real players under 500 (not bots)
  const topped = await prisma.user.updateMany({
    where: {
      coins: { lt: STARTING },
      NOT: { email: { endsWith: "@bot.holovault.local" } },
    },
    data: { coins: STARTING },
  });

  // Summary stats
  const priceStats = await prisma.card.aggregate({
    _avg: { marketPrice: true },
    _max: { marketPrice: true },
    _min: { marketPrice: true },
  });
  const over50 = await prisma.card.count({ where: { marketPrice: { gte: 50 } } });
  const over20 = await prisma.card.count({ where: { marketPrice: { gte: 20 } } });

  const gAvg =
    globalTotals.reduce((s, v) => s + v, 0) / Math.max(1, globalTotals.length);
  // Assume $10 average cost for global win rate snapshot
  const gWins = globalTotals.filter((v) => v > 10).length;
  const gWin = globalTotals.length ? gWins / globalTotals.length : 0;

  console.log("\n=== Sample set sims (5 packs each) ===");
  for (const r of setReports.slice(0, 15)) {
    console.log(
      `${r.id.padEnd(12)} cost=$${r.cost}  avg=$${r.avg}  win~${r.winRate}%  packs=[${r.sims.join(", ")}]`
    );
  }
  if (setReports.length > 15) {
    console.log(`… +${setReports.length - 15} more sets`);
  }

  console.log(
    JSON.stringify(
      {
        cards: cards.length,
        renamed,
        repriced,
        capped: capped.count,
        setsTuned: setReports.length,
        avgPackValue: Math.round(gAvg * 100) / 100,
        winRateAt10: Math.round(gWin * 1000) / 10,
        priceAvg: Math.round((priceStats._avg.marketPrice || 0) * 100) / 100,
        priceMax: priceStats._max.marketPrice,
        priceMin: priceStats._min.marketPrice,
        cardsOver20: over20,
        cardsOver50: over50,
        demoReset: demo.count,
        playersToppedTo500: topped.count,
        startingBalance: STARTING,
      },
      null,
      2
    )
  );

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
