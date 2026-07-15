import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, toPublicUser } from "@/lib/auth";
import {
  generatePack,
  commitPull,
  isHookPack,
} from "@/lib/pack-engine";
import { checkAndGrantAchievements } from "@/lib/achievements";
import { ensureSeeded, ensureShopPacks } from "@/lib/seed";
import { cacheDel } from "@/lib/cache";
import {
  getShopPack,
  highRareChanceForPrice,
  isShopPackId,
} from "@/lib/shop-packs";

const schema = z.object({
  expansionId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    await ensureSeeded();
    await ensureShopPacks();
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const body = schema.parse(await req.json());

    // Only the 7 shop packs are buyable
    if (!isShopPackId(body.expansionId)) {
      return NextResponse.json(
        { error: "That pack is not in the shop" },
        { status: 400 }
      );
    }

    const [expansion, user] = await Promise.all([
      prisma.expansion.findUnique({ where: { id: body.expansionId } }),
      prisma.user.findUnique({ where: { id: session.id } }),
    ]);

    if (!expansion || !expansion.active) {
      return NextResponse.json({ error: "Unknown expansion" }, { status: 404 });
    }
    if (!user) {
      return NextResponse.json({ error: "User missing" }, { status: 401 });
    }
    if (user.coins < expansion.packCost) {
      return NextResponse.json(
        {
          error: "Not enough Pikadollars",
          need: expansion.packCost,
          have: user.coins,
        },
        { status: 402 }
      );
    }

    const shop = getShopPack(expansion.id);
    const packSize = shop?.packSize ?? 10;
    const highRareChance = highRareChanceForPrice(expansion.packCost);
    // Soft onboarding hooks still help early players
    const forceSuperRare = isHookPack(user.totalPacks, user.id);

    const cardsPromise = generatePack(expansion.id, packSize, {
      forceSuperRare,
      highRareChance,
      packCost: expansion.packCost,
    });
    const ownedPromise = prisma.collectionItem.findMany({
      where: { userId: user.id },
      select: { cardId: true },
    });
    const spendPromise = prisma.user.update({
      where: { id: user.id },
      data: { coins: { decrement: expansion.packCost } },
    });

    const [cards, owned] = await Promise.all([
      cardsPromise,
      ownedPromise,
      spendPromise,
    ]);

    if (cards.length === 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: { coins: { increment: expansion.packCost } },
      });
      return NextResponse.json({ error: "No cards available" }, { status: 503 });
    }

    const ownedSet = new Set(owned.map((o) => o.cardId));

    const { opening, user: updated } = await commitPull(
      user.id,
      expansion.id,
      cards
    );

    const refreshed = cards.map((c) => ({
      ...c,
      remaining: Math.max(0, c.remaining),
      isNew: !ownedSet.has(c.id),
    }));

    const achievements = await checkAndGrantAchievements(user.id);
    void cacheDel("feed:live");

    return NextResponse.json({
      openingId: opening.id,
      cards: refreshed,
      user: toPublicUser(updated),
      achievements,
      packCost: expansion.packCost,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Pack open failed" }, { status: 500 });
  }
}
