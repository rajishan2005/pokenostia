"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Trophy, Medal } from "lucide-react";

interface BoardUser {
  id: string;
  username: string;
  avatar: string;
  totalPacks?: number;
  totalRares?: number;
  collectionScore?: number;
  coins?: number;
  percent?: number;
  owned?: number;
}

function rankStyle(i: number) {
  if (i === 0)
    return "bg-gradient-to-r from-amber-500/25 to-yellow-500/10 border-amber-400/40";
  if (i === 1)
    return "bg-gradient-to-r from-slate-300/15 to-slate-400/5 border-slate-300/30";
  if (i === 2)
    return "bg-gradient-to-r from-orange-600/20 to-amber-800/10 border-orange-400/30";
  return "";
}

function RankBadge({ n }: { n: number }) {
  if (n <= 3) {
    const colors = ["text-amber-300", "text-slate-200", "text-orange-300"];
    return (
      <span
        className={cn(
          "flex w-10 items-center justify-center font-black",
          colors[n - 1]
        )}
      >
        <Medal className="h-5 w-5" />
      </span>
    );
  }
  return (
    <span className="w-10 text-center font-bold tabular-nums text-white/40">
      #{n}
    </span>
  );
}

export default function LeaderboardsPage() {
  const [data, setData] = useState<{
    mostPacks: BoardUser[];
    highestValue: BoardUser[];
    mostRares: BoardUser[];
    luckyPulls: {
      id: string;
      username: string;
      avatar: string;
      totalValue: number;
      rarestTier: number;
    }[];
    completion: BoardUser[];
    limit?: number;
  } | null>(null);
  const [tab, setTab] = useState<
    "packs" | "value" | "rares" | "completion" | "lucky"
  >("packs");

  useEffect(() => {
    fetch("/api/leaderboards")
      .then((r) => r.json())
      .then(setData);
  }, []);

  const tabs = [
    { id: "packs" as const, label: "Most packs" },
    { id: "value" as const, label: "Collection score" },
    { id: "rares" as const, label: "Most rares" },
    { id: "completion" as const, label: "Completion %" },
    { id: "lucky" as const, label: "Lucky pulls" },
  ];

  const list =
    tab === "packs"
      ? data?.mostPacks
      : tab === "value"
        ? data?.highestValue
        : tab === "rares"
          ? data?.mostRares
          : tab === "completion"
            ? data?.completion
            : null;

  const limit = data?.limit ?? 100;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-2 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/15">
          <Trophy className="h-5 w-5 text-amber-300" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gradient">Leaderboards</h1>
          <p className="text-white/55">
            Global Top {limit} · real trainers & rival gamertags
          </p>
        </div>
      </div>
      <p className="mb-8 text-sm text-white/40">
        Climb the boards by opening packs, chasing rares, and stacking
        collection score. Top 3 get podium styling.
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-1.5 text-sm ${
              tab === t.id
                ? "bg-violet-500/40 text-white"
                : "glass text-white/60"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {data && (
        <div className="mb-4 flex items-center justify-between text-xs text-white/45">
          <span>
            Showing{" "}
            <span className="font-semibold text-white/70">
              {tab === "lucky"
                ? data.luckyPulls.length
                : list?.length ?? 0}
            </span>{" "}
            of top {limit}
          </span>
          {list && list.length >= 3 && tab !== "lucky" && (
            <span className="text-amber-200/70">
              🥇 {list[0]?.username} · 🥈 {list[1]?.username} · 🥉{" "}
              {list[2]?.username}
            </span>
          )}
        </div>
      )}

      {!data && (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="skeleton h-14 rounded-xl" />
          ))}
        </div>
      )}

      {tab !== "lucky" && list && (
        <div className="max-h-[min(72vh,900px)] space-y-2 overflow-y-auto pr-1">
          {list.map((u, i) => (
            <GlassCard
              key={u.id}
              className={cn(
                "!p-3 sm:!p-4 flex items-center gap-3 sm:gap-4",
                rankStyle(i)
              )}
              hover={false}
            >
              <RankBadge n={i + 1} />
              <span className="text-2xl shrink-0">{u.avatar}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">
                  {u.username}
                  {i < 3 && (
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-200/80">
                      {i === 0 ? "Champion" : i === 1 ? "Elite" : "Ace"}
                    </span>
                  )}
                </p>
                <p className="text-xs text-white/45">
                  {tab === "packs" && `${u.totalPacks?.toLocaleString()} packs`}
                  {tab === "value" &&
                    `Score ${u.collectionScore?.toLocaleString()}${
                      u.coins != null
                        ? ` · $${Math.round(u.coins).toLocaleString()}`
                        : ""
                    }`}
                  {tab === "rares" &&
                    `${u.totalRares?.toLocaleString()} rare pulls`}
                  {tab === "completion" &&
                    `${u.percent}% (${u.owned} unique)`}
                </p>
              </div>
              {i < 10 && (
                <span className="hidden sm:inline text-[10px] uppercase tracking-wider text-white/30">
                  Top 10
                </span>
              )}
            </GlassCard>
          ))}
          {!list.length && (
            <p className="text-white/45 text-sm">No trainers ranked yet.</p>
          )}
        </div>
      )}

      {tab === "lucky" && data && (
        <div className="max-h-[min(72vh,900px)] space-y-2 overflow-y-auto pr-1">
          {data.luckyPulls.map((p, i) => (
            <GlassCard
              key={p.id}
              className={cn(
                "!p-4 flex items-center gap-4",
                rankStyle(i)
              )}
              hover={false}
            >
              <RankBadge n={i + 1} />
              <span className="text-2xl">{p.avatar}</span>
              <div className="flex-1">
                <p className="font-semibold">{p.username}</p>
                <p className="text-xs text-white/45">
                  Pack value {formatPrice(p.totalValue)} · rarest tier{" "}
                  {p.rarestTier}
                </p>
              </div>
            </GlassCard>
          ))}
          {!data.luckyPulls.length && (
            <p className="text-white/45 text-sm">
              Open packs to climb lucky ranks.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
