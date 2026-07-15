"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { useUserStore } from "@/store/user-store";
import { ACHIEVEMENTS } from "@/lib/achievement-defs";

export default function RewardsPage() {
  const { user, setUser, loading } = useUserStore();
  const [claimed, setClaimed] = useState<string[]>([]);
  const [streak, setStreak] = useState(0);
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    fetch("/api/rewards/daily")
      .then((r) => r.json())
      .then((d) => {
        setClaimed(d.claimed || []);
        setStreak(d.streak || 0);
        setUnlocked((d.achievements || []).map((a: { id: string }) => a.id));
      });
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const claim = async (type: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/rewards/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Failed");
      } else {
        setUser(data.user);
        setMessage(`+$${data.coins} Pikadollars!`);
        load();
      }
    } finally {
      setBusy(false);
    }
  };

  if (!loading && !user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-white/60">Login for daily rewards.</p>
        <Link href="/login" className="btn-primary mt-4 inline-flex rounded-xl px-5 py-2.5 text-sm">
          Login
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gradient">Daily Rewards</h1>
        <p className="mt-1 text-white/55">
          Streak: {streak} day{streak === 1 ? "" : "s"} · Pikadollars ($) only —
          no real-money gambling
        </p>
      </div>

      {message && (
        <div className="rounded-xl border border-violet-400/30 bg-violet-500/10 px-4 py-3 text-sm">
          {message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <GlassCard hover={false}>
          <h3 className="font-semibold">Daily login</h3>
          <p className="text-sm text-white/50 mt-1">Streak-scaled Pikadollars ($)</p>
          <Button
            className="mt-4"
            size="sm"
            disabled={busy || claimed.includes("daily")}
            onClick={() => claim("daily")}
          >
            {claimed.includes("daily") ? "Claimed" : "Claim"}
          </Button>
        </GlassCard>
        <GlassCard hover={false}>
          <h3 className="font-semibold">Mystery Pikadollars</h3>
          <p className="text-sm text-white/50 mt-1">Requires 3-day streak · $3–$8</p>
          <Button
            className="mt-4"
            size="sm"
            disabled={busy || claimed.includes("mystery") || streak < 3}
            onClick={() => claim("mystery")}
          >
            {claimed.includes("mystery") ? "Claimed" : "Claim mystery"}
          </Button>
        </GlassCard>
        <GlassCard hover={false}>
          <h3 className="font-semibold">Weekly streak</h3>
          <p className="text-sm text-white/50 mt-1">7 days · $15</p>
          <Button
            className="mt-4"
            size="sm"
            disabled={busy || claimed.includes("weekly") || streak < 7}
            onClick={() => claim("weekly")}
          >
            {claimed.includes("weekly") ? "Claimed" : "Claim weekly"}
          </Button>
        </GlassCard>
        <GlassCard hover={false}>
          <h3 className="font-semibold">Birthday bonus</h3>
          <p className="text-sm text-white/50 mt-1">
            Set birthday on account for $25
          </p>
          <Button
            className="mt-4"
            size="sm"
            variant="ghost"
            disabled={busy || claimed.includes("birthday")}
            onClick={() => claim("birthday")}
          >
            Try claim
          </Button>
        </GlassCard>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Achievements</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {ACHIEVEMENTS.map((a) => {
            const done = unlocked.includes(a.id);
            return (
              <GlassCard
                key={a.id}
                hover={false}
                className={done ? "ring-1 ring-amber-400/40" : "opacity-70"}
              >
                <div className="flex gap-3 items-start">
                  <span className="text-2xl">{a.icon}</span>
                  <div>
                    <p className="font-medium">
                      {a.name}{" "}
                      {done && (
                        <span className="text-xs text-amber-300">Unlocked</span>
                      )}
                    </p>
                    <p className="text-xs text-white/50 mt-0.5">{a.description}</p>
                    <p className="text-xs text-violet-300 mt-1">+${a.coins}</p>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}
