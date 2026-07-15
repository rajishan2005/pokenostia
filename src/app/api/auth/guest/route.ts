import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  setAuthCookie,
  signToken,
  toPublicUser,
} from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { verifyCaptcha } from "@/lib/captcha";
import { STARTING_BALANCE } from "@/lib/currency";

const schema = z.object({
  captchaToken: z.string().min(1),
  captchaAnswer: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    await ensureSeeded();
    const body = schema.parse(await req.json());

    const ok = await verifyCaptcha(body.captchaToken, body.captchaAnswer);
    if (!ok) {
      return NextResponse.json(
        { error: "Bot check failed — pick the correct Pokémon" },
        { status: 403 }
      );
    }

    const id = Math.random().toString(36).slice(2, 8);
    const username = `Guest_${id}`;
    const email = `guest_${id}@holovault.local`;
    const password = `guest_${id}_${Date.now()}`;

    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash: await hashPassword(password),
        avatar: "⚡",
        coins: STARTING_BALANCE,
      },
    });

    const token = await signToken(user.id);
    await setAuthCookie(token);
    return NextResponse.json({
      user: toPublicUser(user),
      guest: true,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Guest login failed" }, { status: 500 });
  }
}
