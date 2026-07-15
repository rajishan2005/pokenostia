/**
 * Bulk-load a huge Pokémon TCG catalog into SQLite (additive, no wipe).
 * Fast path: createMany + skipDuplicates, parallel set fetches.
 *
 *   node --env-file=.env scripts/expand-all-cards.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const API = "https://api.pokemontcg.io/v2";
const PAGE = 250;
const CONCURRENCY = 3; // parallel set downloads
const BATCH = 80; // createMany batch size

function headers() {
  const h = { Accept: "application/json" };
  if (process.env.POKEMONTCG_API_KEY) {
    h["X-Api-Key"] = process.env.POKEMONTCG_API_KEY;
  }
  return h;
}

function tierFromRarity(r) {
  const s = (r || "").toLowerCase();
  if (/secret|hyper rare|gold/.test(s)) return 10;
  if (/rainbow/.test(s)) return 9;
  if (/special illustration|illustration rare|shiny ultra|mega hyper/.test(s))
    return 8;
  if (/vstar|vmax|\bgx\b|\bv\b|ultra rare|rare holo ex|rare ex/.test(s))
    return 6;
  if (/double rare|amazing|ace spec/.test(s)) return 5;
  if (/holo|rare holo/.test(s)) return 4;
  if (/rare/.test(s)) return 3;
  if (/uncommon/.test(s)) return 2;
  return 1;
}

function supply(t) {
  if (t >= 10) return 50;
  if (t >= 8) return 120;
  if (t >= 6) return 400;
  if (t >= 5) return 600;
  if (t >= 4) return 800;
  if (t >= 3) return 1500;
  return 5000;
}

function price(card) {
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

function mapCard(card) {
  const setId = card.set?.id || "unknown";
  const number = card.number || "1";
  const tier = tierFromRarity(card.rarity);
  const max = supply(tier);
  return {
    id: card.id,
    name: card.name,
    hp: card.hp || null,
    types: JSON.stringify(card.types || []),
    rarity: card.rarity || "Common",
    rarityTier: tier,
    setId,
    setName: card.set?.name || "Unknown",
    setSeries: card.set?.series || null,
    artist: card.artist || null,
    imageSmall:
      card.images?.small ||
      `https://images.pokemontcg.io/${setId}/${number}.png`,
    imageLarge:
      card.images?.large ||
      `https://images.pokemontcg.io/${setId}/${number}_hires.png`,
    marketPrice: price(card) || 0.5 + tier * 0.4,
    releaseDate: card.set?.releaseDate || null,
    number,
    supertype: card.supertype || null,
    maxSupply: max,
    remaining: max,
  };
}

async function fetchJson(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: headers() });
      if (res.status === 429 || res.status >= 500) {
        await sleep(800 * (i + 1));
        continue;
      }
      if (!res.ok) throw new Error(`${url} → ${res.status}`);
      return res.json();
    } catch (e) {
      if (i === retries - 1) throw e;
      await sleep(600 * (i + 1));
    }
  }
  throw new Error("fetch failed");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function insertCards(rows) {
  if (!rows.length) return 0;
  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    try {
      const res = await prisma.card.createMany({
        data: chunk,
        skipDuplicates: true,
      });
      written += res.count;
    } catch (e) {
      // fallback one-by-one if a bad row breaks the batch
      for (const c of chunk) {
        try {
          await prisma.card.create({ data: c });
          written++;
        } catch {
          /* duplicate or bad */
        }
      }
    }
  }
  return written;
}

async function upsertExpansion(s) {
  try {
    await prisma.expansion.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        name: s.name,
        series: s.series || null,
        releaseDate: s.releaseDate || null,
        totalCards: s.printedTotal || s.total || 0,
        packSize: s.id === "base1" ? 11 : 10,
        packCost: 10,
        imageUrl: s.images?.symbol || null,
        logoUrl: s.images?.logo || null,
        active: true,
      },
      update: {
        name: s.name,
        series: s.series || null,
        totalCards: s.printedTotal || s.total || 0,
        imageUrl: s.images?.symbol || null,
        logoUrl: s.images?.logo || null,
        active: true,
      },
    });
  } catch {
    /* ignore */
  }
}

