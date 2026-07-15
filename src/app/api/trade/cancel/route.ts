import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
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
        { error: "Listing not found or already closed" },
        { status: 404 }
      );
    }
    if (listing.sellerId !== session.id) {
      return NextResponse.json({ error: "Not your listing" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.marketListing.update({
        where: { id: listing.id },
        data: { status: "cancelled" },
      });
      await tx.tradeHistory.create({
        data: {
          userId: session.id,
          cardId: listing.cardId,
          type: "cancelled",
          amount: 0,
          marketPrice: listing.card.marketPrice,
          note: `Cancelled listing for ${listing.card.name}`,
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Cancel failed" }, { status: 500 });
  }
}
