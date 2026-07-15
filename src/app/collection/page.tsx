"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
// AnimatePresence still used for detail modal
import { HoloCard } from "@/components/ui/HoloCard";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { formatPrice, scarcityLabel } from "@/lib/utils";
import { useUserStore } from "@/store/user-store";
import { CardTradePanel } from "@/components/trade/CardTradePanel";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { play } from "@/lib/sounds";

interface Item {
  id: string;
  quantity: number;
  locked: boolean;
  firstPull: string;
  lastPull: string;
  card: {
    id: string;
    name: string;
    rarity: string;
    rarityTier: number;
    imageSmall: string | null;
    imageLarge: string | null;
    marketPrice: number;
    remaining: number;
    maxSupply: number;
    artist: string | null;
    setName: string;
    setId: string;
    hp: string | null;
    types: string[];
    releaseDate: string | null;
  };
}

const PAGE_SIZE = 9;

export default function CollectionPage() {
  const { user, loading, setUser } = useUserStore();
  const [items, setItems] = useState<Item[]>([]);
  const [setProgress, setSetProgress] = useState<
    { setId: string; name: string; total: number; owned: number }[]
  >([]);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Item | null>(null);
  const [filterSet, setFilterSet] = useState<string>("all");
  const [q, setQ] = useState("");
  const [rarity, setRarity] = useState("all");
  const [sort, setSort] = useState("rarity");
  const [keptOnly, setKeptOnly] = useState(false);
  const [sellMsg, setSellMsg] = useState<string | null>(null);
  const [sellingAll, setSellingAll] = useState(false);

  const reload = () => {
    if (!user) return;
    fetch("/api/collection")
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items || []);
        setSetProgress(d.setProgress || []);
      });
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const filtered = useMemo(() => {
    let list = [...items];
    if (filterSet !== "all") {
      list = list.filter((i) => i.card.setId === filterSet);
    }
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter((i) => i.card.name.toLowerCase().includes(s));
    }
    if (rarity === "rare+") list = list.filter((i) => i.card.rarityTier >= 3);
    if (rarity === "holo+") list = list.filter((i) => i.card.rarityTier >= 4);
    if (rarity === "secret+")
      list = list.filter((i) => i.card.rarityTier >= 8);
    if (keptOnly) list = list.filter((i) => i.locked);

    if (sort === "rarity")
      list.sort((a, b) => b.card.rarityTier - a.card.rarityTier);
    else if (sort === "price")
      list.sort((a, b) => b.card.marketPrice - a.card.marketPrice);
    else if (sort === "name")
      list.sort((a, b) => a.card.name.localeCompare(b.card.name));
    else if (sort === "qty") list.sort((a, b) => b.quantity - a.quantity);
    else if (sort === "kept")
      list.sort((a, b) => Number(b.locked) - Number(a.locked));

    return list;
  }, [items, filterSet, q, rarity, sort, keptOnly]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const slice = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );

  const slots = Array.from({ length: PAGE_SIZE }, (_, i) => slice[i] ?? null);

  const toggleKeep = async (item: Item, next: boolean) => {
    try {
      const res = await fetch("/api/collection/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: item.card.id, locked: next }),
      });
      const d = await res.json();
      if (!res.ok) {
        setSellMsg(d.error || "Could not update keep");
        play("error");
        return;
      }
      setItems((prev) =>
        prev.map((i) =>
          i.card.id === item.card.id ? { ...i, locked: d.locked } : i
        )
      );
      setSelected((sel) =>
        sel && sel.card.id === item.card.id
          ? { ...sel, locked: d.locked }
          : sel
      );
      play("click");
    } catch {
      setSellMsg("Network error");
      play("error");
    }
  };

  const sellAll = async () => {
    if (!user) return;
    const kept = items.filter((i) => i.locked).length;
    if (
      !confirm(
        kept
          ? `Quick-sell free cards at 70–95% market? ${kept} starred/kept card(s) will be skipped.`
          : "Quick-sell ALL free cards (not listed) at 70–95% market each?"
      )
    )
      return;
    setSellingAll(true);
    setSellMsg(null);
    try {
      const res = await fetch("/api/trade/sell-all", { method: "POST" });
      const d = await res.json();
      if (!res.ok) {
        setSellMsg(d.error || "Sell all failed");
      } else {
        setUser(d.user);
        setSellMsg(
          `Sold ${d.soldCount} cards for $${d.totalPayout} total Pikadollars` +
            (kept ? ` · ${kept} kept starred` : "")
        );
        reload();
      }
    } catch {
      setSellMsg("Network error");
    } finally {
      setSellingAll(false);
    }
  };

  if (!loading && !user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-white/60">Log in to view your binder.</p>
        <Link href="/login" className="btn-primary mt-4 inline-flex rounded-xl px-5 py-2.5 text-sm">
          Login
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Collection Binder</h1>
          <p className="mt-1 text-white/55">
            {filtered.length} shown · {items.length} unique total
            {items.some((i) => i.locked)
              ? ` · ${items.filter((i) => i.locked).length} starred`
              : ""}
          </p>
          <p className="mt-1 text-xs text-white/40">
            Star cards to keep them — they won&apos;t sell on Quick sell / Sell
            all
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={keptOnly ? "primary" : "ghost"}
            onClick={() => {
              setKeptOnly((v) => !v);
              setPage(0);
            }}
          >
            <Star
              className={cn(
                "mr-1 h-3.5 w-3.5",
                keptOnly && "fill-amber-300 text-amber-300"
              )}
            />
            Kept only
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={sellingAll || !items.length}
            onClick={() => void sellAll()}
          >
            {sellingAll ? "Selling…" : "Sell all (quick)"}
          </Button>
        </div>
      </div>

      {sellMsg && (
        <p className="mb-4 rounded-xl border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-sm">
          {sellMsg}
        </p>
      )}

      <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          placeholder="Search Pokémon…"
          className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-violet-400/50"
        />
        <select
          value={rarity}
          onChange={(e) => {
            setRarity(e.target.value);
            setPage(0);
          }}
          className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
        >
          <option value="all">All rarities</option>
          <option value="rare+">Rare+</option>
          <option value="holo+">Holo+</option>
          <option value="secret+">Special / Secret+</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
        >
          <option value="rarity">Sort: rarity</option>
          <option value="price">Sort: market $</option>
          <option value="name">Sort: name</option>
          <option value="qty">Sort: quantity</option>
          <option value="kept">Sort: starred first</option>
        </select>
        <select
          value={filterSet}
          onChange={(e) => {
            setFilterSet(e.target.value);
            setPage(0);
          }}
          className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
        >
          <option value="all">All sets</option>
          {setProgress.map((s) => (
            <option key={s.setId} value={s.setId}>
              {s.name} ({s.owned}/{s.total})
            </option>
          ))}
        </select>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {setProgress.slice(0, 4).map((s) => (
          <GlassCard key={s.setId} className="!p-4" hover={false}>
            <p className="text-sm font-medium">{s.name}</p>
            <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                style={{
                  width: `${s.total ? (s.owned / s.total) * 100 : 0}%`,
                }}
              />
            </div>
            <p className="mt-1 text-xs text-white/45">
              {s.owned}/{s.total} (
              {s.total ? Math.round((s.owned / s.total) * 100) : 0}%)
            </p>
          </GlassCard>
        ))}
      </div>

      <div className="binder-page relative rounded-3xl border border-white/10 p-6 md:p-10 shadow-2xl">
        <div className="pointer-events-none absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent" />

        <div className="grid grid-cols-3 gap-4 md:gap-6">
          {slots.map((item, i) => (
            <motion.div
              key={`${page}-${item?.id ?? `empty-${i}`}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.25 }}
              className="flex justify-center"
            >
              {item ? (
                <div className="relative">
                  {item.locked && (
                    <span className="absolute -right-1 -top-1 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-amber-400/50 bg-amber-500/90 shadow-lg">
                      <Star className="h-3.5 w-3.5 fill-white text-white" />
                    </span>
                  )}
                  <button
                    type="button"
                    title={item.locked ? "Unstar" : "Star to keep"}
                    onClick={(e) => {
                      e.stopPropagation();
                      void toggleKeep(item, !item.locked);
                    }}
                    className={cn(
                      "absolute -left-1 -top-1 z-20 flex h-7 w-7 items-center justify-center rounded-full border shadow-lg transition-colors",
                      item.locked
                        ? "border-amber-400/60 bg-amber-500/30 text-amber-200"
                        : "border-white/20 bg-black/70 text-white/50 hover:border-amber-400/40 hover:text-amber-200"
                    )}
                  >
                    <Star
                      className={cn(
                        "h-3.5 w-3.5",
                        item.locked && "fill-amber-300 text-amber-300"
                      )}
                    />
                  </button>
                  <HoloCard
                    name={item.card.name}
                    image={item.card.imageSmall}
                    rarity={item.card.rarity}
                    rarityTier={item.card.rarityTier}
                    marketPrice={item.card.marketPrice}
                    remaining={item.card.remaining}
                    maxSupply={item.card.maxSupply}
                    onClick={() => setSelected(item)}
                  />
                </div>
              ) : (
                <HoloCard
                  name="Missing"
                  rarity="Common"
                  rarityTier={1}
                  silhouette
                  showMeta={false}
                />
              )}
            </motion.div>
          ))}
        </div>

        <div className="mt-8 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            disabled={safePage <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <span className="text-sm text-white/50">
            Page {safePage + 1} / {pages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={safePage >= pages - 1}
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl p-6"
            >
              <div className="flex flex-col gap-5 sm:flex-row">
                <div className="relative mx-auto h-56 w-40 shrink-0 overflow-hidden rounded-xl bg-black/40 sm:mx-0">
                  {(selected.card.imageLarge || selected.card.imageSmall) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={
                        selected.card.imageLarge ||
                        selected.card.imageSmall ||
                        ""
                      }
                      alt={selected.card.name}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      title={
                        selected.locked
                          ? "Unstar — allow quick sell"
                          : "Star to keep (skip quick sell)"
                      }
                      onClick={() =>
                        void toggleKeep(selected, !selected.locked)
                      }
                      className={cn(
                        "mt-0.5 shrink-0 rounded-lg border p-1.5",
                        selected.locked
                          ? "border-amber-400/50 bg-amber-500/20 text-amber-300"
                          : "border-white/15 bg-white/5 text-white/50 hover:text-amber-200"
                      )}
                    >
                      <Star
                        className={cn(
                          "h-5 w-5",
                          selected.locked && "fill-amber-300 text-amber-300"
                        )}
                      />
                    </button>
                    <div>
                      <h2 className="text-xl font-bold">
                        {selected.card.name}
                      </h2>
                      {selected.locked && (
                        <p className="text-xs font-medium text-amber-300">
                          ★ Kept in collection · not sold by quick sell
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-white/55">{selected.card.setName}</p>
                  <p className="text-sm">
                    Market:{" "}
                    <span className="text-amber-200">
                      {formatPrice(selected.card.marketPrice)}
                    </span>
                  </p>
                  <p className="text-sm">
                    Supply: {selected.card.remaining}/{selected.card.maxSupply}{" "}
                    (
                    {scarcityLabel(
                      selected.card.remaining,
                      selected.card.maxSupply
                    )}
                    )
                  </p>
                  <p className="text-sm text-white/60">
                    Artist: {selected.card.artist || "—"}
                  </p>
                  <p className="text-sm text-white/60">
                    Qty owned: {selected.quantity}
                  </p>
                  <p className="text-xs text-white/40">
                    Types: {(selected.card.types || []).join(", ") || "—"} · HP{" "}
                    {selected.card.hp || "—"}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <CardTradePanel
                  cardId={selected.card.id}
                  marketPrice={selected.card.marketPrice}
                  cardName={selected.card.name}
                  canTrade
                  initialLocked={selected.locked}
                  onLockChange={(locked) => {
                    setItems((prev) =>
                      prev.map((i) =>
                        i.card.id === selected.card.id
                          ? { ...i, locked }
                          : i
                      )
                    );
                    setSelected((sel) =>
                      sel ? { ...sel, locked } : sel
                    );
                  }}
                  onTraded={() => {
                    reload();
                    setSelected(null);
                  }}
                />
              </div>

              <Button
                className="mt-4 w-full"
                variant="ghost"
                onClick={() => setSelected(null)}
              >
                Close
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
