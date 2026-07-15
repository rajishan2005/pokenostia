"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { HoloCard } from "@/components/ui/HoloCard";
import { formatPrice } from "@/lib/utils";
import { useUserStore } from "@/store/user-store";

interface HistoryItem {
  id: string;
  expansionId: string;
  rarestTier: number;
  totalValue: number;
  createdAt: string;
  cards: {
    id: string;
    name: string;
    rarity: string;
    rarityTier: number;
    imageSmall: string | null;
    marketPrice: number;
    remaining: number;
    maxSupply: number;
  }[];
}

export default function HistoryPage() {
  const { user, loading } = useUserStore();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [replay, setReplay] = useState<HistoryItem | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch("/api/history")
      .then((r) => r.json())
      .then((d) => setHistory(d.history || []));
  }, [user]);

  if (!loading && !user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-white/60">Login to see pack history.</p>
        <Link href="/login" className="btn-primary mt-4 inline-flex rounded-xl px-5 py-2.5 text-sm">
          Login
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold text-gradient">Pack History</h1>
      <p className="mt-1 text-white/55 mb-8">
        Replay favorite pulls · share-ready layouts
      </p>

      <div className="space-y-4">
        {history.map((h) => (
          <GlassCard key={h.id} hover={false} className="!p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <p className="font-medium">{h.expansionId}</p>
                <p className="text-xs text-white/45">
                  {new Date(h.createdAt).toLocaleString()} ·{" "}
                  {formatPrice(h.totalValue)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReplay(replay?.id === h.id ? null : h)}
                className="btn-ghost rounded-lg px-3 py-1.5 text-xs"
              >
                {replay?.id === h.id ? "Hide" : "Replay"}
              </button>
            </div>
            {replay?.id === h.id && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {h.cards.map((c) => (
                  <HoloCard
                    key={c.id + c.name}
                    name={c.name}
                    image={c.imageSmall}
                    rarity={c.rarity}
                    rarityTier={c.rarityTier}
                    marketPrice={c.marketPrice}
                    remaining={c.remaining}
                    maxSupply={c.maxSupply}
                    size="sm"
                  />
                ))}
              </div>
            )}
          </GlassCard>
        ))}
        {!history.length && (
          <p className="text-white/45 text-sm">No openings yet.</p>
        )}
      </div>
    </div>
  );
}
