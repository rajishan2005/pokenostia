import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, toPublicUser } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { dateKey } from "@/lib/utils";
import { checkAndGrantAchievements } from "@/lib/achievements";

/** Daily Pikadollar streak table */
const STREAK_BONUS = [2, 3, 3, 4, 5, 6, 8];

export async function GET() {
  try {
    await ensureSeeded();
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const today = dateKey();
    const claims = await prisma.dailyRewardClaim.findMany({
      where: { userId: session.id, dateKey: today },
    });
    const user = await prisma.user.findUnique({ where: { id: session.id } });
    const achievements = await prisma.userAchievement.findMany({
      where: { userId: session.id },
      include: { achievement: true },
    });

    return NextResponse.json({
      claimed: claims.map((c) => c.rewardType),
      streak: user?.loginStreak ?? 0,
      achievements: achievements.map((a) => ({
        ...a.achievement,
        unlockedAt: a.unlockedAt.toISOString(),
      })),
      canClaimDaily: !claims.some((c) => c.rewardType === "daily"),
      canClaimMystery:
        (user?.loginStreak ?? 0) >= 3 &&
        !claims.some((c) => c.rewardType === "mystery"),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureSeeded();
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const { type } = (await req.json()) as { type?: string };
    const rewardType = type || "daily";
    const today = dateKey();

    const exists = await prisma.dailyRewardClaim.findUnique({
      where: {
        userId_dateKey_rewardType: {
          userId: session.id,
          dateKey: today,
          rewardType,
        },
      },
    });
    if (exists) {
      return NextResponse.json({ error: "Already claimed" }, { status: 409 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) {
      return NextResponse.json({ error: "User missing" }, { status: 401 });
    }

    let coins = 2;
    if (rewardType === "daily") {
      const idx = Math.min(user.loginStreak, STREAK_BONUS.length) - 1;
      coins = STREAK_BONUS[Math.max(0, idx)] ?? 2;
    } else if (rewardType === "mystery") {
      if (user.loginStreak < 3) {
        return NextResponse.json(
          { error: "Need 3-day streak for mystery Pikadollars" },
          { status: 403 }
        );
      }
      coins = 3 + Math.floor(Math.random() * 6); // $3–$8
    } else if (rewardType === "weekly") {
      if (user.loginStreak < 7) {
        return NextResponse.json(
          { error: "Need 7-day streak" },
          { status: 403 }
        );
      }
      coins = 15;
    } else if (rewardType === "birthday") {
      const bd = user.birthday;
      const md = today.slice(5);
      if (!bd || bd.slice(5) !== md) {
        return NextResponse.json(
          { error: "Not your birthday" },
          { status: 403 }
        );
      }
      coins = 25;
    }

    await prisma.dailyRewardClaim.create({
      data: {
        userId: session.id,
        dateKey: today,
        rewardType,
        coins,
      },
    });

    const updated = await prisma.user.update({
      where: { id: session.id },
      data: { coins: { increment: coins } },
    });

    const newAchievements = await checkAndGrantAchievements(session.id);

    return NextResponse.json({
      coins,
      user: toPublicUser(updated),
      achievements: newAchievements,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Claim failed" }, { status: 500 });
  }
}
