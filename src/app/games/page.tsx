"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { useUserStore } from "@/store/user-store";
import {
  MemoryGame,
  ReactionGame,
  TriviaGame,
  PuzzleGame,
  GuessGame,
  SpotGame,
  WheelGame,
  TreasureGame,
} from "@/components/games/MiniGames";

const GAMES = [
  { id: "memory", name: "Memory Match", desc: "Flip pairs of card backs", icon: "🧠" },
  { id: "reaction", name: "Quick Reaction", desc: "Tap when the holo flashes", icon: "⚡" },
  { id: "trivia", name: "Trivia", desc: "TCG knowledge quiz", icon: "❓" },
  { id: "puzzle", name: "Daily Puzzle", desc: "Reorder the pack sequence", icon: "🧩" },
  { id: "guess", name: "Card Guessing", desc: "Name the silhouette", icon: "🔍" },
  { id: "spot", name: "Spot the Difference", desc: "Find the odd card", icon: "👀" },
  { id: "wheel", name: "Spin Wheel", desc: "Skill-timed coin spin (not gambling)", icon: "🎡" },
  { id: "treasure", name: "Treasure Hunt", desc: "Click glowing tiles", icon: "💎" },
] as const;

export default function GamesPage() {
  const { user, setUser, loading } = useUserStore();
  const [active, setActive] = useState<string | null>(null);
  const [lastReward, setLastReward] = useState<number | null>(null);

  const claim = async (gameId: string, score: number) => {
    if (!user) return;
    const res = await fetch("/api/games/reward", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId, score }),
    });
    const data = await res.json();
    if (res.ok) {
      setUser(data.user);
      setLastReward(data.coins);
    } else {
      setLastReward(null);
      alert(data.error || "Reward failed");
    }
  };

  if (!loading && !user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-white/60">Login to play and earn Pikadollars ($).</p>
        <Link href="/login" className="btn-primary mt-4 inline-flex rounded-xl px-5 py-2.5 text-sm">
          Login
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold text-gradient">Mini Games</h1>
      <p className="mt-1 text-white/55 mb-2">
        Earn Pikadollars ($) with skill — buy packs, never real-money gambling.
      </p>
      {lastReward != null && (
        <p className="mb-6 text-sm text-emerald-300">
          Last reward: +${lastReward}
        </p>
      )}

      {!active && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {GAMES.map((g, i) => (
            <motion.div
              key={g.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <GlassCard
                className="cursor-pointer h-full"
                onClick={() => {
                  setActive(g.id);
                  setLastReward(null);
                }}
              >
                <span className="text-3xl">{g.icon}</span>
                <h3 className="mt-3 font-semibold">{g.name}</h3>
                <p className="text-xs text-white/50 mt-1">{g.desc}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}

      {active && (
        <div className="glass-strong rounded-3xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {GAMES.find((g) => g.id === active)?.name}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setActive(null)}>
              Back
            </Button>
          </div>
          {active === "memory" && (
            <MemoryGame onComplete={(s) => claim("memory", s)} />
          )}
          {active === "reaction" && (
            <ReactionGame onComplete={(s) => claim("reaction", s)} />
          )}
          {active === "trivia" && (
            <TriviaGame onComplete={(s) => claim("trivia", s)} />
          )}
          {active === "puzzle" && (
            <PuzzleGame onComplete={(s) => claim("puzzle", s)} />
          )}
          {active === "guess" && (
            <GuessGame onComplete={(s) => claim("guess", s)} />
          )}
          {active === "spot" && (
            <SpotGame onComplete={(s) => claim("spot", s)} />
          )}
          {active === "wheel" && (
            <WheelGame onComplete={(s) => claim("wheel", s)} />
          )}
          {active === "treasure" && (
            <TreasureGame onComplete={(s) => claim("treasure", s)} />
          )}
        </div>
      )}
    </div>
  );
}
