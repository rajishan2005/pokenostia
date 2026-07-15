import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, toPublicUser } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { cleanPokemonName } from "@/lib/pokemon-name";
import { cacheDel } from "@/lib/cache";

const sendSchema = z.object({
  cardId: z.string().min(1),
  toUsername: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/),
  message: z.string().max(120).optional(),
});

/** Send a card free to another trainer by unique username */
export async function POST(req: Request) {
  try {
    await ensureSeeded();
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const body = sendSchema.parse(await req.json());
    const toUsername = body.toUsername.trim();

    if (toUsername.toLowerCase() === session.username.toLowerCase()) {
      return NextResponse.json(
        { error: "You can't send a card to yourself" },
        { status: 400 }
      );
    }

    // Case-insensitive username match (SQLite)
    const candidates = await prisma.user.findMany({
      select: { id: true, username: true, avatar: true },
      take: 4000,
    });
    const hit = candidates.find(
      (u) => u.username.toLowerCase() === toUsername.toLowerCase()
    );
    const target = hit
      ? await prisma.user.findUnique({ where: { id: hit.id } })
      : null;

    if (!target) {
      return NextResponse.json(
        { error: `Trainer @${toUsername} not found` },
        { status: 404 }
      );
    }

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
    if (item.locked && item.quantity <= 1) {
      return NextResponse.json(
        {
          error:
            "This card is starred (kept). Unstar it or send a duplicate copy.",
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
    const free = item.quantity - listed - (item.locked ? 1 : 0);
    if (free < 1) {
      return NextResponse.json(
        {
          error:
            "No free copies — cancel listings or unstar extras before sending",
        },
        { status: 400 }
      );
    }

    const gift = await prisma.$transaction(async (tx) => {
      if (item.quantity <= 1) {
        await tx.collectionItem.delete({ where: { id: item.id } });
      } else {
        await tx.collectionItem.update({
          where: { id: item.id },
          data: { quantity: { decrement: 1 } },
        });
      }

      const existingTo = await tx.collectionItem.findUnique({
        where: {
          userId_cardId: { userId: target!.id, cardId: body.cardId },
        },
      });
      if (existingTo) {
        await tx.collectionItem.update({
          where: { id: existingTo.id },
          data: { quantity: { increment: 1 }, lastPull: new Date() },
        });
      } else {
        await tx.collectionItem.create({
          data: {
            userId: target!.id,
            cardId: body.cardId,
            quantity: 1,
          },
        });
      }

      const g = await tx.cardGift.create({
        data: {
          fromUserId: session.id,
          toUserId: target!.id,
          cardId: body.cardId,
          message: body.message?.trim() || null,
          status: "completed",
        },
      });

      await tx.tradeHistory.create({
        data: {
          userId: session.id,
          cardId: body.cardId,
          type: "gift_sent",
          amount: 0,
          marketPrice: card.marketPrice,
          note: `Sent ${cleanPokemonName(card.name)} to @${target!.username}`,
        },
      });
      await tx.tradeHistory.create({
        data: {
          userId: target!.id,
          cardId: body.cardId,
          type: "gift_received",
          amount: 0,
          marketPrice: card.marketPrice,
          note: `Received ${cleanPokemonName(card.name)} from @${session.username}`,
        },
      });

      // Public feed
      await tx.pullEvent.create({
        data: {
          userId: session.id,
          cardId: body.cardId,
          rarity: `Gift→@${target!.username}`,
          isPublic: true,
        },
      });

      return g;
    });

    void cacheDel("feed:live");
    void cacheDel("gifts:live");

    const me = await prisma.user.findUnique({ where: { id: session.id } });

    return NextResponse.json({
      ok: true,
      gift: {
        id: gift.id,
        toUsername: target.username,
        cardName: cleanPokemonName(card.name),
        cardId: card.id,
      },
      user: me ? toPublicUser(me) : null,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Send failed" }, { status: 500 });
  }
}

/** Live global gift feed + your recent sends/receives */
export async function GET(req: Request) {
  try {
    await ensureSeeded();
    const session = await getSessionUser();
    const { searchParams } = new URL(req.url);
    const mine = searchParams.get("mine") === "1";

    if (mine && session) {
      const gifts = await prisma.cardGift.findMany({
        where: {
          OR: [{ fromUserId: session.id }, { toUserId: session.id }],
        },
        include: {
          fromUser: { select: { username: true, avatar: true } },
          toUser: { select: { username: true, avatar: true } },
          card: true,
        },
        orderBy: { createdAt: "desc" },
        take: 40,
      });
      return NextResponse.json({
        gifts: gifts.map((g) => ({
          id: g.id,
          from: g.fromUser.username,
          fromAvatar: g.fromUser.avatar,
          to: g.toUser.username,
          toAvatar: g.toUser.avatar,
          cardName: cleanPokemonName(g.card.name),
          cardImage: g.card.imageSmall,
          marketPrice: g.card.marketPrice,
          message: g.message,
          direction:
            g.fromUserId === session.id
              ? "sent"
              : ("received" as "sent" | "received"),
          createdAt: g.createdAt.toISOString(),
        })),
      });
    }

    const gifts = await prisma.cardGift.findMany({
      include: {
        fromUser: { select: { username: true, avatar: true } },
        toUser: { select: { username: true, avatar: true } },
        card: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      gifts: gifts.map((g) => ({
        id: g.id,
        from: g.fromUser.username,
        fromAvatar: g.fromUser.avatar,
        to: g.toUser.username,
        toAvatar: g.toUser.avatar,
        cardName: cleanPokemonName(g.card.name),
        cardImage: g.card.imageSmall,
        marketPrice: g.card.marketPrice,
        message: g.message,
        createdAt: g.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ gifts: [] });
  }
}
