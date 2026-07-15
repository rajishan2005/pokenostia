export type RarityName =
  | "Common"
  | "Uncommon"
  | "Rare"
  | "Holo Rare"
  | "Ultra Rare"
  | "Illustration Rare"
  | "Special Illustration Rare"
  | "Hyper Rare"
  | "Secret Rare";

export interface CardData {
  id: string;
  name: string;
  hp: string | null;
  types: string[];
  rarity: string;
  rarityTier: number;
  setId: string;
  setName: string;
  setSeries: string | null;
  artist: string | null;
  imageSmall: string | null;
  imageLarge: string | null;
  marketPrice: number;
  releaseDate: string | null;
  number: string | null;
  supertype: string | null;
  maxSupply: number;
  remaining: number;
}

export interface ExpansionData {
  id: string;
  name: string;
  series: string | null;
  releaseDate: string | null;
  totalCards: number;
  packSize: number;
  packCost: number;
  icon?: string;
  tagline?: string;
  /** Percent chance of a very high rarity card (e.g. 40) */
  highRareChance?: number;
  order?: number;
  imageUrl: string | null;
  logoUrl: string | null;
  active: boolean;
}

export interface UserPublic {
  id: string;
  email: string;
  username: string;
  avatar: string;
  coins: number;
  collectionScore: number;
  totalPacks: number;
  totalRares: number;
  favoriteCardId: string | null;
  loginStreak: number;
  lastLoginDate: string | null;
  birthday: string | null;
  createdAt: string;
}

export interface PackRevealCard extends CardData {
  isNew: boolean;
  flipped?: boolean;
}

export interface LiveFeedItem {
  id: string;
  username: string;
  avatar: string;
  cardName: string;
  cardImage: string | null;
  rarity: string;
  rarityTier: number;
  createdAt: string;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  coins: number;
}

/** Pack-open interaction sequence */
export type PackPhase =
  | "idle"
  | "vibrating"
  | "tearing"
  | "burst"
  | "floating"
  | "aligning"
  | "complete";
