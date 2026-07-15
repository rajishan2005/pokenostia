/**
 * In-game economy (Pikadollars) — NOT real-world TCG dollars.
 * Real API prices are compressed into a fair pack-opening game scale.
 */

import { cleanPokemonName } from "./pokemon-name";

/** Base market band by rarity tier [min, mid, max] — tuned so ~$10 packs win ~70% */
export const TIER_PRICE_BAND: Record<number, [number, number, number]> = {
  1: [0.25, 0.55, 0.95], // Common
  2: [0.7, 1.25, 2.0], // Uncommon
  3: [1.8, 3.2, 5.0], // Rare
  4: [4.0, 6.8, 11], // Holo
  5: [6.5, 10.5, 16], // EX / Double Rare
  6: [9, 14.5, 22], // Ultra / VMAX
  7: [12, 19, 28], // Illustration
  8: [16, 25, 38], // SIR
  9: [22, 33, 48], // Hyper
  10: [28, 42, 65], // Secret / Rainbow
};

/** Absolute ceiling — nothing should print $500 in a $10 pack economy */
export const MAX_CARD_PRICE = 65;
export const DEFAULT_PACK_COST = 10;
export const TARGET_PROFIT_RATE = 0.7; // player profitable ~70% of opens

/**
 * Map a (possibly real-world) market price + tier into game Pikadollars.
 * Preserves relative ranking within a tier without absurd spikes.
 */
export function gamePriceForCard(opts: {
  rarityTier: number;
  rawPrice?: number | null;
  name?: string | null;
  seed?: string;
}): number {
  const tier = Math.min(10, Math.max(1, opts.rarityTier || 1));
  const [lo, mid, hi] = TIER_PRICE_BAND[tier] ?? TIER_PRICE_BAND[1]!;
  const raw = Math.max(0, opts.rawPrice ?? 0);
  const h = hash01(opts.seed || opts.name || String(tier));

  // Spread within band from seed (stable per card id)
  let price = lo + (hi - lo) * (0.25 + h * 0.55);

  // Chase species sit upper-band (still capped — no $1000+ grails)
  if (opts.name && isChaseName(opts.name)) {
    price = mid + (hi - mid) * (0.55 + h * 0.45);
  }

  // Real-world expensive cards → upper band only (compressed)
  if (raw >= 50) price = mid + (hi - mid) * (0.6 + h * 0.4);
  else if (raw >= 15 && tier >= 3) price = Math.max(price, mid);

  price = Math.min(MAX_CARD_PRICE, Math.max(lo, price));
  return Math.round(price * 100) / 100;
}

function isChaseName(name: string): boolean {
  return /charizard|mewtwo|lugia|umbreon|rayquaza|pikachu|gengar|mew\b|arceus|giratina|miraidon|koraidon/i.test(
    cleanPokemonName(name)
  );
}

function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/**
 * From simulated pack totals, pick a pack cost so ~targetRate of packs
 * beat the cost (default 70%).
 */
export function packCostFromSim(
  totals: number[],
  targetRate = TARGET_PROFIT_RATE
): { cost: number; avg: number; winRate: number } {
  if (!totals.length) {
    return { cost: DEFAULT_PACK_COST, avg: 0, winRate: 0 };
  }
  const sorted = [...totals].sort((a, b) => a - b);
  const avg = totals.reduce((s, v) => s + v, 0) / totals.length;
  // Cost near (1 - targetRate) quantile → ~targetRate of packs are profitable
  const q = Math.max(0, Math.min(1, 1 - targetRate));
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor(q * (sorted.length - 1)))
  );
  let cost = sorted[idx] ?? DEFAULT_PACK_COST;
  // Keep packs in a fun $6–$14 band; bias toward 10 when avg is healthy
  cost = Math.round(Math.min(14, Math.max(6, cost)));
  if (avg >= 9 && avg <= 16) cost = Math.min(cost, DEFAULT_PACK_COST);
  // If still too many huge wins, nudge cost up slightly
  let wins = totals.filter((v) => v > cost).length;
  let winRate = wins / totals.length;
  if (winRate > 0.85 && cost < 14) {
    cost = Math.min(14, cost + 1);
    wins = totals.filter((v) => v > cost).length;
    winRate = wins / totals.length;
  }
  if (winRate < 0.55 && cost > 6) {
    cost = Math.max(6, cost - 1);
    wins = totals.filter((v) => v > cost).length;
    winRate = wins / totals.length;
  }
  return { cost, avg: Math.round(avg * 100) / 100, winRate };
}
