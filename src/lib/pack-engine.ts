import { prisma } from "./prisma";
import { BASE_WEIGHTS } from "./rarity";
import { cleanPokemonName } from "./pokemon-name";
import {
  highRareChanceForPrice,
  isShopPackId,
  isVeryHighRarity,
} from "./shop-packs";
import type { CardData } from "@/types";

type DbCard = Awaited<ReturnType<typeof prisma.card.findMany>>[number];

/** In-memory pool cache — packs feel instant after first open of a set */
const poolCache = new Map<string, { at: number; cards: DbCard[] }>();
const POOL_TTL = 60_000;

/** Recently pulled expensive cards */
const recentHot = new Map<string, number>();
const HOT_WINDOW_MS = 1000 * 60 * 45;
const HOT_MAX = 80;

function markHot(cardId: string) {
  recentHot.set(cardId, Date.now());
  if (recentHot.size > HOT_MAX) {
    const oldest = [...recentHot.entries()].sort((a, b) => a[1] - b[1])[0];
    if (oldest) recentHot.delete(oldest[0]);
  }
}

function isHot(cardId: string): boolean {
  const t = recentHot.get(cardId);
  if (!t) return false;
  if (Date.now() - t > HOT_WINDOW_MS) {
    recentHot.delete(cardId);
    return false;
  }
  return true;
}

function weightedPick<T extends { weight: number }>(items: T[]): T | null {
  const total = items.reduce((s, i) => s + i.weight, 0);
  if (total <= 0 || items.length === 0) return null;
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1] ?? null;
}

export function cardWeight(card: {
  id?: string;
  rarityTier: number;
  remaining: number;
  maxSupply: number;
  marketPrice: number;
}): number {
  if (card.remaining <= 0 || card.maxSupply <= 0) return 0;
  const base = BASE_WEIGHTS[card.rarityTier] ?? 1;
  const scarcity = Math.pow(card.remaining / card.maxSupply, 1.35);
  const priceSoft = 1 / (1 + Math.max(0, card.marketPrice) / 35);
  let w = base * scarcity * (0.5 + 0.5 * priceSoft);
  if (card.marketPrice > 50) w *= 0.55;
  if (card.marketPrice > 100) w *= 0.55;
  if (card.marketPrice > 200) w *= 0.5;
  // Hot dampening lighter so supers can still reappear sometimes
  if (card.id && isHot(card.id)) w *= 0.22;
  w *= 0.65 + Math.random() * 0.7;
  return w;
}

