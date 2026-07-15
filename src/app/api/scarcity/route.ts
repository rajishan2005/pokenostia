import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSeeded } from "@/lib/seed";

export async function GET(req: Request) {
  try {
    await ensureSeeded();
    const { searchParams } = new URL(req.url);
    const ids = searchParams.get("ids")?.split(",").filter(Boolean);

    if (ids?.length) {
      const cards = await prisma.card.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          name: true,
          remaining: true,
          maxSupply: true,
          rarity: true,
          rarityTier: true,
          marketPrice: true,
          imageSmall: true,
        },
      });
      return NextResponse.json({ cards });
    }

    // Global snapshot: lowest remaining chase cards
    const scarce = await prisma.card.findMany({
      where: { remaining: { gt: 0 }, rarityTier: { gte: 4 } },
      orderBy: { remaining: "asc" },
      take: 20,
      select: {
        id: true,
        name: true,
        remaining: true,
        maxSupply: true,
        rarity: true,
        rarityTier: true,
        marketPrice: true,
        imageSmall: true,
        setName: true,
      },
    });

    const totals = await prisma.card.aggregate({
      _sum: { remaining: true, maxSupply: true },
    });

    return NextResponse.json({
      scarce,
      globalRemaining: totals._sum.remaining ?? 0,
      globalMax: totals._sum.maxSupply ?? 0,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ scarce: [], globalRemaining: 0, globalMax: 0 });
  }
}
