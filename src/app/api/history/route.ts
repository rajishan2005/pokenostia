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

    const openings = await prisma.packOpening.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const result = await Promise.all(
      openings.map(async (o) => {
        const ids = JSON.parse(o.cardIds) as string[];
        const cards = await prisma.card.findMany({
          where: { id: { in: ids } },
        });
        const byId = new Map(cards.map((c) => [c.id, c]));
        return {
          id: o.id,
          expansionId: o.expansionId,
          rarestTier: o.rarestTier,
          totalValue: o.totalValue,
          createdAt: o.createdAt.toISOString(),
          cards: ids
            .map((id) => byId.get(id))
            .filter(Boolean)
            .map((c) => ({
              ...c!,
              types: JSON.parse(c!.types || "[]"),
            })),
        };
      })
    );

    return NextResponse.json({ history: result });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ history: [] });
  }
}
