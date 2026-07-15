import type { RarityName } from "@/types";

/** Higher tier = rarer. Used for sorting reveal order & effects. */
export const RARITY_TIERS: Record<string, number> = {
  Common: 1,
  Uncommon: 2,
  Rare: 3,
  "Rare Holo": 4,
  "Holo Rare": 4,
  "Rare Holo EX": 5,
  "Rare Holo GX": 5,
  "Rare Holo V": 5,
  "Rare Holo VMAX": 6,
  "Rare Holo VSTAR": 6,
  "Rare Ultra": 6,
  "Ultra Rare": 6,
  "Double Rare": 5,
  "Illustration Rare": 7,
  "Rare Illustration": 7,
  "Special Illustration Rare": 8,
  "Rare Special Illustration": 8,
  "Hyper Rare": 9,
  "Rare Hyper": 9,
  "Secret Rare": 10,
  "Rare Secret": 10,
  "Rare Rainbow": 10,
  "Amazing Rare": 7,
  "Radiant Rare": 6,
  "Trainer Gallery Rare Holo": 5,
  "Shiny Rare": 7,
  "Shiny Ultra Rare": 8,
  Promo: 3,
};

export const DISPLAY_RARITIES: RarityName[] = [
  "Common",
  "Uncommon",
  "Rare",
  "Holo Rare",
  "Ultra Rare",
  "Illustration Rare",
  "Special Illustration Rare",
  "Hyper Rare",
  "Secret Rare",
];

export function getRarityTier(rarity: string | null | undefined): number {
  if (!rarity) return 1;
  if (RARITY_TIERS[rarity] != null) return RARITY_TIERS[rarity];
  const lower = rarity.toLowerCase();
  if (lower.includes("secret") || lower.includes("rainbow")) return 10;
  if (lower.includes("hyper")) return 9;
  if (lower.includes("special illustration")) return 8;
  if (lower.includes("illustration")) return 7;
  if (lower.includes("ultra") || lower.includes("vmax") || lower.includes("vstar"))
    return 6;
  if (lower.includes("holo") || lower.includes("ex") || lower.includes("gx"))
    return 4;
  if (lower.includes("rare")) return 3;
  if (lower.includes("uncommon")) return 2;
  return 1;
}

export function normalizeRarity(rarity: string | null | undefined): string {
  if (!rarity) return "Common";
  const tier = getRarityTier(rarity);
  const map: Record<number, string> = {
    1: "Common",
    2: "Uncommon",
    3: "Rare",
    4: "Holo Rare",
    5: "Ultra Rare",
    6: "Ultra Rare",
    7: "Illustration Rare",
    8: "Special Illustration Rare",
    9: "Hyper Rare",
    10: "Secret Rare",
  };
  return map[tier] ?? rarity;
}

export function rarityColor(tier: number): string {
  if (tier >= 10) return "#ff6b9d";
  if (tier >= 9) return "#ffd700";
  if (tier >= 8) return "#c084fc";
  if (tier >= 7) return "#a78bfa";
  if (tier >= 6) return "#f472b6";
  if (tier >= 4) return "#60a5fa";
  if (tier >= 3) return "#34d399";
  if (tier >= 2) return "#94a3b8";
  return "#64748b";
}

export function rarityGlow(tier: number): string {
  const c = rarityColor(tier);
  return `0 0 20px ${c}66, 0 0 40px ${c}33`;
}

/** Base pull weights before scarcity adjustment (relative). */
export const BASE_WEIGHTS: Record<number, number> = {
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

/** Max global supply by tier (seed defaults). */
export function maxSupplyForTier(tier: number): number {
  if (tier >= 10) return 50;
  if (tier >= 9) return 80;
  if (tier >= 8) return 120;
  if (tier >= 7) return 200;
  if (tier >= 6) return 350;
  if (tier >= 4) return 600;
  if (tier >= 3) return 1200;
  if (tier >= 2) return 2500;
  return 5000;
}
