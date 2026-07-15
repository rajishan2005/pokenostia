"use client";

import { useEffect, useState } from "react";
import { PackOpening } from "@/components/pack/PackOpening";
import { GlassCard } from "@/components/ui/GlassCard";
import type { ExpansionData } from "@/types";
import { cn } from "@/lib/utils";
import { formatPika } from "@/lib/currency";
import { useUserStore } from "@/store/user-store";
import {
  isMuted,
  loadMutePref,
  play,
  setMuted,
  unlockAudio,
} from "@/lib/sounds";
import Link from "next/link";
import { Volume2, VolumeX } from "lucide-react";
import { preloadImageUrls } from "@/lib/image-cache";

function packFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("pack");
}

/** Warm server pool + browser image cache before the user clicks Open */
function warmPack(expansionId: string) {
  void fetch("/api/packs/warm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expansionId }),
  })
    .then((r) => r.json())
    .then((d) => {
      if (Array.isArray(d.thumbs) && d.thumbs.length) {
        void preloadImageUrls(d.thumbs as string[]);
      }
    })
    .catch(() => {});
}

export default function OpenPage() {
  const [expansions, setExpansions] = useState<
    (ExpansionData & { availableCards?: number })[]
  >([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [muted, setMutedState] = useState(false);
  const { user, loading } = useUserStore();

  useEffect(() => {
    setMutedState(loadMutePref());
    const packParam = packFromUrl();
    fetch("/api/packs/expansions")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.expansions || []) as (ExpansionData & {
          availableCards?: number;
          order?: number;
        })[];
        const sorted = [...list].sort(
          (a, b) => (a.order ?? 0) - (b.order ?? 0)
        );
        setExpansions(sorted);
        const fromUrl =
          packParam && sorted.find((e) => e.id === packParam);
        const pick = fromUrl ?? sorted[0];
        if (pick) {
          setSelected(pick.id);
          warmPack(pick.id);
          // Prefetch other packs' art in the background too
          for (const e of sorted.slice(0, 4)) {
            if (e.id !== pick.id) warmPack(e.id);
          }
        }
      })
      .catch(() => setExpansions([]));
  }, []);

  const expansion = expansions.find((e) => e.id === selected) ?? null;

  const pickExpansion = (id: string) => {
    unlockAudio();
    play("click");
    setSelected(id);
    warmPack(id);
  };

  const toggleMute = () => {
    unlockAudio();
    const next = !isMuted();
    setMuted(next);
    setMutedState(next);
    if (!next) play("click");
  };

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-6 md:px-6 md:py-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Open a Pack</h1>
          <p className="mt-2 text-white/55">
            7 shop packs · $100–$500 (linear) · high-rare odds 20% → ~75%.
            Sounds unlock on first click.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleMute}
          className="btn-ghost flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
          title={muted ? "Unmute" : "Mute"}
        >
          {muted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
          {muted ? "Muted" : "Sound on"}
        </button>
      </div>

      {!loading && !user && (
        <GlassCard className="mb-6" hover={false}>
          <p className="text-sm text-white/70">
            You need an account to open packs.{" "}
            <Link href="/login" className="text-violet-300 underline">
              Login or register
            </Link>{" "}
            — demo: demo@holovault.app / demo1234
          </p>
        </GlassCard>
      )}

      {/* 7 shop packs — price ladder $10 → $500 */}
      <div className="mb-4 sticky top-[3.5rem] z-30 -mx-1 rounded-2xl border border-white/10 bg-[#0c0828]/90 px-2 py-3 backdrop-blur-md">
        <p className="mb-2 px-2 text-[10px] uppercase tracking-wider text-white/40">
          Shop packs · higher price = higher high-rare chance
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1 px-1">
          {expansions.map((e) => {
            const chance =
              e.highRareChance ??
              Math.round(
                (0.2 + ((e.packCost - 100) / 400) * 0.55) * 1000
              ) / 10;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => pickExpansion(e.id)}
                className={cn(
                  "shrink-0 rounded-xl px-4 py-2.5 text-left text-sm transition cursor-pointer min-w-[148px]",
                  "border border-white/10 bg-white/5 hover:bg-white/10 hover:border-violet-400/40",
                  selected === e.id &&
                    "ring-2 ring-violet-400/80 bg-violet-500/20 border-violet-400/50"
                )}
              >
                <p className="font-semibold">
                  {e.icon ? `${e.icon} ` : ""}
                  {e.name}
                </p>
                <p className="text-[11px] text-amber-200/90">
                  {formatPika(e.packCost)}
                </p>
                <p className="text-[10px] text-violet-300/80">
                  {chance}% high-rare
                </p>
                {e.tagline && (
                  <p className="mt-0.5 text-[10px] text-white/35 line-clamp-1">
                    {e.tagline}
                  </p>
                )}
              </button>
            );
          })}
          {!expansions.length && (
            <div className="skeleton h-14 w-40 rounded-xl" />
          )}
        </div>
      </div>

      {/* key forces clean remount when switching expansions mid-session */}
      {expansion && (
        <PackOpening key={expansion.id} expansion={expansion} />
      )}
    </div>
  );
}
