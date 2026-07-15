import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSeeded } from "@/lib/seed";
import { getSessionUser } from "@/lib/auth";

/** Search trainers by unique username (for gifts / trade) */
export async function GET(req: Request) {
  try {
    await ensureSeeded();
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim().replace(/^@/, "");
    if (q.length < 1) {
      return NextResponse.json({ users: [] });
    }

    const me = await getSessionUser();
    const users = await prisma.user.findMany({
      where: {
        AND: [
          { username: { contains: q } },
          { NOT: { email: { endsWith: "@bot.holovault.local" } } },
          ...(me ? [{ NOT: { id: me.id } }] : []),
        ],
      },
      select: {
        id: true,
        username: true,
        avatar: true,
        totalPacks: true,
        collectionScore: true,
      },
      take: 20,
      orderBy: { username: "asc" },
    });

    const lower = q.toLowerCase();
    const filtered = users
      .filter((u) => u.username.toLowerCase().includes(lower))
      .slice(0, 12);

    return NextResponse.json({
      users: filtered.map((u) => ({
        username: u.username,
        avatar: u.avatar,
        totalPacks: u.totalPacks,
        collectionScore: u.collectionScore,
      })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ users: [] });
  }
}
