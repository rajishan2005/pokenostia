/**
 * The only packs players can buy — 7 tiers from $100 → $500 (linear).
 * High-rarity odds start at 20% and climb linearly with pack price.
 */

export type PackTheme =
  | "rookie"
  | "neon"
  | "metro"
  | "vault"
  | "crown"
  | "mythic"
  | "apex";

export type ShopPackDef = {
  id: string;
  name: string;
  tagline: string;
  series: string;
  packCost: number;
  packSize: number;
  icon: string;
  order: number;
  theme: PackTheme;
  /** Banner label on pack face */
  banner: string;
};

export const PACK_PRICE_MIN = 100;
export const PACK_PRICE_MAX = 500;

export const HIGH_RARE_CHANCE_AT_MIN = 0.2;
export const HIGH_RARE_CHANCE_AT_MAX = 0.75;

export function highRareChanceForPrice(packCost: number): number {
  const t =
    (Math.min(PACK_PRICE_MAX, Math.max(PACK_PRICE_MIN, packCost)) -
      PACK_PRICE_MIN) /
    (PACK_PRICE_MAX - PACK_PRICE_MIN);
  return (
    HIGH_RARE_CHANCE_AT_MIN +
    t * (HIGH_RARE_CHANCE_AT_MAX - HIGH_RARE_CHANCE_AT_MIN)
  );
}

export function linearPackCost(index: number, total = 7): number {
  if (total <= 1) return PACK_PRICE_MIN;
  const t = index / (total - 1);
  return Math.round(PACK_PRICE_MIN + t * (PACK_PRICE_MAX - PACK_PRICE_MIN));
}

export function isVeryHighRarity(card: {
  rarityTier: number;
  marketPrice?: number;
}): boolean {
  if (card.rarityTier >= 6) return true;
  if (card.rarityTier >= 4 && (card.marketPrice ?? 0) >= 40) return true;
  return false;
}

const PACK_META: Omit<ShopPackDef, "packCost" | "order">[] = [
  {
    id: "hv-rookie",
    name: "Rookie Wrap",
    tagline: "Entry pack · 20% high-rare shot",
    series: "PokeNostia Shop",
    packSize: 10,
    icon: "📦",
    theme: "rookie",
    banner: "Starter",
  },
  {
    id: "hv-neon",
    name: "Neon Holo",
    tagline: "City lights foil energy",
    series: "PokeNostia Shop",
    packSize: 10,
    icon: "💜",
    theme: "neon",
    banner: "Holo Street",
  },
  {
    id: "hv-metro",
    name: "Metro Chase",
    tagline: "Rush-hour rares",
    series: "PokeNostia Shop",
    packSize: 10,
    icon: "🌃",
    theme: "metro",
    banner: "Night Line",
  },
  {
    id: "hv-vault",
    name: "Vault Breaker",
    tagline: "Lockbox heat · premium sealed",
    series: "PokeNostia Shop",
    packSize: 10,
    icon: "🔐",
    theme: "vault",
    banner: "Vault Elite",
  },
  {
    id: "hv-crown",
    name: "Crown Circuit",
    tagline: "Tournament pressure",
    series: "PokeNostia Shop",
    packSize: 10,
    icon: "👑",
    theme: "crown",
    banner: "Crown Royal",
  },
  {
    id: "hv-mythic",
    name: "Mythic Prism",
    tagline: "Spectrum legendaries",
    series: "PokeNostia Shop",
    packSize: 10,
    icon: "💎",
    theme: "mythic",
    banner: "Prism Myth",
  },
  {
    id: "hv-apex",
    name: "Apex God Pack",
    tagline: "Top of the ladder · ~75% high-rare",
    series: "PokeNostia Shop",
    packSize: 10,
    icon: "⚡",
    theme: "apex",
    banner: "God Tier",
  },
];

export const SHOP_PACKS: ShopPackDef[] = PACK_META.map((p, i) => ({
  ...p,
  packCost: linearPackCost(i, PACK_META.length),
  order: i + 1,
}));

