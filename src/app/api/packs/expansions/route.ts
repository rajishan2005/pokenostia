import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSeeded, ensureShopPacks } from "@/lib/seed";
import { SHOP_PACKS, highRareChanceForPrice } from "@/lib/shop-packs";

export async function GET() {
  try {
    await ensureSeeded();
    await ensureShopPacks();

    const rows = await prisma.expansion.findMany({
      where: { id: { in: SHOP_PACKS.map((p) => p.id) }, active: true },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));

    // Catalog size for “variety” label
    const availableCards = await prisma.card.count({
      where: { remaining: { gt: 0 } },
    });

    const expansions = SHOP_PACKS.map((def) => {
      const row = byId.get(def.id);
      const cost = row?.packCost ?? def.packCost;
      const chance = highRareChanceForPrice(cost);
      return {
        id: def.id,
        name: def.name,
        series: def.series,
        releaseDate: row?.releaseDate ?? "2024/01/01",
        totalCards: availableCards,
        packSize: def.packSize,
        packCost: cost,
        imageUrl: row?.imageUrl ?? null,
        logoUrl: row?.logoUrl ?? null,
        active: true,
        availableCards,
        icon: def.icon,
        tagline: def.tagline,
        theme: def.theme,
        banner: def.banner,
        highRareChance: Math.round(chance * 1000) / 10, // percent 1 decimal
        order: def.order,
      };
    }).sort((a, b) => a.order - b.order);

    return NextResponse.json({ expansions });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ expansions: [] });
  }
}
