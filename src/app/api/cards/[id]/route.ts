import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSeeded } from "@/lib/seed";
import { cleanPokemonName } from "@/lib/pokemon-name";
import { getRarityTier } from "@/lib/rarity";
import { cacheGetOrSet } from "@/lib/cache";

const API = "https://api.pokemontcg.io/v2";

function headers(): HeadersInit {
  const h: HeadersInit = { Accept: "application/json" };
  if (process.env.POKEMONTCG_API_KEY) {
    h["X-Api-Key"] = process.env.POKEMONTCG_API_KEY;
  }
  return h;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSeeded();
    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const db = await prisma.card.findUnique({ where: { id } });

    const live = await cacheGetOrSet(`tcg:card:${id}`, 1800, async () => {
      try {
        const res = await fetch(`${API}/cards/${encodeURIComponent(id)}`, {
          headers: headers(),
          cache: "no-store",
        });
        if (!res.ok) return null;
        const json = (await res.json()) as { data: Record<string, unknown> };
        return json.data;
      } catch {
        return null;
      }
    });

    if (!db && !live) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const attacks =
      (live?.attacks as
        | {
            name: string;
            cost?: string[];
            convertedEnergyCost?: number;
            damage?: string;
            text?: string;
          }[]
        | undefined) ?? [];

    const abilities =
      (live?.abilities as
        | { name: string; text?: string; type?: string }[]
        | undefined) ?? [];

    const weaknesses =
      (live?.weaknesses as { type: string; value: string }[] | undefined) ??
      [];
    const resistances =
      (live?.resistances as { type: string; value: string }[] | undefined) ??
      [];

    const rules = (live?.rules as string[] | undefined) ?? [];
    const subtypes = (live?.subtypes as string[] | undefined) ?? [];
    const nationalPokedexNumbers =
      (live?.nationalPokedexNumbers as number[] | undefined) ?? [];

    const typesFromLive = (live?.types as string[] | undefined) ?? null;
    const typesFromDb = db ? (JSON.parse(db.types || "[]") as string[]) : [];

    const nameRaw =
      (live?.name as string | undefined) ?? db?.name ?? "Unknown";
    const rarity =
      (live?.rarity as string | undefined) ?? db?.rarity ?? "Common";

    return NextResponse.json({
      card: {
        id,
        name: cleanPokemonName(nameRaw),
        hp: (live?.hp as string | undefined) ?? db?.hp ?? null,
        types: typesFromLive ?? typesFromDb,
        rarity,
        rarityTier: db?.rarityTier ?? getRarityTier(rarity),
        setId:
          ((live?.set as { id?: string } | undefined)?.id as string) ??
          db?.setId ??
          "",
        setName:
          ((live?.set as { name?: string } | undefined)?.name as string) ??
          db?.setName ??
          "",
        setSeries:
          ((live?.set as { series?: string } | undefined)?.series as
            | string
            | undefined) ??
          db?.setSeries ??
          null,
        artist: (live?.artist as string | undefined) ?? db?.artist ?? null,
        imageSmall:
          ((live?.images as { small?: string } | undefined)?.small as
            | string
            | undefined) ??
          db?.imageSmall ??
          null,
        imageLarge:
          ((live?.images as { large?: string } | undefined)?.large as
            | string
            | undefined) ??
          db?.imageLarge ??
          null,
        marketPrice: db?.marketPrice ?? 0,
        releaseDate:
          ((live?.set as { releaseDate?: string } | undefined)
            ?.releaseDate as string | undefined) ??
          db?.releaseDate ??
          null,
        number: (live?.number as string | undefined) ?? db?.number ?? null,
        supertype:
          (live?.supertype as string | undefined) ?? db?.supertype ?? null,
        maxSupply: db?.maxSupply ?? 0,
        remaining: db?.remaining ?? 0,
        // Extended TCG stats
        attacks,
        abilities,
        weaknesses,
        resistances,
        retreatCost: (live?.retreatCost as string[] | undefined) ?? [],
        convertedRetreatCost:
          (live?.convertedRetreatCost as number | undefined) ?? null,
        rules,
        subtypes,
        nationalPokedexNumbers,
        evolvesFrom: (live?.evolvesFrom as string | undefined) ?? null,
        flavorText: (live?.flavorText as string | undefined) ?? null,
        level: (live?.level as string | undefined) ?? null,
        regulationMark: (live?.regulationMark as string | undefined) ?? null,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