function speciesKey(name: string): string {
  return cleanPokemonName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function familyKey(name: string): string {
  const s = speciesKey(name);
  if (s.length <= 4) return s;
  const families = [
    "pika",
    "raichu",
    "char",
    "squir",
    "bulba",
    "ivys",
    "venu",
    "wartor",
    "blast",
    "mew",
    "gengar",
    "gastly",
    "haunter",
    "abra",
    "kadabra",
    "alakazam",
    "machop",
    "machoke",
    "machamp",
    "geodude",
    "graveler",
    "golem",
    "eevee",
    "vaporeon",
    "jolteon",
    "flareon",
    "dratini",
    "dragonair",
    "dragonite",
  ];
  for (const f of families) {
    if (s.startsWith(f.slice(0, 4)) || s.includes(f)) return f.slice(0, 5);
  }
  return s.slice(0, 5);
}

type SlotKind = "common" | "uncommon" | "rare" | "chase";

function buildSlots(packSize: number): SlotKind[] {
  // Start with commons/uncommons, then place rare/chase at RANDOM positions
  // (start / middle / end) — never force all value to the last slot only.
  const slots: SlotKind[] = Array.from({ length: packSize }, () =>
    Math.random() < 0.55 ? "common" : "uncommon"
  );

  const spicyPack = Math.random() < 0.42; // ~42% packs lean rare+
  // Standard 10-card packs: 0–3 rare/chase slots
  const rareCount = spicyPack
    ? 1 + (Math.random() < 0.55 ? 1 : 0) + (Math.random() < 0.25 ? 1 : 0) // 1–3
    : Math.random() < 0.55
      ? 1
      : Math.random() < 0.35
        ? 1
        : 0;

  // Prefer start + middle for hits; still allow end occasionally
  const positions = Array.from({ length: packSize }, (_, i) => i);
  // Bias: weight earlier/middle positions higher when shuffling picks
  const weightedPos: { i: number; w: number }[] = positions.map((i) => {
    const t = packSize <= 1 ? 0 : i / (packSize - 1); // 0 start → 1 end
    // Higher weight at start & middle; lower at very end
    const w =
      t < 0.35 ? 1.35 : t < 0.75 ? 1.2 : 0.55;
    return { i, w: w * (0.7 + Math.random() * 0.6) };
  });

  const used = new Set<number>();
  for (let n = 0; n < rareCount; n++) {
    const available = weightedPos.filter((p) => !used.has(p.i));
    if (!available.length) break;
    const total = available.reduce((s, p) => s + p.w, 0);
    let r = Math.random() * total;
    let pick = available[0]!.i;
    for (const p of available) {
      r -= p.w;
      if (r <= 0) {
        pick = p.i;
        break;
      }
    }
    used.add(pick);
    // Spicy packs lean chase; otherwise rare more often
    if (spicyPack) {
      slots[pick] = Math.random() < 0.5 ? "chase" : "rare";
    } else {
      slots[pick] = Math.random() < 0.28 ? "chase" : "rare";
    }
  }

  return slots;
}

/** Fisher–Yates shuffle (in place). */
function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function slotFilter(
  card: { rarityTier: number; marketPrice: number },
  slot: SlotKind
): boolean {
  const t = card.rarityTier;
  if (slot === "common") return t <= 2;
  if (slot === "uncommon") return t >= 1 && t <= 3;
  if (slot === "rare") return t >= 3 && t <= 4;
  if (slot === "chase") return t >= 3;
  return true;
}

function slotWeight(
  card: {
    id: string;
    name: string;
    rarityTier: number;
    remaining: number;
    maxSupply: number;
    marketPrice: number;
  },
  slot: SlotKind,
  priceCeiling: number | null
): number {
  if (!slotFilter(card, slot)) return 0;
  // Soft ceiling only — still allow legendaries/supers through more often
  if (
    priceCeiling != null &&
    card.marketPrice > priceCeiling &&
    !isLegendaryName(card.name) &&
    card.rarityTier < 6
  ) {
    return 0;
  }

  let w = cardWeight(card);
  if (slot === "common") w *= card.rarityTier <= 1 ? 1.5 : 1;
  if (slot === "chase") {
    if (card.rarityTier >= 8) w *= 0.55;
    else if (card.rarityTier >= 6) w *= 0.85;
    else if (card.rarityTier >= 5) w *= 1.0;
    else if (card.rarityTier >= 4) w *= 1.05;
    if (isLegendaryName(card.name)) w *= 2.8;
    // Scarcity: expensive cards rarer, but allow occasional $1k+ jackpots
    if (card.marketPrice >= 1000) w *= 0.28;
    else if (card.marketPrice > 80 && !isLegendaryName(card.name)) w *= 0.55;
    else if (card.marketPrice > 30) w *= 0.85;
  }
  if (slot === "rare") {
    if (isLegendaryName(card.name)) w *= 1.8;
    if (card.marketPrice > 40) w *= 0.7;
    if (card.marketPrice > 80) w *= 0.55;
  }
  return w;
}

/** Warm the card pool for an expansion (call when user selects a set). */
export async function warmPackPool(expansionId: string): Promise<number> {
  const cards = await loadPool(expansionId);
  return cards.length;
}

/** Small thumbs for client-side image prefetch before open */
export async function getPoolThumbs(
  expansionId: string,
  limit = 80
): Promise<string[]> {
  const cards = await loadPool(expansionId);
  const urls: string[] = [];
  const seen = new Set<string>();
  // Mix high + low so both chase and fillers are warm
  const shuffled = [...cards].sort(() => Math.random() - 0.5);
  for (const c of shuffled) {
    const u = c.imageSmall || c.imageLarge;
    if (u && !seen.has(u)) {
      seen.add(u);
      urls.push(u);
    }
    if (urls.length >= limit) break;
  }
  return urls;
}

async function loadPool(expansionId: string): Promise<DbCard[]> {
  const hit = poolCache.get(expansionId);
  if (hit && Date.now() - hit.at < POOL_TTL) {
    return hit.cards.map((c) => ({ ...c })); // shallow copy; remaining updated in memory
  }

  // Shop packs — lean mixed pool (fast) instead of scanning entire catalog
  if (isShopPackId(expansionId)) {
    const [high, mid, low] = await Promise.all([
      prisma.card.findMany({
        where: { remaining: { gt: 0 }, rarityTier: { gte: 4 } },
        take: 180,
        orderBy: { remaining: "desc" },
      }),
      prisma.card.findMany({
        where: { remaining: { gt: 0 }, rarityTier: { gte: 2, lte: 3 } },
        take: 220,
        orderBy: { remaining: "desc" },
      }),
      prisma.card.findMany({
        where: { remaining: { gt: 0 }, rarityTier: { lte: 1 } },
        take: 280,
        orderBy: { remaining: "desc" },
      }),
    ]);
    const seen = new Set<string>();
    const cards: DbCard[] = [];
    for (const c of [...high, ...mid, ...low]) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        cards.push(c);
      }
    }
    poolCache.set(expansionId, { at: Date.now(), cards });
    return cards.map((c) => ({ ...c }));
  }

  // Prefer this set's cards, then mix in a large global pool
  let cards = await prisma.card.findMany({
    where: { setId: expansionId, remaining: { gt: 0 } },
  });

  const needGlobal = Math.max(0, 500 - cards.length);
  if (needGlobal > 0 || cards.length < 200) {
    const more = await prisma.card.findMany({
      where: { remaining: { gt: 0 }, NOT: { setId: expansionId } },
      take: Math.max(needGlobal, 500),
      orderBy: [{ rarityTier: "desc" }, { remaining: "desc" }],
    });
    const filler = await prisma.card.findMany({
      where: {
        remaining: { gt: 0 },
        rarityTier: { lte: 2 },
        NOT: { setId: expansionId },
      },
      take: 300,
      orderBy: { remaining: "desc" },
    });
    const seen = new Set(cards.map((c) => c.id));
    for (const c of [...more, ...filler]) {
      if (!seen.has(c.id)) {
        cards.push(c);
        seen.add(c.id);
      }
    }
  }

  poolCache.set(expansionId, { at: Date.now(), cards });
  return cards.map((c) => ({ ...c }));
}

