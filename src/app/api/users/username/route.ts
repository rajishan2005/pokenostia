import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, toPublicUser } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";

const schema = z.object({
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, underscore only"),
});

/** Change your unique trainer tag */
export async function POST(req: Request) {
  try {
    await ensureSeeded();
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const body = schema.parse(await req.json());
    const username = body.username.trim();

    const taken = await prisma.user.findFirst({
      where: {
        username: { equals: username },
        NOT: { id: session.id },
      },
    });
    // Case-insensitive uniqueness for display tags
    if (!taken) {
      const sample = await prisma.user.findMany({
        where: { NOT: { id: session.id } },
        select: { username: true },
        take: 2000,
      });
      if (
        sample.some((u) => u.username.toLowerCase() === username.toLowerCase())
      ) {
        return NextResponse.json(
          { error: "That trainer name is already taken" },
          { status: 409 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "That trainer name is already taken" },
        { status: 409 }
      );
    }

    const user = await prisma.user.update({
      where: { id: session.id },
      data: { username },
    });

    return NextResponse.json({ ok: true, user: toPublicUser(user) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Could not update username" }, { status: 500 });
  }
}

/** Check availability */
export async function GET(req: Request) {
  try {
    await ensureSeeded();
    const q = new URL(req.url).searchParams.get("username")?.trim() || "";
    if (q.length < 3) {
      return NextResponse.json({ available: false, reason: "Too short" });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(q)) {
      return NextResponse.json({
        available: false,
        reason: "Letters, numbers, _ only",
      });
    }
    const me = await getSessionUser();
    const all = await prisma.user.findMany({
      select: { id: true, username: true },
      take: 3000,
    });
    const clash = all.find(
      (u) =>
        u.username.toLowerCase() === q.toLowerCase() &&
        (!me || u.id !== me.id)
    );
    return NextResponse.json({
      available: !clash,
      reason: clash ? "Taken" : "Available",
    });
  } catch {
    return NextResponse.json({ available: false });
  }
}