async function loadSetCards(setId) {
  const all = [];
  let page = 1;
  while (page <= 8) {
    const json = await fetchJson(
      `${API}/cards?q=set.id:${encodeURIComponent(setId)}&pageSize=${PAGE}&page=${page}`
    );
    if (!json.data?.length) break;
    for (const raw of json.data) all.push(mapCard(raw));
    if (json.data.length < PAGE) break;
    page++;
  }
  return all;
}

async function poolMap(items, limit, fn) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return results;
}

async function main() {
  const before = await prisma.card.count();
  console.log(`Before: ${before} cards`);

  // 1) All sets from API
  console.log("Fetching set list…");
  let sets = [];
  try {
    const json = await fetchJson(`${API}/sets?orderBy=releaseDate&pageSize=250`);
    sets = json.data || [];
    // second page if needed
    if (sets.length >= 250) {
      const j2 = await fetchJson(
        `${API}/sets?orderBy=releaseDate&pageSize=250&page=2`
      );
      sets = sets.concat(j2.data || []);
    }
  } catch (e) {
    console.error("set list failed", e.message);
    process.exit(1);
  }
  console.log(`Sets available: ${sets.length}`);

  // Upsert expansions first
  for (const s of sets) {
    await upsertExpansion(s);
  }
  console.log("Expansions upserted.");

  // Prefer underfilled sets first so we grow fast
  const setCounts = await prisma.card.groupBy({
    by: ["setId"],
    _count: true,
  });
  const countMap = new Map(setCounts.map((x) => [x.setId, x._count]));

  const targets = sets
    .map((s) => ({
      id: s.id,
      name: s.name,
      have: countMap.get(s.id) || 0,
      total: s.printedTotal || s.total || 100,
    }))
    .filter((s) => s.have < Math.min(40, Math.floor(s.total * 0.5)))
    .sort((a, b) => a.have - b.have);

  console.log(`Sets to load/refill: ${targets.length}`);

  let added = 0;
  let done = 0;

  await poolMap(targets, CONCURRENCY, async (s) => {
    try {
      const cards = await loadSetCards(s.id);
      const n = await insertCards(cards);
      added += n;
      done++;
      console.log(
        `[${done}/${targets.length}] ${s.id} (${s.name}): fetched ${cards.length}, new ${n}`
      );
    } catch (e) {
      done++;
      console.log(
        `[${done}/${targets.length}] FAIL ${s.id}: ${e.message || e}`
      );
    }
  });

  // 2) Extra iconics sweep (more pages of popular names)
  console.log("Iconic species sweep…");
  const names = [
    "Pikachu","Charizard","Mewtwo","Mew","Lugia","Rayquaza","Umbreon","Espeon",
    "Gengar","Dragonite","Gardevoir","Garchomp","Lucario","Greninja","Arceus",
    "Dialga","Palkia","Giratina","Groudon","Kyogre","Zacian","Miraidon","Koraidon",
    "Blastoise","Venusaur","Tyranitar","Salamence","Metagross","Darkrai","Celebi",
    "Suicune","Entei","Raikou","Articuno","Zapdos","Moltres","Ho-Oh","Xerneas",
    "Yveltal","Reshiram","Zekrom","Kyurem","Necrozma","Eternatus","Calyrex",
    "Snorlax","Gyarados","Alakazam","Machamp","Lapras","Scizor","Absol","Jirachi",
    "Latios","Latias","Deoxys","Shaymin","Victini","Genesect","Magearna",
    "Sylveon","Leafeon","Glaceon","Vaporeon","Jolteon","Flareon","Eevee",
    "Infernape","Empoleon","Torterra","Decidueye","Incineroar","Cinderace",
    "Rillaboom","Intelleon","Primarina","Decidueye","Ogerpon","Terapagos",
  ];
  await poolMap(names, 4, async (name) => {
    try {
      const json = await fetchJson(
        `${API}/cards?q=name:"${encodeURIComponent(name)}"&pageSize=20&orderBy=-set.releaseDate`
      );
      const rows = (json.data || []).map(mapCard);
      const n = await insertCards(rows);
      if (n) console.log(`  ${name}: +${n}`);
    } catch {
      /* skip */
    }
  });

  const after = await prisma.card.count();
  const expansions = await prisma.expansion.count();
  const rarePlus = await prisma.card.count({ where: { rarityTier: { gte: 3 } } });
  const holoPlus = await prisma.card.count({ where: { rarityTier: { gte: 4 } } });
  console.log(
    JSON.stringify(
      {
        before,
        after,
        added: after - before,
        expansions,
        rarePlus,
        holoPlus,
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
