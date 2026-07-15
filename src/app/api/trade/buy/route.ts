import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, toPublicUser } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";

const schema = z.object({
  listingId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    await ensureSeeded();
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const body = schema.parse(await req.json());
    const listing = await prisma.marketListing.findUnique({
      where: { id: body.listingId },
      include: { card: true },
    });
    if (!listing || listing.status !== "active") {
      return NextResponse.json(
        { error: "Listing not available" },
        { status: 404 }
      );
    }
    if (listing.sellerId === session.id) {
      return NextResponse.json(
        { error: "Can't buy your own listing" },
        { status: 400 }
      );
    }

    const buyer = await prisma.user.findUnique({ where: { id: session.id } });
    if (!buyer || buyer.coins < listing.price) {
      return NextResponse.json(
        { error: "Not enough Pikadollars" },
        { status: 402 }
      );
    }

    const price = Math.ceil(listing.price);

    const updatedBuyer = await prisma.$transaction(async (tx) => {
      const still = await tx.marketListing.findUnique({
        where: { id: listing.id },
      });
      if (!still || still.status !== "active") {
        throw new Error("GONE");
      }

      await tx.marketListing.update({
        where: { id: listing.id },
        data: {
          status: "sold",
          buyerId: session.id,
          soldAt: new Date(),
        },
      });

      // Seller loses 1 copy
      const sellerItem = await tx.collectionItem.findUnique({
        where: {
          userId_cardId: {
            userId: listing.sellerId,
            cardId: listing.cardId,
          },
        },
      });
      if (sellerItem) {
        if (sellerItem.quantity <= 1) {
          await tx.collectionItem.delete({ where: { id: sellerItem.id } });
        } else {
          await tx.collectionItem.update({
            where: { id: sellerItem.id },
            data: { quantity: { decrement: 1 } },
          });
        }
      }

      // Buyer gains card
      const buyerItem = await tx.collectionItem.findUnique({
        where: {
          userId_cardId: {
            userId: session.id,
            cardId: listing.cardId,
          },
        },
      });
      if (buyerItem) {
        await tx.collectionItem.update({
          where: { id: buyerItem.id },
          data: { quantity: { increment: 1 }, lastPull: new Date() },
        });
      } else {
        await tx.collectionItem.create({
          data: {
            userId: session.id,
            cardId: listing.cardId,
            quantity: 1,
          },
        });
      }

      await tx.user.update({
        where: { id: listing.sellerId },
        data: { coins: { increment: price } },
      });

      await tx.tradeHistory.create({
        data: {
          userId: listing.sellerId,
          cardId: listing.cardId,
          type: "sold",
          amount: price,
          marketPrice: listing.card.marketPrice,
          note: `Sold ${listing.card.name} on market`,
        },
      });
      await tx.tradeHistory.create({
        data: {
          userId: session.id,
          cardId: listing.cardId,
          type: "bought",
          amount: price,
          marketPrice: listing.card.marketPrice,
          note: `Bought ${listing.card.name}`,
        },
      });

      return tx.user.update({
        where: { id: session.id },
        data: { coins: { decrement: price } },
      });
    });

    return NextResponse.json({
      ok: true,
      paid: price,
      cardName: listing.card.name,
      user: toPublicUser(updatedBuyer),
    });
  } catch (e) {
    if (e instanceof Error && e.message === "GONE") {
      return NextResponse.json(
        { error: "Listing already sold" },
        { status: 409 }
      );
    }
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Buy failed" }, { status: 500 });
  }
}
