import { prisma } from "./prisma";
import { hashPassword } from "./auth";
import { maxSupplyForTier } from "./rarity";

const AVATARS = ["⚡", "🔥", "💧", "🌿", "🌙", "⭐", "🎮", "🃏", "👑", "✨", "🦊", "🐉"];

/** Realistic gamertags for leaderboard flavor */
const GAMERTAGS = [
  "AshKetchum99", "MistyTide", "BrockRock", "RedLegend", "BlueRival",
  "LeafGreenx", "GoldHeart", "SilverMoon", "CrystalIce", "RubyFlame",
  "SapphireWave", "EmeraldKing", "DiamondDust", "PearlShine", "PlatinumPro",
  "BlackBoltz", "WhiteWing", "XerneasFan", "YveltalNight", "ZygardeCore",
  "PikaPikaGod", "CharizardDad", "BlastoiseX", "VenusaurOP", "MewtwoMain",
  "LugiaPilot", "RayquazaGod", "GengarGoon", "UmbreonNite", "EspeonDawn",
  "SnorlaxSleep", "GyaradosAce", "Dragonite99", "LucarioAura", "GreninjaOT",
  "CardShark42", "HoloHunter", "FoilFlipper", "PackAddict", "BinderBoss",
  "VaultKeeper", "RarePullz", "SecretSeeker", "ChaseCardz", "MarketWhale",
  "BudgetBinder", "BulkBuyer", "TradeKing", "NostalgiaKid", "GBAVibes",
  "GameBoyOG", "BaseSetBro", "JungleJim", "FossilFinder", "RocketThief",
  "NeoGenesis", "ExpeditionX", "EXMaster", "GXGrinder", "VMAXVault",
  "IllusRare", "SIRChaser", "HyperHit", "GoldStarOG", "ShinyHolo",
  "NightOwlTCG", "DawnPacker", "MidnightFlip", "LuckySeven", "CritHit",
  "RNGBlessed", "BrickCity", "GodPackGod", "OneOfOne", "PSA10Hunter",
  "GradeKing", "SlabLord", "RawIsLaw", "JapaneseImport", "ENFirstEd",
  "Shadowless", "Illustrator", "TrophyCard", "PromoPuller", "LeagueCity",
  "GymLeaderZ", "EliteFourX", "ChampQueue", "BattleTower", "MasterBall",
  "UltraBallz", "NestBall", "TimerBall", "DuskBall", "PremierBall",
  "QuickBall", "HeavyBall", "LoveBall", "MoonBall", "FriendBall",
  "LevelBall", "LureBall", "SportBall", "ParkBall", "SafariZone",
  "ViridianOG", "PewterPro", "CeruleanC", "CeladonVIP", "FuchsiaFox",
  "SaffronSage", "Cinnabar", "IndigoElite", "JohtoJourney", "HoennHeat",
  "SinnohSnow", "UnovaUrban", "KalosStyle", "AlolaSurf", "GalarGym",
  "PaldeaPride", "Kitakami", "BlueberryA", "Terastal", "OgerponFan",
];

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Upsert ~100 bot trainers with realistic stats for top-100 boards */
export async function seedLeaderboardBots() {
  const botCount = await prisma.user.count({
    where: { email: { endsWith: "@bot.holovault.local" } },
  });
  if (botCount >= 100) return { bots: botCount, created: 0 };

  const pw = await hashPassword("bot_not_login");
  let created = 0;
  const tags = [...GAMERTAGS];
  while (tags.length < 100) {
    tags.push(`Trainer${1000 + tags.length}`);
  }

  for (let i = 0; i < 100; i++) {
    const rand = mulberry32(1000 + i * 17);
    const username = tags[i]!.slice(0, 20);
    const email = `bot_${i}@bot.holovault.local`;
    const rankFactor = Math.pow(1 - i / 100, 1.8);
    const totalPacks = Math.floor(20 + rankFactor * 800 + rand() * 40);
    const totalRares = Math.floor(totalPacks * (0.08 + rand() * 0.12));
    const collectionScore = Math.floor(
      totalPacks * 40 + totalRares * 120 + rankFactor * 50000 + rand() * 2000
    );
    const coins = Math.floor(50 + rand() * 2000 + rankFactor * 5000);

    try {
      await prisma.user.upsert({
        where: { email },
        create: {
          email,
          username,
          passwordHash: pw,
          avatar: AVATARS[i % AVATARS.length]!,
          coins,
          totalPacks,
          totalRares,
          collectionScore,
          loginStreak: Math.floor(rand() * 30),
        },
        update: {
          totalPacks,
          totalRares,
          collectionScore,
          coins,
        },
      });
      created++;
    } catch {
      /* skip */
    }
  }

  return { bots: 100, created };
}