function invalidatePool(expansionId: string) {
  poolCache.delete(expansionId);
}

/**
 * Early hook: exactly ONE of pack 2 or pack 3 (stable per userId).
 * Plus pack 7 always. After that pure luck.
 */
export function earlyHookPackNumber(userId: string): 2 | 3 {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return h % 2 === 0 ? 2 : 3;
}

export function isHookPack(
  totalPacksBeforeOpen: number,
  userId?: string
): boolean {
  const n = totalPacksBeforeOpen + 1;
  if (n === 7) return true;
  if (userId && n === earlyHookPackNumber(userId)) return true;
  // Without userId: never force mid-early packs as a range
  return false;
}

const LEGENDARY_NAMES =
  /mewtwo|mew\b|lugia|ho-?oh|rayquaza|groudon|kyogre|dialga|palkia|giratina|arceus|reshiram|zekrom|kyurem|xerneas|yveltal|zygarde|solgaleo|lunala|necrozma|zacian|zamazenta|eternatus|calyrex|koraidon|miraidon|terapagos|celebi|jirachi|deoxys|darkrai|shaymin|victini|genesect|diancie|hoopa|volcanion|magearna|marshadow|zeraora|meltan|melmetal|zarude|articuno|zapdos|moltres|regirock|regice|registeel|latias|latios|uxie|mesprit|azelf|heatran|regigigas|cresselia|cobalion|terrakion|virizion|tornadus|thundurus|landorus|keldeo|meloetta|type:?null|silvally|tapu|nihilego|buzzwole|pheromosa|xurkitree|celesteela|kartana|guzzlord|naganadel|stakataka|blacephalon|kubfu|urshifu|regieleki|regidrago|glastrier|spectrier|enamorus|wo-?chien|chien-?pao|ting-?lu|chi-?yu|okidogi|munkidori|fezandipiti|ogerpon|pecharunt/i;

