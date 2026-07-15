import { prisma } from "./prisma";
import {
  FALLBACK_CARDS,
  FALLBACK_EXPANSIONS,
  PRIORITY_SET_IDS,
  fetchCardsBySet,
  fetchIconicPokemon,
  fetchSetById,
  fetchSets,
} from "./tcg-api";
import { ensureAchievements } from "./achievements";
import { hashPassword } from "./auth";
import type { CardData, ExpansionData } from "@/types";
import { cacheClear } from "./cache";
import { DEMO_BALANCE, packPriceForSet } from "./currency";
import { ensureWorldFlavor } from "./seed-bots";
import { SHOP_PACKS } from "./shop-packs";

let seeded = false;

async function upsertCard(c: CardData) {
  await prisma.card.upsert({
    where: { id: c.id },
    create: {
      id: c.id,
      name: c.name,
      hp: c.hp,
      types: JSON.stringify(c.types),
      rarity: c.rarity,
      rarityTier: c.rarityTier,
      setId: c.setId,
      setName: c.setName,
      setSeries: c.setSeries,
      artist: c.artist,
      imageSmall: c.imageSmall,
      imageLarge: c.imageLarge,
      marketPrice: c.marketPrice,
      releaseDate: c.releaseDate,
      number: c.number,
      supertype: c.supertype,
      maxSupply: c.maxSupply,
      remaining: c.remaining,
    },
    update: {
      name: c.name,
      marketPrice: c.marketPrice,
      imageSmall: c.imageSmall,
      imageLarge: c.imageLarge,
      rarity: c.rarity,
      rarityTier: c.rarityTier,
      artist: c.artist,
      types: JSON.stringify(c.types),
      supertype: c.supertype,
    },
  });
}

async function upsertExpansion(e: ExpansionData) {
  await prisma.expansion.upsert({
    where: { id: e.id },
    create: {
      id: e.id,
      name: e.name,
      series: e.series,
      releaseDate: e.releaseDate,
      totalCards: e.totalCards,
      packSize: e.packSize,
      packCost: packPriceForSet(e.id, e.series) || e.packCost,
      imageUrl: e.imageUrl,
      logoUrl: e.logoUrl,
      active: true,
    },
    update: {
      name: e.name,
      series: e.series,
      totalCards: e.totalCards,
      packSize: e.packSize,
      packCost: packPriceForSet(e.id, e.series) || e.packCost,
      imageUrl: e.imageUrl,
      logoUrl: e.logoUrl,
      active: true,
    },
  });
}

/** Build list of expansions: classic Pokémon sets first, then recent. */
async function resolveExpansions(): Promise<ExpansionData[]> {
  const byId = new Map<string, ExpansionData>();

  // Priority classics first
  for (const id of PRIORITY_SET_IDS) {
    const e = await fetchSetById(id);
    if (e) byId.set(e.id, e);
  }

  // Fill from live catalog
  try {
    const live = await fetchSets();
    for (const e of live) {
      if (!byId.has(e.id)) byId.set(e.id, e);
    }
  } catch {
    /* ignore */
  }

  for (const e of FALLBACK_EXPANSIONS) {
    if (!byId.has(e.id)) byId.set(e.id, e);
  }

  // Prefer priority order for the first pack slots
  const ordered: ExpansionData[] = [];
  for (const id of PRIORITY_SET_IDS) {
    const e = byId.get(id);
    if (e) ordered.push(e);
  }
  for (const e of byId.values()) {
    if (!ordered.find((x) => x.id === e.id)) ordered.push(e);
  }
  return ordered;
}

export async function ensureSeeded() {
  if (seeded) return;
  const count = await prisma.card.count();
  if (count > 0) {
    seeded = true;
    await ensureAchievements();
    await ensureDemoUser();
    try {
      await ensureShopPacks();
    } catch (e) {
      console.error("shop packs seed", e);
    }
    // Keep bots / grails / shop listings topped up
    try {
      await ensureWorldFlavor();
    } catch (e) {
      console.error("world flavor seed", e);
    }
    return;
  }
  await reseedPokemonCards(false);
}

/**
 * Exactly 7 buyable packs ($10–$500). Deactivates legacy TCG set expansions
 * from the pack shop (cards stay in catalog for pulls).
 */
export async function ensureShopPacks() {
  // Hide old set-as-pack entries from the shop
  await prisma.expansion.updateMany({
    where: { id: { notIn: SHOP_PACKS.map((p) => p.id) } },
    data: { active: false },
  });

  for (const p of SHOP_PACKS) {
    await prisma.expansion.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        name: p.name,
        series: p.series,
        releaseDate: "2024/01/01",
        totalCards: 0,
        packSize: p.packSize,
        packCost: p.packCost,
        imageUrl: null,
        logoUrl: null,
        active: true,
      },
      update: {
        name: p.name,
        series: p.series,
        packSize: p.packSize,
        packCost: p.packCost,
        active: true,
      },
    });
  }
}

/**
 * Pull real Pokémon TCG cards (classic sets + iconics).
 * force=true wipes card/expansion tables and reloads.
 */
