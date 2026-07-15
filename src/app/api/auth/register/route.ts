import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  signToken,
  toPublicUser,
  withAuthCookie,
} from "@/lib/auth";
import { ensureAuthReady } from "@/lib/seed";
import { verifyCaptcha } from "@/lib/captcha";
import { STARTING_BALANCE } from "@/lib/currency";

const schema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(6).max(72),
  avatar: z.string().max(4).optional(),
  captchaToken: z.string().min(1),
  captchaAnswer: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    await ensureAuthReady();
    const body = schema.parse(await req.json());

    const captchaOk = await verifyCaptcha(body.captchaToken, body.captchaAnswer);
    if (!captchaOk) {
      return NextResponse.json(
        { error: "Bot check failed — pick the correct Pokémon" },
        { status: 403 }
      );
    }

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: body.email }, { username: body.username }],
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Email or username already taken" },
        { status: 409 }
      );
    }
    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        username: body.username,
        passwordHash: await hashPassword(body.password),
        avatar: body.avatar || "✨",
        coins: STARTING_BALANCE,
      },
    });
    const token = await signToken(user.id);
    return withAuthCookie({ user: toPublicUser(user) }, token);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
