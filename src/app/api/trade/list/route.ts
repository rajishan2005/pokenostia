import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, toPublicUser } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";

const schema = z.object({
  cardId: z.string().min(1),
  price: z.number().positive().max(1_000_000),
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

    const listed = await prisma.marketListing.count({
      where: {
        sellerId: session.id,
        cardId: body.cardId,
        status: "active",
      },
    });
    if (item.quantity - listed < 1) {
      return NextResponse.json(
        { error: "No free copies to list (already listed)" },
        { status: 400 }
      );
    }

    const listing = await prisma.marketListing.create({
      data: {
        sellerId: session.id,
        cardId: body.cardId,
        price: Math.round(body.price * 100) / 100,
        status: "active",
      },
    });

    await prisma.tradeHistory.create({
      data: {
        userId: session.id,
        cardId: body.cardId,
        type: "listed",
        amount: listing.price,
        marketPrice: card.marketPrice,
        note: `Listed ${card.name} for $${listing.price}`,
      },
    });

    const user = await prisma.user.findUnique({ where: { id: session.id } });

    return NextResponse.json({
      ok: true,
      listing: {
        id: listing.id,
        price: listing.price,
        cardId: listing.cardId,
        status: listing.status,
      },
      user: user ? toPublicUser(user) : null,
      suggested: card.marketPrice,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "List failed" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    await ensureSeeded();
    const { searchParams } = new URL(req.url);
    const mine = searchParams.get("mine") === "1";
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const rarity = searchParams.get("rarity") || "all"; // all | rare+ | holo+ | secret+
    const sort = searchParams.get("sort") || "newest"; // newest | price_asc | price_desc | name
    const session = await getSessionUser();

    const rarityMin =
      rarity === "secret+"
        ? 8
        : rarity === "holo+"
          ? 4
          : rarity === "rare+"
            ? 3
            : 0;

    if (mine) {
      if (!session) {
        return NextResponse.json({ listings: [] });
      }
      let listings = await prisma.marketListing.findMany({
        where: { sellerId: session.id, status: "active" },
        include: { card: true },
        orderBy: { createdAt: "desc" },
      });
      if (q) {
        listings = listings.filter((l) =>
          l.card.name.toLowerCase().includes(q)
        );
      }
      if (rarityMin > 0) {
        listings = listings.filter((l) => l.card.rarityTier >= rarityMin);
      }
      return NextResponse.json({
        listings: listings.map((l) => ({
          id: l.id,
          price: l.price,
          status: l.status,
          createdAt: l.createdAt.toISOString(),
          mine: true,
          card: {
            id: l.card.id,
            name: l.card.name,
            imageSmall: l.card.imageSmall,
            marketPrice: l.card.marketPrice,
            rarity: l.card.rarity,
            rarityTier: l.card.rarityTier,
          },
        })),
      });
    }

    let listings = await prisma.marketListing.findMany({
      where: { status: "active" },
      include: {
        card: true,
        seller: { select: { id: true, username: true, avatar: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    if (q) {
      listings = listings.filter((l) =>
        l.card.name.toLowerCase().includes(q)
      );
    }
    if (rarityMin > 0) {
      listings = listings.filter((l) => l.card.rarityTier >= rarityMin);
    }

    if (sort === "price_asc") listings.sort((a, b) => a.price - b.price);
    else if (sort === "price_desc") listings.sort((a, b) => b.price - a.price);
    else if (sort === "name")
      listings.sort((a, b) => a.card.name.localeCompare(b.card.name));
    else if (sort === "rarity")
      listings.sort((a, b) => b.card.rarityTier - a.card.rarityTier);

    return NextResponse.json({
      listings: listings.slice(0, 80).map((l) => ({
        id: l.id,
        price: l.price,
        createdAt: l.createdAt.toISOString(),
        mine: session?.id === l.sellerId,
        seller: l.seller,
        card: {
          id: l.card.id,
          name: l.card.name,
          imageSmall: l.card.imageSmall,
          marketPrice: l.card.marketPrice,
          rarity: l.card.rarity,
          rarityTier: l.card.rarityTier,
        },
      })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ listings: [] });
  }
}
