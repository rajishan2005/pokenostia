"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatPrice } from "@/lib/utils";
import { APP_NAME } from "@/lib/brand";

export default function ShareCardPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const [card, setCard] = useState<{
    name: string;
    rarity: string;
    rarityTier: number;
    marketPrice: number;
    imageLarge: string | null;
    imageSmall: string | null;
    setName: string;
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/cards/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((d) => {
        const c = d.card || d;
        if (c?.name) setCard(c);
        else setCard(null);
      })
      .catch(() => setCard(null));
  }, [id]);

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <p className="mb-4 text-center text-xs uppercase tracking-[0.25em] text-white/40">
        Shared from {APP_NAME}
      </p>
      <GlassCard strong hover={false} className="text-center">
        {!card && <div className="skeleton mx-auto h-64 w-44 rounded-xl" />}
        {card && (
          <>
            {(card.imageLarge || card.imageSmall) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.imageLarge || card.imageSmall || ""}
                alt={card.name}
                className="mx-auto h-72 w-auto rounded-xl border border-white/15 shadow-2xl"
              />
            )}
            <h1 className="mt-5 text-2xl font-bold">{card.name}</h1>
            <p className="text-sm text-white/50">{card.setName}</p>
            <p className="mt-2 text-amber-200">{formatPrice(card.marketPrice)}</p>
            <p className="text-xs text-white/40">{card.rarity}</p>
          </>
        )}
        <Link
          href="/open"
          className="btn-primary mt-6 inline-flex rounded-xl px-5 py-2.5 text-sm"
        >
          Open packs yourself
        </Link>
      </GlassCard>
    </div>
  );
}
