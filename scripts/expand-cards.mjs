/**
 * Additive card catalog expand via compiled-ish dynamic import won't work for TS.
 * Inline: call Pokémon TCG API + Prisma upserts for priority sets.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const API = "https://api.pokemontcg.io/v2";

const SET_IDS = [
  "base1", "base2", "base3", "base4", "base5", "base6",
  "neo1", "neo2", "neo3", "neo4",
  "ex1", "ex3", "ex6", "ex9", "ex15",
  "dp1", "dp7", "pl1", "hgss1",
  "bw1", "bw7", "xy1", "xy8", "xy12",
  "sm1", "sm3", "sm8", "sm115", "sm12",
  "swsh1", "swsh3", "swsh45", "swsh7", "swsh9", "swsh10", "swsh11", "swsh12", "swsh12pt5",
  "sv1", "sv2", "sv3", "sv3pt5", "sv4", "sv4pt5", "sv5", "sv6", "sv6pt5", "sv7", "sv8", "sv8pt5",
];

const ICONICS = [
  "Pikachu","Charizard","Blastoise","Venusaur","Mewtwo","Mew","Gengar","Eevee",
  "Snorlax","Gyarados","Dragonite","Lucario","Greninja","Umbreon","Espeon","Sylveon",
  "Rayquaza","Lugia","Ho-Oh","Groudon","Kyogre","Dialga","Palkia","Giratina","Arceus",
  "Gardevoir","Garchomp","Tyranitar","Darkrai","Celebi","Suicune","Entei","Raikou",
  "Articuno","Zapdos","Moltres","Zacian","Miraidon","Koraidon","Alakazam","Machamp",
];

function headers() {
  const h = { Accept: "application/json" };
  if (process.env.POKEMONTCG_API_KEY) h["X-Api-Key"] = process.env.POKEMONTCG_API_KEY;
  return h;
}

function tierFromRarity(r) {
  const s = (r || "").toLowerCase();
  if (/secret|hyper|gold/.test(s)) return 10;
  if (/rainbow/.test(s)) return 9;
  if (/special illustration|illustration rare|shiny ultra/.test(s)) return 8;
  if (/vstar|vmax|ex\b|gx|v\b|ultra/.test(s)) return 6;
  if (/double rare|amazing/.test(s)) return 5;
  if (/holo|rare holo/.test(s)) return 4;
  if (/rare/.test(s)) return 3;
  if (/uncommon/.test(s)) return 2;
  return 1;
}

function supply(t) {
  if (t >= 10) return 50;
  if (t >= 8) return 120;
  if (t >= 6) return 400;
  if (t >= 4) return 800;
  if (t >= 3) return 1500;
  return 5000;
}

function price(card) {
  const prices = card.tcgplayer?.prices;
  if (prices) {
    for (const key of ["holofoil","reverseHolofoil","normal","1stEditionHolofoil","1stEditionNormal"]) {
      const p = prices[key];
      if (p?.market) return p.market;
      if (p?.mid) return p.mid;
    }
    for (const p of Object.values(prices)) {
      if (p?.market) return p.market;
      if (p?.mid) return p.mid;
    }
  }
  return card.cardmarket?.prices?.averageSellPrice || card.cardmarket?.prices?.trendPrice || 0;
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
    imageSmall: card.images?.small || `https://images.pokemontcg.io/${setId}/${number}.png`,
    imageLarge: card.images?.large || `https://images.pokemontcg.io/${setId}/${number}_hires.png`,
    marketPrice: price(card),
    releaseDate: card.set?.releaseDate || null,
    number,
    supertype: card.supertype || null,
    maxSupply: max,
    remaining: max,
  };
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

async function upsertCard(c) {
  await prisma.card.upsert({
    where: { id: c.id },
    create: c,
    update: {
      name: c.name,
      marketPrice: c.marketPrice,
      imageSmall: c.imageSmall,
      imageLarge: c.imageLarge,
      rarity: c.rarity,
      rarityTier: c.rarityTier,
      artist: c.artist,
      types: c.types,
      supertype: c.supertype,
    },
  });
}

async function upsertExpansion(s) {
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
      totalCards: s.printedTotal || s.total || 0,
      imageUrl: s.images?.symbol || null,
      logoUrl: s.images?.logo || null,
      active: true,
    },
  });
}

async function loadSet(setId) {
  const existing = await prisma.card.count({ where: { setId } });
  if (existing >= 40) {
    console.log(`  skip ${setId} (already ${existing})`);
    return existing;
  }
  try {
    const setJson = await fetchJson(`${API}/sets/${setId}`);
    if (setJson.data) await upsertExpansion(setJson.data);
  } catch {
    /* set meta optional */
  }

  let page = 1;
  let total = 0;
  while (page <= 6) {
    const json = await fetchJson(
      `${API}/cards?q=set.id:${setId}&pageSize=250&page=${page}`
    );
    if (!json.data?.length) break;
    for (const raw of json.data) {
      await upsertCard(mapCard(raw));
      total++;
    }
    if (json.data.length < 250) break;
    page++;
  }
  console.log(`  ${setId}: +${total} cards`);
  return total;
}

async function loadIconics() {
  let n = 0;
  for (const name of ICONICS) {
    try {
      const json = await fetchJson(
        `${API}/cards?q=name:"${encodeURIComponent(name)}" supertype:Pokémon&orderBy=-set.releaseDate&pageSize=6`
      );
      for (const raw of json.data || []) {
        await upsertCard(mapCard(raw));
        n++;
      }
    } catch {
      /* skip */
    }
  }
  console.log(`  iconics: ${n}`);
  return n;
}

async function main() {
  const before = await prisma.card.count();
  console.log(`Before: ${before} cards`);
  for (const id of SET_IDS) {
    try {
      await loadSet(id);
    } catch (e) {
      console.log(`  fail ${id}: ${e.message}`);
    }
  }
  try {
    await loadIconics();
  } catch (e) {
    console.log("iconics fail", e.message);
  }
  const after = await prisma.card.count();
  const expansions = await prisma.expansion.count();
  console.log(JSON.stringify({ before, after, added: after - before, expansions }, null, 2));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