function isLegendaryName(name: string): boolean {
  return LEGENDARY_NAMES.test(cleanPokemonName(name));
}

export type PackGenOptions = {
  /** Force a "super duper rare" as the final reveal (tier 6+ / high value). */
  forceSuperRare?: boolean;
  /**
   * Chance (0–1) that this pack guarantees at least one very high rarity card.
   * Shop packs: 40% at $10 → ~95% at $500 (linear).
   */
  highRareChance?: number;
  /** Pack cost used to derive highRareChance if not set */
  packCost?: number;
};

function toCardData(c: DbCard): CardData {
  return {
    id: c.id,
    name: cleanPokemonName(c.name),
    hp: c.hp,
    types: JSON.parse(c.types || "[]") as string[],
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
  };
}

/** Pick a flashy super rare / legendary for silent onboarding hooks. */
function pickSuperRare(
  working: DbCard[],
  usedIds: Set<string>,
  usedSpecies: Set<string>
): DbCard | null {
  const candidates = working
    .map((card) => {
      if (usedIds.has(card.id) || card.remaining <= 0) return null;
      const sp = speciesKey(card.name);
      if (sp && usedSpecies.has(sp)) return null;
      const legendary = isLegendaryName(card.name);
      const isSuper =
        legendary ||
        card.rarityTier >= 6 ||
        (card.rarityTier >= 4 && card.marketPrice >= 18);
      if (!isSuper) return null;
      let w =
        Math.pow(Math.max(card.rarityTier, 4), 2) *
        (1 + Math.min(card.marketPrice, 800) / 50);
      w *= 0.7 + Math.random() * 0.6;
      if (legendary) w *= 3.2;
      if (card.marketPrice >= 1000) w *= 1.45; // grail jackpots still rare but possible
      if (card.rarityTier >= 8) w *= 1.5;
      if (card.rarityTier >= 10) w *= 1.7;
      return { card, weight: w };
    })
    .filter((x): x is { card: DbCard; weight: number } => !!x);

  if (!candidates.length) {
    const fallback = working
      .filter((c) => !usedIds.has(c.id) && c.remaining > 0)
      .sort((a, b) => {
        const la = isLegendaryName(a.name) ? 1 : 0;
        const lb = isLegendaryName(b.name) ? 1 : 0;
        return (
          lb - la ||
          b.rarityTier - a.rarityTier ||
          b.marketPrice - a.marketPrice
        );
      });
    return fallback[0] ?? null;
  }
  return weightedPick(candidates)?.card ?? null;
}