/** Inject chase / high-value cards (pre-rebalance style) */
export async function seedMegaValueCards() {
  const megas: {
    id: string;
    name: string;
    price: number;
    tier: number;
    rarity: string;
    setId: string;
    setName: string;
    number: string;
    types: string[];
    artist: string;
  }[] = [
    { id: "base1-4-grail", name: "Charizard", price: 4200, tier: 4, rarity: "Rare Holo", setId: "base1", setName: "Base Set", number: "4", types: ["Fire"], artist: "Mitsuhiro Arita" },
    { id: "base1-2-grail", name: "Blastoise", price: 1100, tier: 4, rarity: "Rare Holo", setId: "base1", setName: "Base Set", number: "2", types: ["Water"], artist: "Ken Sugimori" },
    { id: "base1-15-grail", name: "Venusaur", price: 1050, tier: 4, rarity: "Rare Holo", setId: "base1", setName: "Base Set", number: "15", types: ["Grass"], artist: "Mitsuhiro Arita" },
    { id: "base1-10-grail", name: "Mewtwo", price: 1250, tier: 4, rarity: "Rare Holo", setId: "base1", setName: "Base Set", number: "10", types: ["Psychic"], artist: "Ken Sugimori" },
    { id: "neo1-9-grail", name: "Lugia", price: 2800, tier: 4, rarity: "Rare Holo", setId: "neo1", setName: "Neo Genesis", number: "9", types: ["Colorless"], artist: "Hironobu Yoshida" },
    { id: "neo1-8-grail", name: "Ho-Oh", price: 1900, tier: 4, rarity: "Rare Holo", setId: "neo1", setName: "Neo Genesis", number: "7", types: ["Fire"], artist: "Mitsuhiro Arita" },
    { id: "ex1-101-grail", name: "Mewtwo", price: 1600, tier: 6, rarity: "Rare Holo EX", setId: "ex1", setName: "Ruby & Sapphire", number: "101", types: ["Psychic"], artist: "Mitsuhiro Arita" },
    { id: "swsh12-215-grail", name: "Lugia", price: 2100, tier: 10, rarity: "Rare Secret", setId: "swsh12", setName: "Silver Tempest", number: "215", types: ["Colorless"], artist: "AKIRA EGAWA" },
    { id: "sv3pt5-198-grail", name: "Charizard", price: 3200, tier: 8, rarity: "Special Illustration Rare", setId: "sv3pt5", setName: "151", number: "198", types: ["Fire"], artist: "miki kudo" },
    { id: "sv3pt5-199-grail", name: "Pikachu", price: 1400, tier: 7, rarity: "Illustration Rare", setId: "sv3pt5", setName: "151", number: "199", types: ["Lightning"], artist: "Atsushi Furusawa" },
    { id: "base5-4-grail", name: "Charizard", price: 1700, tier: 4, rarity: "Rare Holo", setId: "base5", setName: "Team Rocket", number: "4", types: ["Fire"], artist: "Mitsuhiro Arita" },
    { id: "base3-4-grail", name: "Dragonite", price: 1150, tier: 4, rarity: "Rare Holo", setId: "base3", setName: "Fossil", number: "4", types: ["Colorless"], artist: "Kagemaru Himeno" },
    { id: "base3-9-grail", name: "Gengar", price: 1080, tier: 4, rarity: "Rare Holo", setId: "base3", setName: "Fossil", number: "5", types: ["Psychic"], artist: "Keiji Kinebuchi" },
    { id: "xy12-11-grail", name: "Charizard", price: 1350, tier: 4, rarity: "Rare Holo", setId: "xy12", setName: "Evolutions", number: "11", types: ["Fire"], artist: "Mitsuhiro Arita" },
    { id: "swsh7-215-grail", name: "Umbreon", price: 4500, tier: 10, rarity: "Rare Secret", setId: "swsh7", setName: "Evolving Skies", number: "215", types: ["Darkness"], artist: "AKIRA EGAWA" },
    { id: "swsh7-188-grail", name: "Rayquaza", price: 2200, tier: 8, rarity: "Rare Rainbow", setId: "swsh7", setName: "Evolving Skies", number: "218", types: ["Dragon"], artist: "5ban Graphics" },
    { id: "sv4-251-grail", name: "Garchomp", price: 1180, tier: 8, rarity: "Special Illustration Rare", setId: "sv4", setName: "Paradox Rift", number: "251", types: ["Dragon"], artist: "Nurikabe" },
    { id: "base1-6-grail", name: "Gyarados", price: 1020, tier: 4, rarity: "Rare Holo", setId: "base1", setName: "Base Set", number: "6", types: ["Water"], artist: "Mitsuhiro Arita" },
    { id: "neo1-15-grail", name: "Tyranitar", price: 1300, tier: 4, rarity: "Rare Holo", setId: "neo1", setName: "Neo Genesis", number: "12", types: ["Darkness"], artist: "Hironobu Yoshida" },
    { id: "base2-4-grail", name: "Flareon", price: 1010, tier: 4, rarity: "Rare Holo", setId: "base2", setName: "Jungle", number: "3", types: ["Fire"], artist: "Kagemaru Himeno" },
    { id: "base2-1-grail", name: "Clefable", price: 980, tier: 4, rarity: "Rare Holo", setId: "base2", setName: "Jungle", number: "1", types: ["Colorless"], artist: "Mitsuhiro Arita" },
    { id: "base3-1-grail", name: "Aerodactyl", price: 1120, tier: 4, rarity: "Rare Holo", setId: "base3", setName: "Fossil", number: "1", types: ["Fighting"], artist: "Kagemaru Himeno" },
    { id: "neo2-8-grail", name: "Lugia", price: 3500, tier: 4, rarity: "Rare Holo", setId: "neo2", setName: "Neo Discovery", number: "9", types: ["Colorless"], artist: "Hironobu Yoshida" },
    { id: "swsh45-66-grail", name: "Pikachu", price: 1680, tier: 7, rarity: "Amazing Rare", setId: "swsh45", setName: "Shining Fates", number: "SV20", types: ["Lightning"], artist: "Mitsuhiro Arita" },
    { id: "sv1-198-grail", name: "Miraidon", price: 1450, tier: 8, rarity: "Special Illustration Rare", setId: "sv1", setName: "Scarlet & Violet", number: "244", types: ["Lightning"], artist: "Akira Komayama" },
    { id: "sv2-215-grail", name: "Iono", price: 2100, tier: 8, rarity: "Special Illustration Rare", setId: "sv2", setName: "Paldea Evolved", number: "269", types: [], artist: "kirisAki" },
    { id: "swsh9-18-grail", name: "Charizard", price: 2800, tier: 8, rarity: "Rare Rainbow", setId: "swsh9", setName: "Brilliant Stars", number: "TG03", types: ["Fire"], artist: "Akira Komayama" },
    { id: "xy8-97-grail", name: "M Rayquaza", price: 1550, tier: 6, rarity: "Rare Holo EX", setId: "xy8", setName: "Roaring Skies", number: "76", types: ["Colorless"], artist: "5ban Graphics" },
    { id: "sm3-60-grail", name: "Necrozma", price: 1080, tier: 6, rarity: "Rare Holo GX", setId: "sm3", setName: "Burning Shadows", number: "63", types: ["Psychic"], artist: "5ban Graphics" },
    { id: "base4-4-grail", name: "Charizard", price: 2400, tier: 4, rarity: "Rare Holo", setId: "base4", setName: "Base Set 2", number: "4", types: ["Fire"], artist: "Mitsuhiro Arita" },
    { id: "neo1-1-grail", name: "Ampharos", price: 1040, tier: 4, rarity: "Rare Holo", setId: "neo1", setName: "Neo Genesis", number: "1", types: ["Lightning"], artist: "Ken Sugimori" },
  ];

  for (const m of megas) {
    const max = maxSupplyForTier(m.tier);
    const setSlug = m.setId;
    await prisma.card.upsert({
      where: { id: m.id },
      create: {
        id: m.id,
        name: m.name,
        hp: String(100 + m.tier * 20),
        types: JSON.stringify(m.types),
        rarity: m.rarity,
        rarityTier: m.tier,
        setId: m.setId,
        setName: m.setName,
        setSeries: null,
        artist: m.artist,
        imageSmall: `https://images.pokemontcg.io/${setSlug}/${m.number}.png`,
        imageLarge: `https://images.pokemontcg.io/${setSlug}/${m.number}_hires.png`,
        marketPrice: m.price,
        releaseDate: "1999/01/09",
        number: m.number,
        supertype: "Pokémon",
        maxSupply: Math.min(max, 80),
        remaining: Math.min(max, 40 + Math.floor(Math.random() * 30)),
      },
      update: {
        marketPrice: m.price,
        rarityTier: m.tier,
        rarity: m.rarity,
        name: m.name,
      },
    });
  }

  // Soft bump top chase cards still under 1k
  const chase = await prisma.card.findMany({
    where: {
      rarityTier: { gte: 5 },
      marketPrice: { gte: 25, lt: 1000 },
    },
    take: 80,
    orderBy: { marketPrice: "desc" },
  });
  let boosted = 0;
  for (const c of chase) {
    if (Math.random() < 0.35) continue;
    const bump = 1000 + Math.floor(Math.random() * 3200);
    await prisma.card.update({
      where: { id: c.id },
      data: { marketPrice: Math.max(c.marketPrice, bump) },
    });
    boosted++;
  }

  return { megas: megas.length, boosted };
}

