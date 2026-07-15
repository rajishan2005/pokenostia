import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSeeded } from "@/lib/seed";

const TOP = 100;

export async function GET() {
  try {
    await ensureSeeded();

    const select = {
      id: true,
      username: true,
      avatar: true,
      totalPacks: true,
      totalRares: true,
      collectionScore: true,
      coins: true,
    } as const;

    const [packs, value, rares, scores] = await Promise.all([
      prisma.user.findMany({
        orderBy: { totalPacks: "desc" },
        take: TOP,
        select,
      }),
      prisma.user.findMany({
        orderBy: { collectionScore: "desc" },
        take: TOP,
        select,
      }),
      prisma.user.findMany({
        orderBy: { totalRares: "desc" },
        take: TOP,
        select,
      }),
      prisma.packOpening.findMany({
        orderBy: { totalValue: "desc" },
        take: 50,
        include: {
          user: { select: { username: true, avatar: true } },
        },
      }),
    ]);

    const users = await prisma.user.findMany({
      take: 200,
      select: { id: true, username: true, avatar: true },
    });
    const totalCards = await prisma.card.count();
    const completion = await Promise.all(
      users.map(async (u) => {
        const owned = await prisma.collectionItem.count({
          where: { userId: u.id },
        });
        return {
          ...u,
          owned,
          percent: totalCards
            ? Math.round((owned / totalCards) * 1000) / 10
            : 0,
        };
      })
    );
    completion.sort((a, b) => b.percent - a.percent);

    return NextResponse.json({
      mostPacks: packs,
      highestValue: value,
      mostRares: rares,
      luckyPulls: scores.map((s) => ({
        id: s.id,
        username: s.user.username,
        avatar: s.user.avatar,
        totalValue: s.totalValue,
        rarestTier: s.rarestTier,
        createdAt: s.createdAt.toISOString(),
      })),
      completion: completion.slice(0, TOP),
      limit: TOP,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({
      mostPacks: [],
      highestValue: [],
      mostRares: [],
      luckyPulls: [],
      completion: [],
      limit: TOP,
    });
  }
}
