import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSeeded } from "@/lib/seed";
import { cacheGetOrSet } from "@/lib/cache";

export async function GET() {
  try {
    await ensureSeeded();
    const data = await cacheGetOrSet("marketplace:v1", 60, async () => {
      const [valuable, scarce, recent] = await Promise.all([
        prisma.card.findMany({
          orderBy: { marketPrice: "desc" },
          take: 12,
        }),
        prisma.card.findMany({
          where: { remaining: { gt: 0 } },
          orderBy: [{ remaining: "asc" }, { marketPrice: "desc" }],
          take: 12,
        }),
        prisma.pullEvent.findMany({
          where: { isPublic: true },
          include: {
            card: true,
            user: { select: { username: true, avatar: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 16,
        }),
      ]);

      const priceBuckets = await prisma.card.groupBy({
        by: ["rarityTier"],
        _avg: { marketPrice: true },
        _count: true,
        orderBy: { rarityTier: "asc" },
      });

      const map = (c: (typeof valuable)[0]) => ({
        ...c,
        types: JSON.parse(c.types || "[]"),
      });

      return {
        trending: valuable.slice(0, 8).map(map),
        mostValuable: valuable.map(map),
        scarce: scarce.map(map),
        recentlyPulled: recent.map((r) => ({
          id: r.id,
          username: r.user.username,
          avatar: r.user.avatar,
          rarity: r.rarity,
          createdAt: r.createdAt.toISOString(),
          card: map(r.card),
        })),
        chart: {
          labels: priceBuckets.map((b) => `Tier ${b.rarityTier}`),
          avgPrice: priceBuckets.map((b) =>
            Number((b._avg.marketPrice ?? 0).toFixed(2))
          ),
          counts: priceBuckets.map((b) => b._count),
        },
      };
    });

    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json({
      trending: [],
      mostValuable: [],
      scarce: [],
      recentlyPulled: [],
      chart: { labels: [], avgPrice: [], counts: [] },
    });
  }
}
