import { NextResponse } from "next/server";
import {
  clearAuthCookie,
  clearAuthCookieOn,
  getSessionUser,
} from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";

export async function GET() {
  try {
    await ensureSeeded();
    const user = await getSessionUser();
    return NextResponse.json({ user });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ user: null });
  }
}

export async function DELETE() {
  await clearAuthCookie();
  const res = NextResponse.json({ ok: true });
  return clearAuthCookieOn(res);
}
