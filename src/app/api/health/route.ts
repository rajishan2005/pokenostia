import { NextResponse } from "next/server";

/**
 * Lightweight healthcheck for Railway / Docker.
 * Does NOT run ensureSeeded (that can take minutes on cold start).
 */
export async function GET() {
  return NextResponse.json(
    { ok: true, service: "pokenostia", ts: Date.now() },
    { status: 200 }
  );
}
