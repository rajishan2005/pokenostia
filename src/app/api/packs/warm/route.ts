import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureSeeded } from "@/lib/seed";
import { getPoolThumbs, warmPackPool } from "@/lib/pack-engine";

const schema = z.object({
  expansionId: z.string().min(1),
});

/** Prefetch card pool + thumb URLs when user selects a pack */
export async function POST(req: Request) {
  try {
    await ensureSeeded();
    const body = schema.parse(await req.json());
    const [n, thumbs] = await Promise.all([
      warmPackPool(body.expansionId),
      getPoolThumbs(body.expansionId, 90),
    ]);
    return NextResponse.json({ ok: true, cards: n, thumbs });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
