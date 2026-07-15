import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { cleanPokemonName } from "@/lib/pokemon-name";

export async function GET(req: Request) {
  try {
    await ensureSeeded();
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const setId = searchParams.get("setId");

    const items = await prisma.collectionItem.findMany({
      where: {
        userId: session.id,
        ...(setId ? { card: { setId } } : {}),
      },
      include: { card: true },
      orderBy: [{ card: { rarityTier: "desc" } }, { card: { name: "asc" } }],
    });

    const sets = await prisma.expansion.findMany({ where: { active: true } });
    const setProgress = await Promise.all(
      sets.map(async (s) => {
        const total = await prisma.card.count({ where: { setId: s.id } });
        const owned = await prisma.collectionItem.count({
          where: { userId: session.id, card: { setId: s.id } },
        });
        return { setId: s.id, name: s.name, total, owned };
      })
    );

    return NextResponse.json({
      items: items.map((i) => ({
        id: i.id,
        quantity: i.quantity,
        locked: i.locked,
        firstPull: i.firstPull.toISOString(),
        lastPull: i.lastPull.toISOString(),
        card: {
          ...i.card,
          name: cleanPokemonName(i.card.name),
          types: JSON.parse(i.card.types || "[]"),
        },
      })),
      setProgress,
      totalUnique: items.length,
      totalCards: items.reduce((s, i) => s + i.quantity, 0),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