/** Seed player-facing listings at market * 1.05–1.60 (mixed greed) */
export async function seedShopListings() {
  const active = await prisma.marketListing.count({
    where: {
      status: "active",
      seller: { email: { endsWith: "@bot.holovault.local" } },
    },
  });
  if (active >= 55) return { listings: active };

  const bots = await prisma.user.findMany({
    where: { email: { endsWith: "@bot.holovault.local" } },
    take: 60,
  });
  if (!bots.length) return { listings: 0 };

  const [grails, mids] = await Promise.all([
    prisma.card.findMany({
      where: { remaining: { gt: 0 }, marketPrice: { gte: 200 } },
      orderBy: { marketPrice: "desc" },
      take: 35,
    }),
    prisma.card.findMany({
      where: {
        remaining: { gt: 0 },
        rarityTier: { gte: 3 },
        marketPrice: { gte: 3, lt: 200 },
      },
      orderBy: { marketPrice: "desc" },
      take: 50,
    }),
  ]);
  const seen = new Set<string>();
  const cards = [...grails, ...mids].filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
  if (!cards.length) return { listings: 0 };

  const need = Math.max(0, 60 - active);
  let created = 0;
  for (let i = 0; i < Math.min(need + 10, cards.length); i++) {
    const card = cards[i]!;
    const bot = bots[i % bots.length]!;
    const rand = mulberry32(i * 99 + 3 + active);
    const roll = rand();
    const markup =
      roll < 0.4
        ? 0.05 + rand() * 0.1
        : roll < 0.75
          ? 0.12 + rand() * 0.2
          : 0.35 + rand() * 0.25;
    const price = Math.round(card.marketPrice * (1 + markup) * 100) / 100;
    if (price < 1) continue;

    const exists = await prisma.marketListing.findFirst({
      where: { sellerId: bot.id, cardId: card.id, status: "active" },
    });
    if (exists) continue;

    try {
      await prisma.marketListing.create({
        data: {
          sellerId: bot.id,
          cardId: card.id,
          price: Math.max(1, price),
          status: "active",
        },
      });
      created++;
      if (created >= need) break;
    } catch {
      /* skip */
    }
  }

  return { listings: active + created };
}

export async function ensureWorldFlavor() {
  await seedLeaderboardBots();
  await seedMegaValueCards();
  await seedShopListings();
}
