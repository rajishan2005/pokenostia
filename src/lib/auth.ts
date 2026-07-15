import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import type { UserPublic } from "@/types";

const COOKIE = "holovault_token";
const secret = () =>
  new TextEncoder().encode(
    process.env.JWT_SECRET || "holovault-dev-secret-change-in-production"
  );

function cookieOptions() {
  // Secure cookies only over HTTPS (Railway / Cloudflare production)
  const secure =
    process.env.NODE_ENV === "production" ||
    process.env.COOKIE_SECURE === "true";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function signToken(userId: string) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export function toPublicUser(u: {
  id: string;
  email: string;
  username: string;
  avatar: string;
  coins: number;
  collectionScore: number;
  totalPacks: number;
  totalRares: number;
  favoriteCardId: string | null;
  loginStreak: number;
  lastLoginDate: string | null;
  birthday: string | null;
  createdAt: Date;
}): UserPublic {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    avatar: u.avatar,
    coins: u.coins,
    collectionScore: u.collectionScore,
    totalPacks: u.totalPacks,
    totalRares: u.totalRares,
    favoriteCardId: u.favoriteCardId,
    loginStreak: u.loginStreak,
    lastLoginDate: u.lastLoginDate,
    birthday: u.birthday,
    createdAt: u.createdAt.toISOString(),
  };
}

/** Prefer this in Route Handlers — Set-Cookie is attached to the response */
export function withAuthCookie<T>(data: T, token: string, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  res.cookies.set(COOKIE, token, cookieOptions());
  return res;
}

export async function setAuthCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE, token, cookieOptions());
}

export async function clearAuthCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export function clearAuthCookieOn(res: NextResponse) {
  res.cookies.set(COOKIE, "", {
    ...cookieOptions(),
    maxAge: 0,
  });
  return res;
}

export async function getSessionUser() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const userId = await verifyToken(token);
  if (!userId) return null;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    return user ? toPublicUser(user) : null;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export { COOKIE };
