import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";

const schema = z.object({
  cardId: z.string().min(1),
  locked: z.boolean(),
});

/** Star / unstar a collection card (locked = keep, skip quick-sell). */
export async function POST(req: Request) {
  try {
    await ensureSeeded();
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const body = schema.parse(await req.json());
    const item = await prisma.collectionItem.findUnique({
      where: {
        userId_cardId: { userId: session.id, cardId: body.cardId },
      },
    });
    if (!item) {
      return NextResponse.json(
        { error: "Card not in your collection" },
        { status: 404 }
      );
    }

    const updated = await prisma.collectionItem.update({
      where: { id: item.id },
      data: { locked: body.locked },
    });

    return NextResponse.json({
      ok: true,
      cardId: updated.cardId,
      locked: updated.locked,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
