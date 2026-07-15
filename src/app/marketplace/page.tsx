"use client";

import { useEffect, useMemo, useState } from "react";
import { HoloCard } from "@/components/ui/HoloCard";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/utils";
import { formatPika } from "@/lib/currency";
import { useUserStore } from "@/store/user-store";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { Search } from "lucide-react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
);

interface CardRow {
  id: string;
  name: string;
  rarity: string;
  rarityTier: number;
  imageSmall: string | null;
  marketPrice: number;
  remaining: number;
  maxSupply: number;
  setName?: string;
}

interface PlayerListing {
  id: string;
  price: number;
  createdAt: string;
  mine?: boolean;
  seller: { id?: string; username: string; avatar: string };
  card: {
    id: string;
    name: string;
    imageSmall: string | null;
    marketPrice: number;
    rarity: string;
    rarityTier: number;
  };
}

interface TradeRow {
  id: string;
  type: string;
  amount: number;
  marketPrice: number | null;
  percent: number | null;
  note: string | null;
  createdAt: string;
  card: {
    id: string;
    name: string;
    imageSmall: string | null;
    marketPrice: number;
    rarity: string;
  };
}

export default function MarketplacePage() {
  const { user, setUser } = useUserStore();
  const [data, setData] = useState<{
    trending: CardRow[];
    mostValuable: CardRow[];
    scarce: CardRow[];
    recentlyPulled: {
      id: string;
      username: string;
      avatar: string;
      card: CardRow;
      rarity: string;
      createdAt: string;
    }[];
    chart: { labels: string[]; avgPrice: number[]; counts: number[] };
  } | null>(null);
  const [listings, setListings] = useState<PlayerListing[]>([]);
  const [history, setHistory] = useState<TradeRow[]>([]);
  const [buyMsg, setBuyMsg] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [rarity, setRarity] = useState("all");
  const [sort, setSort] = useState("newest");
  const [tab, setTab] = useState<"browse" | "mine" | "history">("browse");

  const loadListings = () => {
    const params = new URLSearchParams({
      q,
      rarity,
      sort,
      ...(tab === "mine" ? { mine: "1" } : {}),
    });
    fetch(`/api/trade/list?${params}`)
      .then((r) => r.json())
      .then((d) => setListings(d.listings || []));
  };

  const loadHistory = () => {
    if (!user) return;
    fetch("/api/trade/history")
      .then((r) => r.json())
      .then((d) => setHistory(d.history || []));
  };

  useEffect(() => {
    fetch("/api/marketplace")
      .then((r) => r.json())
      .then(setData);
  }, []);

  useEffect(() => {
    if (tab === "history") loadHistory();
    else loadListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, rarity, sort, tab, user?.id]);

  const buyListing = async (id: string) => {
    setBuyMsg(null);
    const res = await fetch("/api/trade/buy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: id }),
    });
    const d = await res.json();
    if (!res.ok) {
      setBuyMsg(d.error || "Buy failed");
      return;
    }
    if (d.user) setUser(d.user);
    setBuyMsg(`Bought ${d.cardName} for ${formatPika(d.paid)}!`);
    loadListings();
    loadHistory();
  };

  const cancelListing = async (id: string) => {
    setBuyMsg(null);
    const res = await fetch("/api/trade/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: id }),
    });
    const d = await res.json();
    if (!res.ok) {
      setBuyMsg(d.error || "Cancel failed");
      return;
    }
    setBuyMsg("Listing cancelled — card is free in your collection again.");
    loadListings();
    loadHistory();
  };

  const filteredTrending = useMemo(() => {
    if (!data) return [];
    let list = [...data.mostValuable];
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(s));
    }
    if (rarity === "rare+") list = list.filter((c) => c.rarityTier >= 3);
    if (rarity === "holo+") list = list.filter((c) => c.rarityTier >= 4);
    if (rarity === "secret+") list = list.filter((c) => c.rarityTier >= 8);
    if (sort === "price_asc") list.sort((a, b) => a.marketPrice - b.marketPrice);
    if (sort === "price_desc")
      list.sort((a, b) => b.marketPrice - a.marketPrice);
    if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "rarity")
      list.sort((a, b) => b.rarityTier - a.rarityTier);
    return list;
  }, [data, q, rarity, sort]);

  if (!data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="skeleton mb-6 h-10 w-64 rounded-lg" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-56 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const chartOpts = {
    responsive: true,
    plugins: { legend: { labels: { color: "#c4b5fd" } } },
    scales: {
      x: {
        ticks: { color: "#94a3b8" },
        grid: { color: "rgba(255,255,255,0.05)" },
      },
      y: {
        ticks: { color: "#94a3b8" },
        grid: { color: "rgba(255,255,255,0.05)" },
      },
    },
  };

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10">
      <div>
        <h1 className="text-3xl font-bold text-gradient">Marketplace</h1>
        <p className="mt-1 text-white/55">
          Search, sort, buy, cancel listings · sell history
        </p>
      </div>

      {/* Filters */}
      <div className="glass flex flex-col gap-3 rounded-2xl p-4 md:flex-row md:items-end">
        <label className="min-w-0 flex-1 text-sm">
          <span className="mb-1 flex items-center gap-1 text-xs text-white/45">
            <Search className="h-3 w-3" /> Search Pokémon
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pikachu, Charizard…"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 outline-none focus:border-violet-400/50"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-white/45">Rarity</span>
          <select
            value={rarity}
            onChange={(e) => setRarity(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2"
          >
            <option value="all">All</option>
            <option value="rare+">Rare+</option>
            <option value="holo+">Holo+</option>
            <option value="secret+">Special Illus / Secret+</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-white/45">Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2"
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price ↑</option>
            <option value="price_desc">Price ↓</option>
            <option value="name">Name A–Z</option>
            <option value="rarity">Rarity</option>
          </select>
        </label>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["browse", "Browse listings"],
            ["mine", "My listings"],
            ["history", "Sell history"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-1.5 text-sm ${
              tab === id
                ? "bg-violet-500/40 text-white"
                : "glass text-white/60"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {buyMsg && (
        <p className="rounded-xl border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-sm">
          {buyMsg}
        </p>
      )}

      {(tab === "browse" || tab === "mine") && (
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">
            {tab === "mine" ? "Your active listings" : "Player listings"}
          </h2>
          {listings.map((l) => (
            <div
              key={l.id}
              className="glass flex flex-wrap items-center gap-3 rounded-xl px-4 py-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={l.card.imageSmall || ""}
                alt=""
                className="h-14 w-10 rounded bg-black/40 object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{l.card.name}</p>
                <p className="text-xs text-white/45">
                  {tab === "mine"
                    ? `Listed · market ${formatPrice(l.card.marketPrice)}`
                    : `${l.seller.avatar} ${l.seller.username} · market ${formatPrice(l.card.marketPrice)}`}{" "}
                  · {l.card.rarity}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-amber-300">
                  {formatPika(Math.ceil(l.price))}
                </p>
                {tab === "mine" || l.mine ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1"
                    onClick={() => void cancelListing(l.id)}
                  >
                    Cancel listing
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="mt-1"
                    disabled={!user}
                    onClick={() => void buyListing(l.id)}
                  >
                    Buy
                  </Button>
                )}
              </div>
            </div>
          ))}
          {!listings.length && (
            <p className="text-sm text-white/45">
              No listings match your filters.
            </p>
          )}
        </section>
      )}

      {tab === "history" && (
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Your sell / trade history</h2>
          {!user && (
            <p className="text-sm text-white/45">Log in to see history.</p>
          )}
          {history.map((h) => (
            <div
              key={h.id}
              className="glass flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={h.card.imageSmall || ""}
                alt=""
                className="h-12 w-9 rounded object-cover bg-black/40"
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{h.card.name}</p>
                <p className="text-xs text-white/45">
                  {h.type.replace("_", " ")} ·{" "}
                  {new Date(h.createdAt).toLocaleString()}
                  {h.percent != null ? ` · ${h.percent}% market` : ""}
                </p>
              </div>
              <span
                className={
                  h.type === "bought" || h.type === "cancelled"
                    ? "text-white/60"
                    : "font-semibold text-emerald-300"
                }
              >
                {h.type === "bought"
                  ? `−${formatPika(Math.ceil(h.amount))}`
                  : h.amount > 0
                    ? `+${formatPika(Math.ceil(h.amount))}`
                    : "—"}
              </span>
            </div>
          ))}
          {user && !history.length && (
            <p className="text-sm text-white/45">No trades yet.</p>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-4 text-xl font-semibold">
          Catalog (filtered)
        </h2>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {filteredTrending.map((c) => (
            <HoloCard
              key={c.id}
              name={c.name}
              image={c.imageSmall}
              rarity={c.rarity}
              rarityTier={c.rarityTier}
              marketPrice={c.marketPrice}
              remaining={c.remaining}
              maxSupply={c.maxSupply}
            />
          ))}
          {!filteredTrending.length && (
            <p className="text-sm text-white/45">No cards match search.</p>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <GlassCard hover={false}>
          <h3 className="mb-4 font-semibold">Avg market price by rarity tier</h3>
          <Bar
            data={{
              labels: data.chart.labels,
              datasets: [
                {
                  label: "Avg $",
                  data: data.chart.avgPrice,
                  backgroundColor: "rgba(124,92,255,0.6)",
                  borderRadius: 8,
                },
              ],
            }}
            options={chartOpts}
          />
        </GlassCard>
        <GlassCard hover={false}>
          <h3 className="mb-4 font-semibold">Card count by tier</h3>
          <Line
            data={{
              labels: data.chart.labels,
              datasets: [
                {
                  label: "Cards",
                  data: data.chart.counts,
                  borderColor: "#46e0ff",
                  backgroundColor: "rgba(70,224,255,0.15)",
                  fill: true,
                  tension: 0.35,
                },
              ],
            }}
            options={chartOpts}
          />
        </GlassCard>
      </section>
    </div>
  );
}
