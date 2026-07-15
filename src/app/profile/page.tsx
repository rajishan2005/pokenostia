"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUserStore } from "@/store/user-store";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { formatNumber } from "@/lib/utils";
import { formatPika } from "@/lib/currency";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const { user, loading, logout, refresh, setUser } = useUserStore();
  const router = useRouter();
  const [achievements, setAchievements] = useState<
    { id: string; name: string; description: string; icon: string; coins: number }[]
  >([]);
  const [fav, setFav] = useState<{ name: string; imageSmall: string | null } | null>(
    null
  );
  const [newName, setNewName] = useState("");
  const [nameMsg, setNameMsg] = useState<string | null>(null);
  const [nameBusy, setNameBusy] = useState(false);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/rewards/daily")
      .then((r) => r.json())
      .then((d) => setAchievements(d.achievements || []));
    fetch("/api/collection")
      .then((r) => r.json())
      .then((d) => {
        const items = d.items || [];
        if (user.favoriteCardId) {
          const f = items.find(
            (i: { card: { id: string } }) => i.card.id === user.favoriteCardId
          );
          if (f) setFav(f.card);
        } else if (items[0]) {
          setFav(items[0].card);
        }
      });
  }, [user]);

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <div className="skeleton h-40 rounded-3xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-white/60">Sign in to view your profile.</p>
        <Link
          href="/login"
          className="btn-primary mt-4 inline-flex rounded-xl px-5 py-2.5 text-sm"
        >
          Login
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <GlassCard strong hover={false} className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-5xl shadow-xl shadow-violet-500/30">
          {user.avatar}
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-2xl font-bold">@{user.username}</h1>
          <p className="text-sm text-white/45">{user.email}</p>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Pikadollars" value={formatPika(user.coins)} />
            <Stat label="Score" value={formatNumber(user.collectionScore)} />
            <Stat label="Packs" value={formatNumber(user.totalPacks)} />
            <Stat label="Rares" value={formatNumber(user.totalRares)} />
          </div>
          <p className="mt-3 text-sm text-white/50">
            Login streak: {user.loginStreak} day{user.loginStreak === 1 ? "" : "s"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await logout();
            router.push("/");
          }}
        >
          Logout
        </Button>
      </GlassCard>

      <GlassCard hover={false}>
        <h2 className="font-semibold mb-2">Unique trainer name</h2>
        <p className="mb-3 text-xs text-white/45">
          Others send you cards with @{user.username} · must be unique
        </p>
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[160px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
              @
            </span>
            <input
              value={newName}
              onChange={(e) =>
                setNewName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))
              }
              placeholder={user.username}
              maxLength={20}
              className="w-full rounded-xl border border-white/10 bg-black/40 py-2 pl-7 pr-3 text-sm outline-none focus:border-violet-400/50"
            />
          </div>
          <Button
            size="sm"
            disabled={nameBusy || newName.length < 3}
            onClick={async () => {
              setNameBusy(true);
              setNameMsg(null);
              try {
                const res = await fetch("/api/users/username", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ username: newName }),
                });
                const d = await res.json();
                if (!res.ok) {
                  setNameMsg(d.error || "Failed");
                } else {
                  setUser(d.user);
                  setNameMsg("Trainer name updated!");
                  setNewName("");
                  refresh();
                }
              } catch {
                setNameMsg("Network error");
              } finally {
                setNameBusy(false);
              }
            }}
          >
            Save
          </Button>
        </div>
        {nameMsg && (
          <p className="mt-2 text-sm text-violet-200/90">{nameMsg}</p>
        )}
      </GlassCard>

      <GlassCard hover={false}>
        <h2 className="font-semibold mb-2">Favorite card</h2>
        {fav ? (
          <p className="text-white/70">
            {fav.name}{" "}
            <span className="text-white/40 text-sm">(set favorite after more pulls)</span>
          </p>
        ) : (
          <p className="text-white/45 text-sm">Open packs to discover favorites.</p>
        )}
      </GlassCard>

      <GlassCard hover={false}>
        <h2 className="font-semibold mb-3">Achievements</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {achievements.map((a) => (
            <div
              key={a.id}
              className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
            >
              <span className="mr-2">{a.icon}</span>
              <span className="font-medium">{a.name}</span>
              <p className="text-xs text-white/45 mt-0.5">{a.description}</p>
            </div>
          ))}
          {!achievements.length && (
            <p className="text-sm text-white/45">No achievements unlocked yet.</p>
          )}
        </div>
      </GlassCard>

      <div className="flex flex-wrap gap-3">
        <Link href="/open" className="btn-primary rounded-xl px-5 py-2.5 text-sm">
          Open packs
        </Link>
        <Link href="/games" className="btn-ghost rounded-xl px-5 py-2.5 text-sm">
          Earn $
        </Link>
        <Link href="/history" className="btn-ghost rounded-xl px-5 py-2.5 text-sm">
          Pull history
        </Link>
        <Link href="/trade" className="btn-ghost rounded-xl px-5 py-2.5 text-sm">
          Trade / send cards
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
