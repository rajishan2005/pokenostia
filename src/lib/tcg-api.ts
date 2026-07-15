import { cacheGetOrSet } from "./cache";
import { getRarityTier, maxSupplyForTier } from "./rarity";
import { cleanPokemonName } from "./pokemon-name";
import { packPriceForSet } from "./currency";
import type { CardData, ExpansionData } from "@/types";

const API = "https://api.pokemontcg.io/v2";

/** Classic + nostalgic + modern sets full of real Pokémon. */
export const PRIORITY_SET_IDS = [
  "base1", // Base Set — Charizard, Pikachu
  "base2", // Jungle
  "base3", // Fossil
  "base4", // Base Set 2
  "base5", // Team Rocket (names cleaned to drop "Dark ")
  "base6", // Legendary Collection
  "neo1", // Neo Genesis
  "neo2", // Neo Discovery
  "neo3", // Neo Revelation
  "neo4", // Neo Destiny
  "ex1", // Ruby & Sapphire
  "ex3", // Dragon
  "ex6", // FireRed & LeafGreen
  "ex9", // Emerald
  "ex15", // Dragon Frontiers
  "dp1", // Diamond & Pearl
  "dp7", // Stormfront
  "pl1", // Platinum
  "hgss1", // HeartGold SoulSilver
  "bw1", // Black & White
  "bw7", // Boundaries Crossed
  "xy1", // XY
  "xy8", // Roaring Skies
  "xy12", // Evolutions (nostalgia remake)
  "sm1", // Sun & Moon
  "sm3", // Burning Shadows
  "sm8", // Lost Thunder
  "sm115", // Hidden Fates
  "sm12", // Cosmic Eclipse
  "swsh1", // Sword & Shield
  "swsh3", // Darkness Ablaze
  "swsh45", // Shining Fates
  "swsh7", // Evolving Skies
  "swsh9", // Brilliant Stars
  "swsh10", // Astral Radiance
  "swsh11", // Lost Origin
  "swsh12", // Silver Tempest
  "swsh12pt5", // Crown Zenith
  "sv1", // Scarlet & Violet
  "sv2", // Paldea Evolved
  "sv3", // Obsidian Flames
  "sv3pt5", // 151
  "sv4", // Paradox Rift
  "sv4pt5", // Paldean Fates
  "sv5", // Temporal Forces
  "sv6", // Twilight Masquerade
  "sv6pt5", // Shrouded Fable
  "sv7", // Stellar Crown
  "sv8", // Surging Sparks
  "sv8pt5", // Prismatic Evolutions
  // Note: gym1/gym2 intentionally omitted — cards are "Brock's X" / "Erika's Y"
] as const;

function headers(): HeadersInit {
  const h: HeadersInit = { Accept: "application/json" };
  if (process.env.POKEMONTCG_API_KEY) {
    h["X-Api-Key"] = process.env.POKEMONTCG_API_KEY;
  }
  return h;
}

interface ApiCard {
  id: string;
  name: string;
  hp?: string;
  types?: string[];
  rarity?: string;
  artist?: string;
  number?: string;
  supertype?: string;
  images?: { small?: string; large?: string };
  set?: {
    id: string;
    name: string;
    series?: string;
    releaseDate?: string;
    images?: { symbol?: string; logo?: string };
  };
  tcgplayer?: {
    prices?: Record<string, { market?: number; mid?: number; low?: number }>;
  };
  cardmarket?: {
    prices?: { averageSellPrice?: number; trendPrice?: number };
  };
}

interface ApiSet {
  id: string;
  name: string;
  series?: string;
  releaseDate?: string;
  total?: number;
  printedTotal?: number;
  images?: { symbol?: string; logo?: string };
}

function extractPrice(card: ApiCard): number {
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
    card.cardmarket?.prices?.averageSellPrice ??
    card.cardmarket?.prices?.trendPrice ??
    0
  );
}

function imageUrls(setId: string, number: string, images?: ApiCard["images"]) {
  const small =
    images?.small ||
    `https://images.pokemontcg.io/${setId}/${number}.png`;
  const large =
    images?.large ||
    `https://images.pokemontcg.io/${setId}/${number}_hires.png`;
  return { small, large };
}

