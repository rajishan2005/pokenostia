"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { rarityColor, normalizeRarity } from "@/lib/rarity";
import { formatPrice } from "@/lib/utils";

interface FeedItem {
  id: string;
  username: string;
  avatar: string;
  cardName: string;
  cardImage: string | null;
  rarity: string;
  rarityTier: number;
  marketPrice: number;
  createdAt: string;
}

export function LiveFeed({ compact = false }: { compact?: boolean }) {
  const [feed, setFeed] = useState<FeedItem[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/feed");
        const data = await res.json();
        if (alive) setFeed(data.feed ?? []);
      } catch {
        /* ignore */
      }
    };
    load();
    const t = setInterval(load, 12000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (!feed.length) {
    return (
      <div className="glass rounded-2xl p-4 text-sm text-white/50">
        Live rare pulls will appear here as collectors open packs worldwide.
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <AnimatePresence initial={false}>
        {feed.slice(0, compact ? 6 : 12).map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="glass flex items-center gap-3 rounded-xl p-3"
          >
            <span className="text-xl">{item.avatar}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm truncate">
                <span className="font-semibold text-white/90">
                  {item.username}
                </span>{" "}
                pulled{" "}
                <span className="font-semibold" style={{ color: rarityColor(item.rarityTier) }}>
                  {item.cardName}
                </span>
              </p>
              <p className="text-[11px] text-white/45">
                {normalizeRarity(item.rarity)} · {formatPrice(item.marketPrice)}
              </p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
