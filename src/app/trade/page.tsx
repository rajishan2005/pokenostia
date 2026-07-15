"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { useUserStore } from "@/store/user-store";
import { formatPrice } from "@/lib/utils";
import { play } from "@/lib/sounds";
import { Send, Users, Radio } from "lucide-react";

type Owned = {
  card: {
    id: string;
    name: string;
    imageSmall: string | null;
    marketPrice: number;
    rarity: string;
  };
  quantity: number;
  locked: boolean;
};

type GiftEvent = {
  id: string;
  from: string;
  fromAvatar: string;
  to: string;
  toAvatar: string;
  cardName: string;
  cardImage: string | null;
  marketPrice: number;
  message: string | null;
  createdAt: string;
  direction?: "sent" | "received";
};

export default function TradePage() {
  const { user, loading, setUser } = useUserStore();
  const [owned, setOwned] = useState<Owned[]>([]);
  const [cardId, setCardId] = useState("");
  const [toUsername, setToUsername] = useState("");
  const [message, setMessage] = useState("");
  const [suggestions, setSuggestions] = useState<
    { username: string; avatar: string }[]
  >([]);
  const [live, setLive] = useState<GiftEvent[]>([]);
  const [mine, setMine] = useState<GiftEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!user) return;
    fetch("/api/collection")
      .then((r) => r.json())
      .then((d) => {
        const items = (d.items || []) as Owned[];
        setOwned(items.filter((i) => i.quantity > 0));
      });
    fetch("/api/trade/gift?mine=1")
      .then((r) => r.json())
      .then((d) => setMine(d.gifts || []));
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const load = () => {
      fetch("/api/trade/gift")
        .then((r) => r.json())
        .then((d) => setLive(d.gifts || []));
    };
    load();
    const t = window.setInterval(load, 12000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const q = toUsername.trim().replace(/^@/, "");
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const t = window.setTimeout(() => {
      fetch(`/api/users/lookup?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setSuggestions(d.users || []));
    }, 200);
    return () => window.clearTimeout(t);
  }, [toUsername]);

  const send = async () => {
    if (!user || !cardId || !toUsername.trim()) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/trade/gift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId,
          toUsername: toUsername.trim().replace(/^@/, ""),
          message: message.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Send failed");
        play("error");
      } else {
        setMsg(
          `Sent ${data.gift.cardName} to @${data.gift.toUsername}!`
        );
        play("sell");
        if (data.user) setUser(data.user);
        setMessage("");
        reload();
        fetch("/api/trade/gift")
          .then((r) => r.json())
          .then((d) => setLive(d.gifts || []));
      }
    } catch {
      setErr("Network error");
      play("error");
    } finally {
      setBusy(false);
    }
  };

  if (!loading && !user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-white/60">Log in to trade with other trainers.</p>
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
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gradient">Global Trade</h1>
        <p className="mt-1 text-white/55">
          Send cards free to any trainer by their unique @username · live feed
          for everyone
        </p>
        {user && (
          <p className="mt-2 text-sm text-violet-200/80">
            Your tag: <span className="font-bold">@{user.username}</span>
            {" · "}
            <Link href="/profile" className="underline text-white/60">
              change on Profile
            </Link>
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard strong hover={false}>
          <div className="mb-4 flex items-center gap-2">
            <Send className="h-4 w-4 text-amber-300" />
            <h2 className="font-semibold">Send a card</h2>
          </div>

          <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">
            Card from your collection
          </label>
          <select
            value={cardId}
            onChange={(e) => setCardId(e.target.value)}
            className="mb-3 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
          >
            <option value="">Select card…</option>
            {owned.map((i) => (
              <option key={i.card.id} value={i.card.id}>
                {i.card.name} · {formatPrice(i.card.marketPrice)}
                {i.locked ? " ★" : ""} ×{i.quantity}
              </option>
            ))}
          </select>

          <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">
            To trainer (@username)
          </label>
          <div className="relative mb-3">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
              @
            </span>
            <input
              value={toUsername}
              onChange={(e) => setToUsername(e.target.value.replace(/^@/, ""))}
              placeholder="unique_name"
              className="w-full rounded-xl border border-white/10 bg-black/40 py-2 pl-7 pr-3 text-sm outline-none focus:border-violet-400/50"
            />
            {suggestions.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-xl border border-white/10 bg-[#120c2e] shadow-xl">
                {suggestions.map((s) => (
                  <button
                    key={s.username}
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/10"
                    onClick={() => {
                      setToUsername(s.username);
                      setSuggestions([]);
                    }}
                  >
                    <span>{s.avatar}</span>
                    <span className="font-medium">@{s.username}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">
            Message (optional)
          </label>
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={120}
            placeholder="Trade gift 🎁"
            className="mb-4 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-violet-400/50"
          />

          <Button
            className="w-full"
            disabled={busy || !cardId || !toUsername.trim()}
            onClick={() => void send()}
          >
            {busy ? "Sending…" : "Send card free"}
          </Button>

          {msg && (
            <p className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {msg}
            </p>
          )}
          {err && (
            <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {err}
            </p>
          )}
        </GlassCard>

        <div className="space-y-6">
          <GlassCard hover={false}>
            <div className="mb-3 flex items-center gap-2">
              <Radio className="h-4 w-4 text-rose-300" />
              <h2 className="font-semibold">Live global gifts</h2>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {live.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  {g.cardImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={g.cardImage}
                      alt=""
                      className="h-10 w-7 rounded object-cover"
                    />
                  ) : (
                    <div className="h-10 w-7 rounded bg-white/10" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      <span className="font-semibold">@{g.from}</span>
                      <span className="text-white/40"> → </span>
                      <span className="font-semibold">@{g.to}</span>
                    </p>
                    <p className="truncate text-xs text-white/45">
                      {g.cardName} · {formatPrice(g.marketPrice)}
                      {g.message ? ` · “${g.message}”` : ""}
                    </p>
                  </div>
                </div>
              ))}
              {!live.length && (
                <p className="text-sm text-white/40">
                  No gifts yet — be the first to send one!
                </p>
              )}
            </div>
          </GlassCard>

          <GlassCard hover={false}>
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-violet-300" />
              <h2 className="font-semibold">Your recent trades</h2>
            </div>
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {mine.map((g) => (
                <p key={g.id} className="text-sm text-white/70">
                  {g.direction === "sent" ? "Sent" : "Received"}{" "}
                  <span className="text-white">{g.cardName}</span>{" "}
                  {g.direction === "sent" ? "to" : "from"} @
                  {g.direction === "sent" ? g.to : g.from}
                </p>
              ))}
              {!mine.length && (
                <p className="text-sm text-white/40">No personal gifts yet.</p>
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