export function getShopPack(id: string): ShopPackDef | undefined {
  return SHOP_PACKS.find((p) => p.id === id);
}

export function isShopPackId(id: string): boolean {
  return SHOP_PACKS.some((p) => p.id === id);
}

/** Visual theme tokens for pack art */
export const PACK_THEMES: Record<
  PackTheme,
  {
    bg: string;
    border: string;
    glow: string;
    banner: string;
    accent: string;
    seal: "ball" | "lock" | "crown" | "gem" | "bolt" | "neon" | "metro";
    premium?: boolean;
  }
> = {
  rookie: {
    bg: "linear-gradient(165deg, #1e3a8a 0%, #2563eb 28%, #dc2626 62%, #fbbf24 100%)",
    border: "rgba(251,191,36,0.55)",
    glow: "0 20px 50px rgba(220,38,38,0.4)",
    banner: "linear-gradient(90deg,#1e3a8a,#dc2626,#fbbf24)",
    accent: "#fde68a",
    seal: "ball",
  },
  neon: {
    bg: "linear-gradient(160deg, #4c1d95 0%, #7c3aed 35%, #db2777 70%, #22d3ee 100%)",
    border: "rgba(34,211,238,0.65)",
    glow: "0 20px 55px rgba(124,58,237,0.55)",
    banner: "linear-gradient(90deg,#7c3aed,#db2777,#22d3ee)",
    accent: "#a5f3fc",
    seal: "neon",
    premium: true,
  },
  metro: {
    bg: "linear-gradient(170deg, #0f172a 0%, #1e293b 30%, #334155 55%, #f59e0b 100%)",
    border: "rgba(148,163,184,0.5)",
    glow: "0 20px 50px rgba(15,23,42,0.7)",
    banner: "linear-gradient(90deg,#0f172a,#475569,#f59e0b)",
    accent: "#fcd34d",
    seal: "metro",
  },
  vault: {
    bg: "linear-gradient(155deg, #1c1917 0%, #44403c 25%, #a8a29e 50%, #fbbf24 78%, #78350f 100%)",
    border: "rgba(251,191,36,0.75)",
    glow: "0 22px 60px rgba(180,83,9,0.55), 0 0 40px rgba(251,191,36,0.25)",
    banner: "linear-gradient(90deg,#292524,#a8a29e,#fbbf24)",
    accent: "#fde68a",
    seal: "lock",
    premium: true,
  },
  crown: {
    bg: "linear-gradient(160deg, #422006 0%, #854d0e 25%, #eab308 55%, #fef08a 80%, #fbbf24 100%)",
    border: "rgba(253,224,71,0.85)",
    glow: "0 24px 65px rgba(234,179,8,0.55), 0 0 50px rgba(253,224,71,0.35)",
    banner: "linear-gradient(90deg,#713f12,#eab308,#fef9c3)",
    accent: "#fffbeb",
    seal: "crown",
    premium: true,
  },
  mythic: {
    bg: "linear-gradient(150deg, #312e81 0%, #6d28d9 30%, #ec4899 55%, #22d3ee 78%, #a78bfa 100%)",
    border: "rgba(216,180,254,0.75)",
    glow: "0 24px 70px rgba(109,40,217,0.55), 0 0 45px rgba(236,72,153,0.3)",
    banner: "linear-gradient(90deg,#4c1d95,#ec4899,#22d3ee)",
    accent: "#e9d5ff",
    seal: "gem",
    premium: true,
  },
  apex: {
    bg: "linear-gradient(155deg, #000 0%, #1a0533 20%, #7c3aed 45%, #fbbf24 70%, #fff 92%)",
    border: "rgba(255,255,255,0.75)",
    glow: "0 28px 80px rgba(124,58,237,0.65), 0 0 60px rgba(251,191,36,0.4)",
    banner: "linear-gradient(90deg,#000,#7c3aed,#fbbf24,#fff)",
    accent: "#fff",
    seal: "bolt",
    premium: true,
  },
};
