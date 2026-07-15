import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSeeded } from "@/lib/seed";
import { generatePriceHistory } from "@/lib/price-history";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSeeded();
    const { id } = await ctx.params;
    const card = await prisma.card.findUnique({ where: { id } });
    if (!card) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const history = generatePriceHistory(card.id, card.marketPrice, 30);
    const prices = history.map((h) => h.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const first = prices[0] ?? card.marketPrice;
    const changePct =
      first > 0 ? ((card.marketPrice - first) / first) * 100 : 0;

    return NextResponse.json({
      history,
      marketPrice: card.marketPrice,
      min,
      max,
      changePct: Math.round(changePct * 10) / 10,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ history: [] });
  }
}
