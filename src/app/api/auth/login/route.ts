import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  signToken,
  toPublicUser,
  verifyPassword,
  withAuthCookie,
} from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { dateKey } from "@/lib/utils";
import { verifyCaptcha } from "@/lib/captcha";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  captchaToken: z.string().min(1),
  captchaAnswer: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    await ensureSeeded();
    const body = schema.parse(await req.json());

    const captchaOk = await verifyCaptcha(body.captchaToken, body.captchaAnswer);
    if (!captchaOk) {
      return NextResponse.json(
        { error: "Bot check failed — pick the correct Pokémon" },
        { status: 403 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Login streak
    const today = dateKey();
    let streak = user.loginStreak;
    if (user.lastLoginDate !== today) {
      const yesterday = dateKey(new Date(Date.now() - 86400000));
      streak =
        user.lastLoginDate === yesterday ? user.loginStreak + 1 : 1;
      await prisma.user.update({
        where: { id: user.id },
        data: { loginStreak: streak, lastLoginDate: today },
      });
      user.loginStreak = streak;
      user.lastLoginDate = today;
    }

    const token = await signToken(user.id);
    // Must set cookie on the response for Railway/production to keep session
    return withAuthCookie({ user: toPublicUser(user) }, token);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