export async function reseedPokemonCards(force = true) {
  cacheClear();
  await ensureAchievements();

  if (force) {
    // Keep users/collections history if possible — only reset catalog
    await prisma.pullEvent.deleteMany({});
    await prisma.packOpening.deleteMany({});
    await prisma.collectionItem.deleteMany({});
    await prisma.card.deleteMany({});
    await prisma.expansion.deleteMany({});
  }

  const expansions = await resolveExpansions();
  // Activate many classic + modern sets for pack selection UI
  const active = expansions.slice(0, 40);
  for (const e of active) {
    await upsertExpansion(e);
  }
  // Always ensure every priority set has an expansion row
  for (const id of PRIORITY_SET_IDS) {
    const e = expansions.find((x) => x.id === id);
    if (e) await upsertExpansion(e);
  }

  let cardsIngested = 0;
  // Ingest full card lists for priority sets (real Pokémon)
  const toLoad = [...PRIORITY_SET_IDS];

  for (const setId of toLoad) {
    try {
      const cards = await fetchCardsBySet(setId);
      // Prefer Pokémon creatures; still keep Energy/Trainers so packs feel real
      for (const c of cards) {
        await upsertCard(c);
        cardsIngested++;
      }
    } catch (err) {
      console.error("Failed set", setId, err);
    }
  }

  // Enrich with iconic species across sets
  try {
    const iconics = await fetchIconicPokemon();
    for (const c of iconics) {
      await upsertCard(c);
      cardsIngested++;
      // ensure expansion exists
      if (!(await prisma.expansion.findUnique({ where: { id: c.setId } }))) {
        await upsertExpansion({
          id: c.setId,
          name: c.setName,
          series: c.setSeries,
          releaseDate: c.releaseDate,
          totalCards: 0,
          packSize: 10,
          packCost: packPriceForSet(c.setId, c.setSeries),
          imageUrl: null,
          logoUrl: null,
          active: true,
        });
      }
    }
  } catch (err) {
    console.error("iconic fetch failed", err);
  }

  // Always merge curated real-art fallbacks (guarantees Pikachu/Charizard etc.)
  for (const c of FALLBACK_CARDS) {
    await upsertCard(c);
    cardsIngested++;
  }
  for (const e of FALLBACK_EXPANSIONS) {
    await upsertExpansion(e);
  }

  if (cardsIngested < 10) {
    console.warn("Very few cards ingested — check API connectivity");
  }

  await ensureDemoUser();
  try {
    await ensureWorldFlavor();
  } catch (e) {
    console.error("world flavor seed", e);
  }
  seeded = true;

  const pokemonCount = await prisma.card.count({
    where: {
      OR: [
        { supertype: { contains: "Pok" } },
        { types: { not: "[]" } },
      ],
    },
  });

  return {
    cards: await prisma.card.count(),
    expansions: await prisma.expansion.count(),
    pokemonApprox: pokemonCount,
    setsLoaded: toLoad,
  };
}

async function ensureDemoUser() {
  const demoHash = await hashPassword("demo1234");
  await prisma.user.upsert({
    where: { email: "demo@holovault.app" },
    create: {
      email: "demo@holovault.app",
      username: "TrainerAsh",
      passwordHash: demoHash,
      avatar: "⚡",
      coins: DEMO_BALANCE,
    },
    update: {
      // Keep demo password working on Railway (resets to demo1234)
      passwordHash: demoHash,
      username: "TrainerAsh",
    },
  });
}

/**
 * Additive catalog expand — loads more sets + iconics without wiping users/collections.
 * Safe to call anytime (e.g. "add more cards" / growth seed).
 */
export async function expandCardCatalog(opts?: {
  /** Cap how many priority sets to fetch this run (API rate limits). Default: all */
  maxSets?: number;
  /** Skip sets that already have many cards in DB */
  skipIfHas?: number;
}) {
  const maxSets = opts?.maxSets ?? PRIORITY_SET_IDS.length;
  const skipIfHas = opts?.skipIfHas ?? 40;
  const before = await prisma.card.count();
  const setsLoaded: string[] = [];
  let cardsWritten = 0;

  const expansions = await resolveExpansions();
  for (const e of expansions.slice(0, 50)) {
    await upsertExpansion(e);
  }

  let loaded = 0;
  for (const setId of PRIORITY_SET_IDS) {
    if (loaded >= maxSets) break;
    const existing = await prisma.card.count({ where: { setId } });
    if (existing >= skipIfHas) continue;

    try {
      const meta =
        expansions.find((x) => x.id === setId) || (await fetchSetById(setId));
      if (meta) await upsertExpansion(meta);

      const cards = await fetchCardsBySet(setId);
      for (const c of cards) {
        await upsertCard(c);
        cardsWritten++;
      }
      setsLoaded.push(`${setId}:${cards.length}`);
      loaded++;
    } catch (err) {
      console.error("expand set failed", setId, err);
    }
  }

  try {
    const iconics = await fetchIconicPokemon();
    for (const c of iconics) {
      await upsertCard(c);
      cardsWritten++;
      if (!(await prisma.expansion.findUnique({ where: { id: c.setId } }))) {
        await upsertExpansion({
          id: c.setId,
          name: c.setName,
          series: c.setSeries,
          releaseDate: c.releaseDate,
          totalCards: 0,
          packSize: 10,
          packCost: packPriceForSet(c.setId, c.setSeries),
          imageUrl: null,
          logoUrl: null,
          active: true,
        });
      }
    }
    setsLoaded.push(`iconics:${iconics.length}`);
  } catch (err) {
    console.error("iconic expand failed", err);
  }

  for (const c of FALLBACK_CARDS) {
    await upsertCard(c);
  }
  for (const e of FALLBACK_EXPANSIONS) {
    await upsertExpansion(e);
  }

  try {
    await ensureWorldFlavor();
  } catch (e) {
    console.error("world flavor", e);
  }

  const after = await prisma.card.count();
  return {
    before,
    after,
    added: Math.max(0, after - before),
    cardsWritten,
    setsLoaded,
    expansions: await prisma.expansion.count(),
  };
}
