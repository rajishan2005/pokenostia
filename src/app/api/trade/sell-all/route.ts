import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, toPublicUser } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { quickSellMultiplier } from "@/lib/price-history";

const bodySchema = z.object({
  /** If set, only sell these card ids (e.g. just-opened pack). Else entire collection. */
  cardIds: z.array(z.string()).optional(),
});

/**
 * Instantly quick-sell free (unlisted) copies — whole collection or specific cards.
 */
export async function POST(req: Request) {
  try {
    await ensureSeeded();
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const raw = await req.json().catch(() => ({}));
    const body = bodySchema.parse(raw);

    const items = await prisma.collectionItem.findMany({
      where: {
        userId: session.id,
        ...(body.cardIds?.length
          ? { cardId: { in: body.cardIds } }
          : {}),
      },
      include: { card: true },
    });
    if (!items.length) {
      return NextResponse.json(
        { error: body.cardIds?.length ? "Those cards aren't in your collection" : "Collection is empty" },
        { status: 400 }
      );
    }

    const listings = await prisma.marketListing.findMany({
      where: { sellerId: session.id, status: "active" },
      select: { cardId: true },
    });
    const listedCount = new Map<string, number>();
    for (const l of listings) {
      listedCount.set(l.cardId, (listedCount.get(l.cardId) || 0) + 1);
    }

    let totalPayout = 0;
    let soldCount = 0;
    const sold: { name: string; payout: number; percent: number }[] = [];

    const user = await prisma.$transaction(async (tx) => {
      for (const item of items) {
        // Starred / kept cards never auto-sell
        if (item.locked) continue;
        const reserved = listedCount.get(item.cardId) || 0;
        let free = item.quantity - reserved;
        if (free <= 0) continue;

        let itemPayout = 0;
        for (let i = 0; i < free; i++) {
          const mult = quickSellMultiplier(
            `${session.id}:${item.cardId}:${i}:${Date.now()}`
          );
          const payout = Math.max(1, Math.round(item.card.marketPrice * mult));
          itemPayout += payout;
          soldCount++;
          await tx.tradeHistory.create({
            data: {
              userId: session.id,
              cardId: item.cardId,
              type: "sell_all",
              amount: payout,
              marketPrice: item.card.marketPrice,
              percent: Math.round(mult * 100),
              note: `Sell-all ${item.card.name}`,
            },
          });
        }
        totalPayout += itemPayout;
        sold.push({
          name: item.card.name,
          payout: itemPayout,
          percent: Math.round((itemPayout / Math.max(1, free * item.card.marketPrice)) * 100),
        });

        const remainingQty = reserved;
        if (remainingQty <= 0) {
          await tx.collectionItem.delete({ where: { id: item.id } });
        } else {
          await tx.collectionItem.update({
            where: { id: item.id },
            data: { quantity: remainingQty },
          });
        }
      }

      if (soldCount === 0) {
        throw new Error("NOTHING_FREE");
      }

      return tx.user.update({
        where: { id: session.id },
        data: { coins: { increment: totalPayout } },
      });
    });

    return NextResponse.json({
      ok: true,
      soldCount,
      totalPayout,
      sold: sold.slice(0, 20),
      user: toPublicUser(user),
    });
  } catch (e) {
    if (e instanceof Error && e.message === "NOTHING_FREE") {
      return NextResponse.json(
        {
          error:
            "Nothing free to sell — cards may be starred (kept) or listed. Unstar or cancel listings first.",
        },
        { status: 400 }
      );
    }
    console.error(e);
    return NextResponse.json({ error: "Sell all failed" }, { status: 500 });
  }
}
