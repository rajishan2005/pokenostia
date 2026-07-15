import { NextResponse } from "next/server";
import {
  ensureSeeded,
  expandCardCatalog,
  reseedPokemonCards,
} from "@/lib/seed";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await ensureSeeded();
    const [cards, expansions, sample] = await Promise.all([
      prisma.card.count(),
      prisma.expansion.count(),
      prisma.card.findMany({
        where: {
          name: {
            in: [
              "Pikachu",
              "Charizard",
              "Mewtwo",
              "Blastoise",
              "Venusaur",
              "Gengar",
              "Eevee",
              "Snorlax",
            ],
          },
        },
        take: 16,
        orderBy: { marketPrice: "desc" },
      }),
    ]);
    return NextResponse.json({
      cards,
      expansions,
      sample: sample.map((c) => ({
        id: c.id,
        name: c.name,
        setName: c.setName,
        imageSmall: c.imageSmall,
        rarity: c.rarity,
      })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      force?: boolean;
      expand?: boolean;
    };

    // Additive expand (keeps collections) — preferred for "add more cards"
    if (body.expand) {
      const expanded = await expandCardCatalog({
        maxSets: 50,
        skipIfHas: 30,
      });
      return NextResponse.json({ ok: true, mode: "expand", ...expanded });
    }

    const force = body.force === true; // only wipe when explicitly requested
    const result = force
      ? await reseedPokemonCards(true)
      : await expandCardCatalog({ maxSets: 50, skipIfHas: 30 });

    const classics = await prisma.card.findMany({
      where: {
        OR: [
          { name: { contains: "Pikachu" } },
          { name: { contains: "Charizard" } },
          { name: { contains: "Mewtwo" } },
          { name: { contains: "Blastoise" } },
          { name: { contains: "Gengar" } },
        ],
      },
      take: 12,
      orderBy: { marketPrice: "desc" },
    });

    return NextResponse.json({
      ok: true,
      mode: force ? "reseed" : "expand",
      ...result,
      classics: classics.map((c) => ({
        id: c.id,
        name: c.name,
        image: c.imageSmall,
        set: c.setName,
      })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Seed failed" },
      { status: 500 }
    );
  }
}
