import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";

export async function GET() {
  try {
    await ensureSeeded();
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const rows = await prisma.tradeHistory.findMany({
      where: { userId: session.id },
      include: {
        card: {
          select: {
            id: true,
            name: true,
            imageSmall: true,
            marketPrice: true,
            rarity: true,
            rarityTier: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      history: rows.map((r) => ({
        id: r.id,
        type: r.type,
        amount: r.amount,
        marketPrice: r.marketPrice,
        percent: r.percent,
        note: r.note,
        createdAt: r.createdAt.toISOString(),
        card: r.card,
      })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ history: [] });
  }
}
