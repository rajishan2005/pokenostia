import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSeeded } from "@/lib/seed";
import { cacheGetOrSet } from "@/lib/cache";

export async function GET() {
  try {
    await ensureSeeded();
    const feed = await cacheGetOrSet("feed:live", 15, async () => {
      const events = await prisma.pullEvent.findMany({
        where: { isPublic: true },
        include: {
          user: { select: { username: true, avatar: true } },
          card: true,
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      });
      return events.map((e) => ({
        id: e.id,
        username: e.user.username,
        avatar: e.user.avatar,
        cardName: e.card.name,
        cardImage: e.card.imageSmall,
        rarity: e.rarity,
        rarityTier: e.card.rarityTier,
        marketPrice: e.card.marketPrice,
        createdAt: e.createdAt.toISOString(),
      }));
    });
    return NextResponse.json({ feed });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ feed: [] });
  }
}