export function mapApiCard(card: ApiCard): CardData {
  const tier = getRarityTier(card.rarity);
  const max = maxSupplyForTier(tier);
  const setId = card.set?.id ?? "unknown";
  const number = card.number ?? "1";
  const imgs = imageUrls(setId, number, card.images);
  // Prefer plain species names over "Erika's Gengar" / "Dark Charizard"
  const isPokemon =
    !card.supertype ||
    /pok/i.test(card.supertype) ||
    (card.types && card.types.length > 0);
  const displayName = isPokemon ? cleanPokemonName(card.name) : card.name;
  return {
    id: card.id,
    name: displayName,
    hp: card.hp ?? null,
    types: card.types ?? [],
    rarity: card.rarity ?? "Common",
    rarityTier: tier,
    setId,
    setName: card.set?.name ?? "Unknown Set",
    setSeries: card.set?.series ?? null,
    artist: card.artist ?? null,
    imageSmall: imgs.small,
    imageLarge: imgs.large,
    marketPrice: extractPrice(card),
    releaseDate: card.set?.releaseDate ?? null,
    number,
    supertype: card.supertype ?? null,
    maxSupply: max,
    remaining: max,
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: headers(),
    // no next.revalidate in non-Next fetch contexts during seed
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

export async function fetchSets(): Promise<ExpansionData[]> {
  return cacheGetOrSet("tcg:sets", 3600, async () => {
    try {
      const json = await fetchJson<{ data: ApiSet[] }>(
        `${API}/sets?orderBy=-releaseDate&pageSize=250`
      );
      return json.data.map((s) => ({
        id: s.id,
        name: s.name,
        series: s.series ?? null,
        releaseDate: s.releaseDate ?? null,
        totalCards: s.printedTotal ?? s.total ?? 0,
        packSize: 10,
        packCost: packPriceForSet(s.id, s.series),
        imageUrl: s.images?.symbol ?? null,
        logoUrl: s.images?.logo ?? null,
        active: true,
      }));
    } catch {
      return FALLBACK_EXPANSIONS;
    }
  });
}

export async function fetchSetById(setId: string): Promise<ExpansionData | null> {
  try {
    const json = await fetchJson<{ data: ApiSet }>(`${API}/sets/${setId}`);
    const s = json.data;
    return {
      id: s.id,
      name: s.name,
      series: s.series ?? null,
      releaseDate: s.releaseDate ?? null,
      totalCards: s.printedTotal ?? s.total ?? 0,
      packSize: 10,
      packCost: packPriceForSet(setId, s.series),
      imageUrl: s.images?.symbol ?? null,
      logoUrl: s.images?.logo ?? null,
      active: true,
    };
  } catch {
    return FALLBACK_EXPANSIONS.find((e) => e.id === setId) ?? null;
  }
}

/** Paginate through every card in a set (real Pokémon TCG data). */
export async function fetchCardsBySet(setId: string): Promise<CardData[]> {
  return cacheGetOrSet(`tcg:set:full:${setId}`, 1800, async () => {
    const all: CardData[] = [];
    let page = 1;
    const pageSize = 250;
    try {
      while (page <= 4) {
        const json = await fetchJson<{
          data: ApiCard[];
          totalCount?: number;
          page?: number;
          pageSize?: number;
          count?: number;
        }>(
          `${API}/cards?q=set.id:${setId}&pageSize=${pageSize}&page=${page}`
        );
        if (!json.data?.length) break;
        all.push(...json.data.map(mapApiCard));
        if (json.data.length < pageSize) break;
        page++;
      }
      if (all.length === 0) {
        return FALLBACK_CARDS.filter((c) => c.setId === setId);
      }
      return all;
    } catch {
      return FALLBACK_CARDS.filter((c) => c.setId === setId);
    }
  });
}

/** Iconic real Pokémon by name for featured UI / seed enrichment. */
export async function fetchIconicPokemon(): Promise<CardData[]> {
  return cacheGetOrSet("tcg:iconic:v2", 3600, async () => {
    const names = [
      "Pikachu",
      "Charizard",
      "Blastoise",
      "Venusaur",
      "Mewtwo",
      "Mew",
      "Gengar",
      "Eevee",
      "Snorlax",
      "Gyarados",
      "Dragonite",
      "Lucario",
      "Greninja",
      "Umbreon",
      "Espeon",
      "Sylveon",
      "Rayquaza",
      "Lugia",
      "Ho-Oh",
      "Groudon",
      "Kyogre",
      "Dialga",
      "Palkia",
      "Giratina",
      "Arceus",
      "Reshiram",
      "Zekrom",
      "Xerneas",
      "Yveltal",
      "Zacian",
      "Zamazenta",
      "Miraidon",
      "Koraidon",
      "Tyranitar",
      "Gardevoir",
      "Metagross",
      "Salamence",
      "Garchomp",
      "Infernape",
      "Torterra",
      "Empoleon",
      "Decidueye",
      "Incineroar",
      "Cinderace",
      "Rillaboom",
      "Alakazam",
      "Machamp",
      "Lapras",
      "Jolteon",
      "Vaporeon",
      "Flareon",
      "Scizor",
      "Tyranitar",
      "Absol",
      "Darkrai",
      "Celebi",
      "Jirachi",
      "Deoxys",
      "Latios",
      "Latias",
      "Suicune",
      "Entei",
      "Raikou",
      "Articuno",
      "Zapdos",
      "Moltres",
    ];
    const results: CardData[] = [];
    for (const name of names) {
      try {
        const json = await fetchJson<{ data: ApiCard[] }>(
          `${API}/cards?q=name:"${encodeURIComponent(name)}" supertype:Pokémon&orderBy=-set.releaseDate&pageSize=5`
        );
        results.push(...json.data.map(mapApiCard));
      } catch {
        /* skip name */
      }
    }
    if (results.length < 8) {
      return FALLBACK_CARDS.filter((c) =>
        names.some((n) => c.name.includes(n))
      );
    }
    return results;
  });
}

/**
 * Load extra modern/classic sets into the catalog (additive, no wipe).
 * Returns how many new cards were written.
 */
export async function fetchManySets(
  setIds: string[],
  onSet?: (setId: string, count: number) => void
): Promise<CardData[]> {
  const all: CardData[] = [];
  for (const setId of setIds) {
    try {
      const cards = await fetchCardsBySet(setId);
      all.push(...cards);
      onSet?.(setId, cards.length);
    } catch {
      onSet?.(setId, 0);
    }
  }
  return all;
}

export async function searchCards(query: string): Promise<CardData[]> {
  const q = query.trim();
  if (!q) return [];
  return cacheGetOrSet(`tcg:search:${q.toLowerCase()}`, 600, async () => {
    try {
      const json = await fetchJson<{ data: ApiCard[] }>(
        `${API}/cards?q=name:"${encodeURIComponent(q)}"*&pageSize=40`
      );
      return json.data.map(mapApiCard);
    } catch {
      return FALLBACK_CARDS.filter((c) =>
        c.name.toLowerCase().includes(q.toLowerCase())
      );
    }
  });
}

export async function fetchTrendingCards(): Promise<CardData[]> {
  return cacheGetOrSet("tcg:trending", 900, async () => {
    try {
      const json = await fetchJson<{ data: ApiCard[] }>(
        `${API}/cards?q=supertype:Pokémon (rarity:"Rare Holo" OR rarity:"Rare Ultra" OR rarity:"Rare Secret" OR rarity:"Illustration Rare")&orderBy=-set.releaseDate&pageSize=24`
      );
      return json.data.map(mapApiCard);
    } catch {
      return [...FALLBACK_CARDS].sort((a, b) => b.marketPrice - a.marketPrice);
    }
  });
}

/** Curated fallback so the app works offline */
export const FALLBACK_EXPANSIONS: ExpansionData[] = [
  {
    id: "base1",
    name: "Base Set",
    series: "Base",
    releaseDate: "1999/01/09",
    totalCards: 102,
    packSize: 10,
    packCost: 8,
    imageUrl: "https://images.pokemontcg.io/base1/symbol.png",
    logoUrl: "https://images.pokemontcg.io/base1/logo.png",
    active: true,
  },
  {
    id: "base2",
    name: "Jungle",
    series: "Base",
    releaseDate: "1999/06/16",
    totalCards: 64,
    packSize: 10,
    packCost: 6,
    imageUrl: "https://images.pokemontcg.io/base2/symbol.png",
    logoUrl: "https://images.pokemontcg.io/base2/logo.png",
    active: true,
  },
  {
    id: "base3",
    name: "Fossil",
    series: "Base",
    releaseDate: "1999/10/10",
    totalCards: 62,
    packSize: 10,
    packCost: 6,
    imageUrl: "https://images.pokemontcg.io/base3/symbol.png",
    logoUrl: "https://images.pokemontcg.io/base3/logo.png",
    active: true,
  },
  {
    id: "xy12",
    name: "Evolutions",
    series: "XY",
    releaseDate: "2016/11/02",
    totalCards: 113,
    packSize: 10,
    packCost: 5,
    imageUrl: "https://images.pokemontcg.io/xy12/symbol.png",
    logoUrl: "https://images.pokemontcg.io/xy12/logo.png",
    active: true,
  },
  {
    id: "sv3pt5",
    name: "151",
    series: "Scarlet & Violet",
    releaseDate: "2023/09/22",
    totalCards: 207,
    packSize: 10,
    packCost: 7,
    imageUrl: "https://images.pokemontcg.io/sv3pt5/symbol.png",
    logoUrl: "https://images.pokemontcg.io/sv3pt5/logo.png",
    active: true,
  },
  {
    id: "swsh7",
    name: "Evolving Skies",
    series: "Sword & Shield",
    releaseDate: "2021/08/27",
    totalCards: 237,
    packSize: 10,
    packCost: 5,
    imageUrl: "https://images.pokemontcg.io/swsh7/symbol.png",
    logoUrl: "https://images.pokemontcg.io/swsh7/logo.png",
    active: true,
  },
  {
    id: "sv4",
    name: "Paradox Rift",
    series: "Scarlet & Violet",
    releaseDate: "2023/11/03",
    totalCards: 266,
    packSize: 10,
    packCost: 5,
    imageUrl: "https://images.pokemontcg.io/sv4/symbol.png",
    logoUrl: "https://images.pokemontcg.io/sv4/logo.png",
    active: true,
  },
  {
    id: "swsh12",
    name: "Silver Tempest",
    series: "Sword & Shield",
    releaseDate: "2022/11/11",
    totalCards: 245,
    packSize: 10,
    packCost: 5,
    imageUrl: "https://images.pokemontcg.io/swsh12/symbol.png",
    logoUrl: "https://images.pokemontcg.io/swsh12/logo.png",
    active: true,
  },
];

function makeFallback(
  setId: string,
  number: string,
  name: string,
  rarity: string,
  tier: number,
  setName: string,
  price: number,
  types: string[],
  artist: string,
  hp = "60"
): CardData {
  const max = maxSupplyForTier(tier);
  return {
    id: `${setId}-${number}`,
    name: cleanPokemonName(name),
    hp,
    types,
    rarity,
    rarityTier: tier,
    setId,
    setName,
    setSeries: setId.startsWith("sv")
      ? "Scarlet & Violet"
      : setId.startsWith("swsh")
        ? "Sword & Shield"
        : setId.startsWith("xy")
          ? "XY"
          : "Base",
    artist,
    imageSmall: `https://images.pokemontcg.io/${setId}/${number}.png`,
    imageLarge: `https://images.pokemontcg.io/${setId}/${number}_hires.png`,
    marketPrice: price,
    releaseDate: "1999/01/09",
    number,
    supertype: "Pokémon",
    maxSupply: max,
    remaining: Math.floor(max * (0.4 + Math.random() * 0.5)),
  };
}

/** Real card numbers + real CDN art from images.pokemontcg.io */
export const FALLBACK_CARDS: CardData[] = [
  // Base Set classics
  makeFallback("base1", "4", "Charizard", "Rare Holo", 4, "Base Set", 450, ["Fire"], "Mitsuhiro Arita", "120"),
  makeFallback("base1", "2", "Blastoise", "Rare Holo", 4, "Base Set", 120, ["Water"], "Ken Sugimori", "100"),
  makeFallback("base1", "15", "Venusaur", "Rare Holo", 4, "Base Set", 95, ["Grass"], "Mitsuhiro Arita", "100"),
  makeFallback("base1", "58", "Pikachu", "Common", 1, "Base Set", 8.5, ["Lightning"], "Mitsuhiro Arita", "40"),
  makeFallback("base1", "10", "Mewtwo", "Rare Holo", 4, "Base Set", 80, ["Psychic"], "Ken Sugimori", "60"),
  makeFallback("base1", "6", "Gyarados", "Rare Holo", 4, "Base Set", 45, ["Water"], "Mitsuhiro Arita", "100"),
  makeFallback("base1", "5", "Clefairy", "Rare Holo", 4, "Base Set", 35, ["Colorless"], "Ken Sugimori", "40"),
  makeFallback("base1", "12", "Ninetales", "Rare Holo", 4, "Base Set", 30, ["Fire"], "Ken Sugimori", "80"),
  makeFallback("base1", "11", "Nidoking", "Rare Holo", 4, "Base Set", 28, ["Grass"], "Ken Sugimori", "90"),
  makeFallback("base1", "16", "Alakazam", "Rare Holo", 4, "Base Set", 40, ["Psychic"], "Ken Sugimori", "80"),
  makeFallback("base1", "46", "Charmander", "Common", 1, "Base Set", 2.5, ["Fire"], "Mitsuhiro Arita", "50"),
  makeFallback("base1", "63", "Squirtle", "Common", 1, "Base Set", 2.2, ["Water"], "Mitsuhiro Arita", "40"),
  makeFallback("base1", "44", "Bulbasaur", "Common", 1, "Base Set", 2.0, ["Grass"], "Mitsuhiro Arita", "40"),
  makeFallback("base1", "35", "Abra", "Common", 1, "Base Set", 0.8, ["Psychic"], "Mitsuhiro Arita", "30"),
  makeFallback("base1", "52", "Machop", "Common", 1, "Base Set", 0.5, ["Fighting"], "Mitsuhiro Arita", "50"),
  makeFallback("base1", "28", "Sandshrew", "Common", 1, "Base Set", 0.4, ["Fighting"], "Ken Sugimori", "40"),
  makeFallback("base1", "68", "Vulpix", "Common", 1, "Base Set", 0.6, ["Fire"], "Ken Sugimori", "50"),
  makeFallback("base1", "59", "Poliwag", "Common", 1, "Base Set", 0.4, ["Water"], "Ken Sugimori", "40"),
  makeFallback("base1", "47", "Diglett", "Common", 1, "Base Set", 0.35, ["Fighting"], "Keiji Kinebuchi", "30"),
  makeFallback("base1", "55", "Magikarp", "Common", 1, "Base Set", 1.2, ["Water"], "Mitsuhiro Arita", "30"),
  makeFallback("base1", "25", "Drowzee", "Common", 1, "Base Set", 0.3, ["Psychic"], "Ken Sugimori", "50"),
  makeFallback("base1", "32", "Growlithe", "Uncommon", 2, "Base Set", 1.5, ["Fire"], "Ken Sugimori", "60"),
  makeFallback("base1", "33", "Haunter", "Uncommon", 2, "Base Set", 2.0, ["Psychic"], "Keiji Kinebuchi", "60"),
  makeFallback("base1", "8", "Machamp", "Rare Holo", 4, "Base Set", 25, ["Fighting"], "Ken Sugimori", "100"),
  makeFallback("base1", "14", "Raichu", "Rare Holo", 4, "Base Set", 22, ["Lightning"], "Ken Sugimori", "80"),
  // Jungle
  makeFallback("base2", "1", "Clefable", "Rare Holo", 4, "Jungle", 20, ["Colorless"], "Mitsuhiro Arita", "70"),
  makeFallback("base2", "4", "Flareon", "Rare Holo", 4, "Jungle", 35, ["Fire"], "Kagemaru Himeno", "70"),
  makeFallback("base2", "9", "Vaporeon", "Rare Holo", 4, "Jungle", 32, ["Water"], "Kagemaru Himeno", "80"),
  makeFallback("base2", "7", "Jolteon", "Rare Holo", 4, "Jungle", 30, ["Lightning"], "Kagemaru Himeno", "70"),
  makeFallback("base2", "13", "Snorlax", "Rare Holo", 4, "Jungle", 28, ["Colorless"], "Ken Sugimori", "90"),
  makeFallback("base2", "17", "Eevee", "Common", 1, "Jungle", 5, ["Colorless"], "Kagemaru Himeno", "50"),
  makeFallback("base2", "32", "Pikachu", "Common", 1, "Jungle", 4, ["Lightning"], "Ken Sugimori", "50"),
  // Fossil
  makeFallback("base3", "1", "Aerodactyl", "Rare Holo", 4, "Fossil", 18, ["Fighting"], "Kagemaru Himeno", "60"),
  makeFallback("base3", "4", "Dragonite", "Rare Holo", 4, "Fossil", 55, ["Colorless"], "Kagemaru Himeno", "100"),
  makeFallback("base3", "9", "Gengar", "Rare Holo", 4, "Fossil", 40, ["Psychic"], "Keiji Kinebuchi", "80"),
  makeFallback("base3", "10", "Haunter", "Rare", 3, "Fossil", 8, ["Psychic"], "Ken Sugimori", "50"),
  makeFallback("base3", "15", "Muk", "Rare Holo", 4, "Fossil", 12, ["Grass"], "Mitsuhiro Arita", "70"),
  // 151
  makeFallback("sv3pt5", "25", "Pikachu", "Common", 1, "151", 0.35, ["Lightning"], "OKACHEKE", "70"),
  makeFallback("sv3pt5", "4", "Charmander", "Common", 1, "151", 0.28, ["Fire"], "GIDORA", "70"),
  makeFallback("sv3pt5", "7", "Squirtle", "Common", 1, "151", 0.3, ["Water"], "Mitsuhiro Arita", "70"),
  makeFallback("sv3pt5", "1", "Bulbasaur", "Common", 1, "151", 0.32, ["Grass"], "Yoriyuki Ikegami", "70"),
  makeFallback("sv3pt5", "6", "Charizard", "Rare", 3, "151", 4.5, ["Fire"], "GIDORA", "120"),
  makeFallback("sv3pt5", "150", "Mewtwo", "Rare Holo", 4, "151", 12, ["Psychic"], "AKIRA EGAWA", "130"),
  makeFallback("sv3pt5", "151", "Mew", "Rare Holo", 4, "151", 9.5, ["Psychic"], "Yuu Nishida", "60"),
  makeFallback("sv3pt5", "94", "Gengar", "Rare", 3, "151", 2.1, ["Psychic"], "sowsow", "120"),
  makeFallback("sv3pt5", "143", "Snorlax", "Uncommon", 2, "151", 0.8, ["Colorless"], "Oswaldo KATO", "150"),
  makeFallback("sv3pt5", "133", "Eevee", "Common", 1, "151", 0.5, ["Colorless"], "sowsow", "70"),
  makeFallback("sv3pt5", "183", "Charizard ex", "Double Rare", 5, "151", 45, ["Fire"], "5ban Graphics", "330"),
  makeFallback("sv3pt5", "198", "Charizard ex", "Special Illustration Rare", 8, "151", 320, ["Fire"], "miki kudo", "330"),
  makeFallback("sv3pt5", "199", "Pikachu", "Illustration Rare", 7, "151", 85, ["Lightning"], "Atsushi Furusawa", "70"),
  // Evolutions (nostalgia)
  makeFallback("xy12", "11", "Charizard", "Rare Holo", 4, "Evolutions", 15, ["Fire"], "Mitsuhiro Arita", "120"),
  makeFallback("xy12", "35", "Pikachu", "Common", 1, "Evolutions", 1.5, ["Lightning"], "Mitsuhiro Arita", "60"),
  makeFallback("xy12", "2", "Venusaur", "Rare Holo", 4, "Evolutions", 8, ["Grass"], "Mitsuhiro Arita", "140"),
  makeFallback("xy12", "21", "Blastoise", "Rare Holo", 4, "Evolutions", 9, ["Water"], "Ken Sugimori", "140"),
];