export async function generatePack(
  expansionId: string,
  packSize: number,
  opts: PackGenOptions = {}
): Promise<CardData[]> {
  let pool = await loadPool(expansionId);
  pool = pool.filter((c) => c.remaining > 0);
  if (pool.length === 0) {
    invalidatePool(expansionId);
    pool = await loadPool(expansionId);
  }
  if (pool.length === 0) throw new Error("NO_CARDS");

  const pokemon = pool.filter(
    (c) =>
      (c.supertype && /pok/i.test(c.supertype)) ||
      (c.types && c.types !== "[]")
  );
  let working = pokemon.length >= packSize ? [...pokemon] : [...pool];
  for (let i = working.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [working[i], working[j]] = [working[j]!, working[i]!];
  }

  const prices = working.map((c) => c.marketPrice).sort((a, b) => a - b);
  const p70 = prices[Math.floor(prices.length * 0.7)] ?? 15;
  const p90 = prices[Math.floor(prices.length * 0.9)] ?? 40;

  const usedIds = new Set<string>();
  const usedSpecies = new Set<string>();
  const usedFamilies = new Set<string>();
  const picked: DbCard[] = [];

  // Shop-tier high rare: linear chance from pack price (40% @ $10 → 95% @ $500)
  const highChance =
    opts.highRareChance ??
    (opts.packCost != null
      ? highRareChanceForPrice(opts.packCost)
      : isShopPackId(expansionId)
        ? highRareChanceForPrice(10)
        : 0);
  const forceHighRare =
    !!opts.forceSuperRare ||
    (highChance > 0 && Math.random() < highChance);

  // Leave a slot free if we will inject a high-rare
  const slots = buildSlots(
    forceHighRare ? Math.max(1, packSize - 1) : packSize
  );

  for (const slot of slots) {
    // More jackpot room so supers/legendaries aren't filtered out
    const jackpot = slot === "chase" && Math.random() < 0.22;
    const ceiling =
      slot === "chase"
        ? jackpot
          ? null
          : Math.max(35, p70 * 1.6)
        : slot === "rare"
          ? Math.max(20, p70 * 1.2)
          : null;

    const build = (allowFamilyRepeat: boolean) =>
      working
        .map((card) => {
          if (usedIds.has(card.id) || card.remaining <= 0) return null;
          const sp = speciesKey(card.name);
          if (sp && usedSpecies.has(sp)) return null;
          const fam = familyKey(card.name);
          if (!allowFamilyRepeat && fam && usedFamilies.has(fam)) return null;
          const weight = slotWeight(card, slot, ceiling);
          if (weight <= 0) return null;
          return { card, weight };
        })
        .filter((x): x is { card: DbCard; weight: number } => !!x);

    let choice = weightedPick(build(false));
    if (!choice) choice = weightedPick(build(true));
    if (!choice) {
      choice = weightedPick(
        working
          .map((card) => {
            if (usedIds.has(card.id) || card.remaining <= 0) return null;
            const sp = speciesKey(card.name);
            if (sp && usedSpecies.has(sp)) return null;
            return {
              card,
              weight: cardWeight(card) * (0.5 + Math.random()),
            };
          })
          .filter(
            (x): x is { card: DbCard; weight: number } => !!x && x.weight > 0
          )
      );
    }
    if (!choice) break;

    picked.push(choice.card);
    usedIds.add(choice.card.id);
    choice.card.remaining = Math.max(0, choice.card.remaining - 1);
    const sp = speciesKey(choice.card.name);
    if (sp) usedSpecies.add(sp);
    const fam = familyKey(choice.card.name);
    if (fam) usedFamilies.add(fam);
    if (choice.card.marketPrice >= p90 || choice.card.rarityTier >= 4) {
      markHot(choice.card.id);
    }
  }

  // Inject very high rarity at random start/middle when chance hits
  if (forceHighRare) {
    const superCard = pickSuperRare(working, usedIds, usedSpecies);
    if (superCard) {
      if (picked.length >= packSize) {
        let dropIdx = Math.floor(Math.random() * picked.length);
        const lowIdx = picked.findIndex((c) => c.rarityTier <= 2);
        if (lowIdx >= 0) dropIdx = lowIdx;
        const dropped = picked.splice(dropIdx, 1)[0];
        if (dropped) {
          dropped.remaining += 1;
          usedIds.delete(dropped.id);
        }
      }
      const maxInsert = Math.max(1, Math.ceil(picked.length * 0.7));
      const insertAt = Math.floor(Math.random() * maxInsert);
      picked.splice(insertAt, 0, superCard);
      while (picked.length > packSize) {
        const extra = picked.pop();
        if (extra && extra.id !== superCard.id) {
          extra.remaining += 1;
          usedIds.delete(extra.id);
        } else if (extra) {
          const fill = picked.findIndex(
            (c) => c.id !== superCard.id && c.rarityTier <= 2
          );
          if (fill >= 0) {
            const d = picked.splice(fill, 1)[0];
            if (d) {
              d.remaining += 1;
              usedIds.delete(d.id);
            }
          }
          picked.push(extra);
          break;
        }
      }
      usedIds.add(superCard.id);
      superCard.remaining = Math.max(0, superCard.remaining - 1);
      const sp = speciesKey(superCard.name);
      if (sp) usedSpecies.add(sp);
      markHot(superCard.id);
    }
  }

  const cached = poolCache.get(expansionId);
  if (cached) {
    const byId = new Map(cached.cards.map((c) => [c.id, c]));
    for (const p of picked) {
      const c = byId.get(p.id);
      if (c) c.remaining = Math.max(0, c.remaining - 1);
    }
  }

  // Shuffle — rares can appear start/middle, not only last
  shuffleInPlace(picked);

  if (forceHighRare) {
    const superIdx = picked.findIndex(
      (c) =>
        isVeryHighRarity(c) ||
        isLegendaryName(c.name) ||
        (c.rarityTier >= 4 && c.marketPrice >= 40)
    );
    if (superIdx >= 0) {
      const [s] = picked.splice(superIdx, 1);
      if (s) {
        const maxInsert = Math.max(1, Math.ceil(picked.length * 0.65));
        const insertAt = Math.floor(Math.random() * maxInsert);
        picked.splice(insertAt, 0, s);
      }
    }
  }

  return picked.map(toCardData);
}

