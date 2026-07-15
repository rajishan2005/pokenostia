import { prisma } from "./prisma";
import { ACHIEVEMENTS } from "./achievement-defs";

export { ACHIEVEMENTS };

export async function ensureAchievements() {
  for (const a of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { id: a.id },
      create: {
        id: a.id,
        name: a.name,
        description: a.description,
        icon: a.icon,
        coins: a.coins,
      },
      update: {
        name: a.name,
        description: a.description,
        icon: a.icon,
        coins: a.coins,
      },
    });
  }
}

export async function checkAndGrantAchievements(userId: string): Promise<
  { id: string; name: string; icon: string; coins: number }[]
> {
  await ensureAchievements();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return [];

  const [uniqueCount, owned, openings] = await Promise.all([
    prisma.collectionItem.count({ where: { userId } }),
    prisma.collectionItem.findMany({
      where: { userId },
      include: { card: true },
    }),
    prisma.packOpening.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const hasHolo = owned.some((o) => o.card.rarityTier >= 4);
  const hasSecret = owned.some((o) => o.card.rarityTier >= 10);
  const lucky = owned.some((o) => o.card.marketPrice >= 100);
  const bySet = new Map<string, Set<string>>();
  for (const o of owned) {
    if (!bySet.has(o.card.setId)) bySet.set(o.card.setId, new Set());
    bySet.get(o.card.setId)!.add(o.card.id);
  }

  let completedSet = false;
  for (const [setId, ids] of bySet) {
    const total = await prisma.card.count({ where: { setId } });
    if (total > 0 && ids.size >= total) {
      completedSet = true;
      break;
    }
  }

  const candidates: string[] = [];
  if (user.totalPacks >= 1 || openings.length >= 1) candidates.push("first_pack");
  if (user.totalPacks >= 100) candidates.push("packs_100");
  if (hasHolo) candidates.push("first_holo");
  if (hasSecret) candidates.push("first_secret");
  if (completedSet) candidates.push("complete_set");
  if (lucky) candidates.push("lucky_pull");
  if (uniqueCount >= 50) candidates.push("collector");
  if (user.collectionScore >= 10000) candidates.push("legend");

  const granted: { id: string; name: string; icon: string; coins: number }[] =
    [];

  for (const id of candidates) {
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) continue;
    const existing = await prisma.userAchievement.findUnique({
      where: {
        userId_achievementId: { userId, achievementId: id },
      },
    });
    if (existing) continue;
    try {
      await prisma.userAchievement.create({
        data: { userId, achievementId: id },
      });
      await prisma.user.update({
        where: { id: userId },
        data: { coins: { increment: def.coins } },
      });
      granted.push({
        id: def.id,
        name: def.name,
        icon: def.icon,
        coins: def.coins,
      });
    } catch {
      // race: already unlocked
    }
  }

  return granted;
}
