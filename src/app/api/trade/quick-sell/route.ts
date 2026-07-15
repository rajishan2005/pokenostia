import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, toPublicUser } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { quickSellMultiplier } from "@/lib/price-history";

const schema = z.object({
  cardId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    await ensureSeeded();
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const body = schema.parse(await req.json());
    const card = await prisma.card.findUnique({ where: { id: body.cardId } });
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const item = await prisma.collectionItem.findUnique({
      where: {
        userId_cardId: { userId: session.id, cardId: body.cardId },
      },
    });
    if (!item || item.quantity < 1) {
      return NextResponse.json(
        { error: "You don't own this card" },
        { status: 400 }
      );
    }
    if (item.locked) {
      return NextResponse.json(
        {
          error:
            "This card is starred (kept). Unstar it in Collection to sell.",
        },
        { status: 400 }
      );
    }

    const listed = await prisma.marketListing.count({
      where: {
        sellerId: session.id,
        cardId: body.cardId,
        status: "active",
      },
    });
    const available = item.quantity - listed;
    if (available < 1) {
      return NextResponse.json(
        { error: "All copies are listed for sale. Cancel a listing first." },
        { status: 400 }
      );
    }

    const mult = quickSellMultiplier(`${session.id}:${body.cardId}`);
    const payout = Math.max(1, Math.round(card.marketPrice * mult));
    const percent = Math.round(mult * 100);

    const result = await prisma.$transaction(async (tx) => {
      if (item.quantity <= 1) {
        await tx.collectionItem.delete({ where: { id: item.id } });
      } else {
        await tx.collectionItem.update({
          where: { id: item.id },
          data: { quantity: { decrement: 1 } },
        });
      }
      await tx.tradeHistory.create({
        data: {
          userId: session.id,
          cardId: body.cardId,
          type: "quick_sell",
          amount: payout,
          marketPrice: card.marketPrice,
          percent,
          note: `Quick sold ${card.name}`,
        },
      });
      return tx.user.update({
        where: { id: session.id },
        data: { coins: { increment: payout } },
      });
    });

    return NextResponse.json({
      ok: true,
      payout,
      percent,
      marketPrice: card.marketPrice,
      user: toPublicUser(result),
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Quick sell failed" }, { status: 500 });
  }
}