export async function commitPull(
  userId: string,
  expansionId: string,
  cards: CardData[]
) {
  const rarestTier = Math.max(...cards.map((c) => c.rarityTier), 1);
  const totalValue = cards.reduce((s, c) => s + c.marketPrice, 0);
  const rareCount = cards.filter((c) => c.rarityTier >= 4).length;
  const cardIds = cards.map((c) => c.id);

  return prisma.$transaction(async (tx) => {
    // Batch remaining decrements
    await Promise.all(
      cardIds.map((id) =>
        tx.card.updateMany({
          where: { id, remaining: { gt: 0 } },
          data: { remaining: { decrement: 1 } },
        })
      )
    );

    const existingItems = await tx.collectionItem.findMany({
      where: { userId, cardId: { in: cardIds } },
    });
    const existingMap = new Map(existingItems.map((e) => [e.cardId, e]));

    for (const card of cards) {
      const existing = existingMap.get(card.id);
      if (existing) {
        await tx.collectionItem.update({
          where: { id: existing.id },
          data: { quantity: { increment: 1 }, lastPull: new Date() },
        });
        existing.quantity += 1; // for multi-hits of same id (shouldn't happen)
      } else {
        await tx.collectionItem.create({
          data: { userId, cardId: card.id, quantity: 1 },
        });
        existingMap.set(card.id, {
          id: "new",
          userId,
          cardId: card.id,
          quantity: 1,
          locked: false,
          firstPull: new Date(),
          lastPull: new Date(),
        });
      }

      if (card.rarityTier >= 4) {
        await tx.pullEvent.create({
          data: {
            userId,
            cardId: card.id,
            rarity: card.rarity,
            isPublic: true,
          },
        });
      }
      if (card.marketPrice > 40 || card.rarityTier >= 4) {
        markHot(card.id);
      }
    }

    const opening = await tx.packOpening.create({
      data: {
        userId,
        expansionId,
        cardIds: JSON.stringify(cardIds),
        rarestTier,
        totalValue,
      },
    });

    const scoreBump = Math.round(
      cards.reduce((s, c) => s + c.rarityTier * 10 + c.marketPrice, 0)
    );

    const user = await tx.user.update({
      where: { id: userId },
      data: {
        totalPacks: { increment: 1 },
        totalRares: { increment: rareCount },
        collectionScore: { increment: scoreBump },
      },
    });

    return { opening, user, rarestTier, totalValue };
  });
}
