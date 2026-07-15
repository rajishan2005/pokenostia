/**
 * Restore real TCG market prices + classic pack costs (undo economy rebalance).
 *   node --env-file=.env scripts/restore-prices.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const API = "https://api.pokemontcg.io/v2";

function headers() {
  const h = { Accept: "application/json" };
  if (process.env.POKEMONTCG_API_KEY) {
    h["X-Api-Key"] = process.env.POKEMONTCG_API_KEY;
  }
  return h;
}

function packPriceForSet(setId, series) {
  if (setId === "base1") return 8;
  if (setId === "base2" || setId === "base3") return 6;
  if (setId === "base4" || setId === "base5") return 7;
  if (setId === "neo1" || setId?.startsWith("gym")) return 6;
  if (setId === "ex1" || setId?.startsWith("xy")) return 5;
  if (setId === "sv3pt5") return 7;
  if (series?.toLowerCase().includes("base")) return 7;
  if (series?.toLowerCase().includes("sword")) return 5;
  if (series?.toLowerCase().includes("scarlet")) return 5;
  return 5;
}

function extractPrice(card) {
  const prices = card.tcgplayer?.prices;
  if (prices) {
    for (const key of [
      "holofoil",
      "reverseHolofoil",
      "normal",
      "1stEditionHolofoil",
      "1stEditionNormal",
    ]) {
      const p = prices[key];
      if (p?.market) return p.market;
      if (p?.mid) return p.mid;
    }
    for (const p of Object.values(prices)) {
      if (p?.market) return p.market;
      if (p?.mid) return p.mid;
    }
  }
  return (
    card.cardmarket?.prices?.averageSellPrice ||
    card.cardmarket?.prices?.trendPrice ||
    0
  );
}

async function fetchJson(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: headers() });
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 700 * (i + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`${url} → ${res.status}`);
      return res.json();
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
}

async function main() {
  console.log("Restoring real TCG prices…");

  // Distinct set ids in DB
  const sets = await prisma.card.groupBy({ by: ["setId"], _count: true });
  console.log(`Sets in catalog: ${sets.length}`);

  let updated = 0;
  let failed = 0;

  for (const { setId, _count } of sets) {
    if (!setId || setId === "unknown") continue;
    try {
      let page = 1;
      let setUpdated = 0;
      while (page <= 8) {
        const json = await fetchJson(
          `${API}/cards?q=set.id:${encodeURIComponent(setId)}&pageSize=250&page=${page}`
        );
        if (!json.data?.length) break;
        for (const raw of json.data) {
          const price = extractPrice(raw);
          if (!(price > 0)) continue;
          try {
            await prisma.card.update({
              where: { id: raw.id },
              data: { marketPrice: price },
            });
            updated++;
            setUpdated++;
          } catch {
            /* card not in local db */
          }
        }
        if (json.data.length < 250) break;
        page++;
      }
      console.log(`  ${setId}: +${setUpdated} prices (${_count} local)`);
    } catch (e) {
      failed++;
      console.log(`  FAIL ${setId}: ${e.message}`);
    }
  }

  // Restore pack costs
  const expansions = await prisma.expansion.findMany();
  for (const e of expansions) {
    const cost = packPriceForSet(e.id, e.series);
    await prisma.expansion.update({
      where: { id: e.id },
      data: { packCost: cost, packSize: 10 },
    });
  }
  console.log(`Pack costs restored for ${expansions.length} expansions`);

  // Re-seed mega grails + bumps
  const { seedMegaValueCards } = await import("../src/lib/seed-bots.ts").catch(
    () => ({ seedMegaValueCards: null })
  );
  // Inline grail restore (can't easily import TS)
  const megas = [
    ["base1-4-grail", 4200],
    ["base1-2-grail", 1100],
    ["base1-15-grail", 1050],
    ["base1-10-grail", 1250],
    ["neo1-9-grail", 2800],
    ["neo1-8-grail", 1900],
    ["ex1-101-grail", 1600],
    ["swsh12-215-grail", 2100],
    ["sv3pt5-198-grail", 3200],
    ["sv3pt5-199-grail", 1400],
    ["swsh7-215-grail", 4500],
    ["swsh7-188-grail", 2200],
    ["base4-4-grail", 2400],
  ];
  for (const [id, price] of megas) {
    try {
      await prisma.card.update({
        where: { id },
        data: { marketPrice: price },
      });
      updated++;
    } catch {
      /* missing */
    }
  }

  // Soft bump high-tier cards under 1k (like old seed)
  const chase = await prisma.card.findMany({
    where: { rarityTier: { gte: 5 }, marketPrice: { gte: 25, lt: 1000 } },
    take: 80,
    orderBy: { marketPrice: "desc" },
  });
  let boosted = 0;
  for (const c of chase) {
    if (Math.random() < 0.35) continue;
    const bump = 1000 + Math.floor(Math.random() * 3200);
    await prisma.card.update({
      where: { id: c.id },
      data: { marketPrice: Math.max(c.marketPrice, bump) },
    });
    boosted++;
  }

  const stats = await prisma.card.aggregate({
    _avg: { marketPrice: true },
    _max: { marketPrice: true },
  });
  const over1k = await prisma.card.count({
    where: { marketPrice: { gte: 1000 } },
  });

  console.log(
    JSON.stringify(
      {
        pricesUpdated: updated,
        setFails: failed,
        grailBoosted: boosted,
        priceAvg: Math.round((stats._avg.marketPrice || 0) * 100) / 100,
        priceMax: stats._max.marketPrice,
        cardsOver1k: over1k,
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
