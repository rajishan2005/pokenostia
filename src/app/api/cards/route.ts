import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSeeded } from "@/lib/seed";
import { searchCards } from "@/lib/tcg-api";

export async function GET(req: Request) {
  try {
    await ensureSeeded();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    const setId = searchParams.get("setId");
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(50, Number(searchParams.get("limit") || 24));
    const skip = (page - 1) * limit;

    if (q) {
      // Prefer DB, enrich with live search if sparse
      const local = await prisma.card.findMany({
        where: { name: { contains: q } },
        take: limit,
        skip,
        orderBy: { marketPrice: "desc" },
      });
      if (local.length >= 4) {
        return NextResponse.json({
          cards: local.map(mapCard),
          page,
          hasMore: local.length === limit,
        });
      }
      const remote = await searchCards(q);
      return NextResponse.json({
        cards: remote.slice(skip, skip + limit),
        page,
        hasMore: remote.length > skip + limit,
      });
    }

    const where = setId ? { setId } : {};
    const [cards, total] = await Promise.all([
      prisma.card.findMany({
        where,
        take: limit,
        skip,
        orderBy: [{ rarityTier: "desc" }, { marketPrice: "desc" }],
      }),
      prisma.card.count({ where }),
    ]);

    return NextResponse.json({
      cards: cards.map(mapCard),
      page,
      total,
      hasMore: skip + cards.length < total,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ cards: [], page: 1, hasMore: false });
  }
}

function mapCard(c: {
  id: string;
  name: string;
  hp: string | null;
  types: string;
  rarity: string;
  rarityTier: number;
  setId: string;
  setName: string;
  setSeries: string | null;
  artist: string | null;
  imageSmall: string | null;
  imageLarge: string | null;
  marketPrice: number;
  releaseDate: string | null;
  number: string | null;
  supertype: string | null;
  maxSupply: number;
  remaining: number;
}) {
  return {
    ...c,
    types: JSON.parse(c.types || "[]") as string[],
  };
}
