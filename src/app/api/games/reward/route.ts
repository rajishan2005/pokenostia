import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, toPublicUser } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";

const schema = z.object({
  gameId: z.enum([
    "memory",
    "reaction",
    "trivia",
    "puzzle",
    "guess",
    "spot",
    "wheel",
    "treasure",
  ]),
  score: z.number().int().min(0).max(100000),
});

/** Pikadollar rewards — skill only, small enough that packs ($5–$8) feel earned */
const GAME_CAPS: Record<string, { base: number; max: number }> = {
  memory: { base: 1, max: 4 },
  reaction: { base: 1, max: 3 },
  trivia: { base: 1, max: 5 },
  puzzle: { base: 1, max: 4 },
  guess: { base: 1, max: 3 },
  spot: { base: 1, max: 4 },
  wheel: { base: 1, max: 3 },
  treasure: { base: 2, max: 6 },
};

export async function POST(req: Request) {
  try {
    await ensureSeeded();
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const body = schema.parse(await req.json());
    const cap = GAME_CAPS[body.gameId];
    if (!cap) {
      return NextResponse.json({ error: "Unknown game" }, { status: 400 });
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const plays = await prisma.gameScore.count({
      where: {
        userId: session.id,
        gameId: body.gameId,
        createdAt: { gte: since },
      },
    });
    if (plays >= 15) {
      return NextResponse.json(
        { error: "Daily play limit reached for this game", coins: 0 },
        { status: 429 }
      );
    }

    const ratio = Math.min(1, body.score / 1000);
    const coins = Math.min(
      cap.max,
      Math.max(1, Math.round(cap.base + ratio * (cap.max - cap.base)))
    );

    await prisma.gameScore.create({
      data: {
        userId: session.id,
        gameId: body.gameId,
        score: body.score,
        coinsEarned: coins,
      },
    });

    const user = await prisma.user.update({
      where: { id: session.id },
      data: { coins: { increment: coins } },
    });

    return NextResponse.json({
      coins,
      user: toPublicUser(user),
      playsToday: plays + 1,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Reward failed" }, { status: 500 });
  }
}
