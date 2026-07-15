/** Achievement rewards in Pikadollars ($) */
export const ACHIEVEMENTS = [
  {
    id: "first_pack",
    name: "First Pack",
    description: "Open your very first booster pack",
    icon: "🎁",
    coins: 3,
  },
  {
    id: "packs_100",
    name: "100 Packs",
    description: "Open 100 booster packs",
    icon: "📦",
    coins: 40,
  },
  {
    id: "first_holo",
    name: "First Holo",
    description: "Pull your first Holo Rare or better",
    icon: "✨",
    coins: 5,
  },
  {
    id: "first_secret",
    name: "First Secret Rare",
    description: "Pull a Secret Rare",
    icon: "🌟",
    coins: 20,
  },
  {
    id: "complete_set",
    name: "Complete a Set",
    description: "Collect every card in an expansion",
    icon: "📚",
    coins: 50,
  },
  {
    id: "lucky_pull",
    name: "Lucky Pull",
    description: "Pull a card worth $100+",
    icon: "🍀",
    coins: 15,
  },
  {
    id: "collector",
    name: "Collector",
    description: "Own 50 unique cards",
    icon: "🗂️",
    coins: 12,
  },
  {
    id: "legend",
    name: "Legend",
    description: "Reach 10,000 collection score",
    icon: "👑",
    coins: 50,
  },
] as const;
