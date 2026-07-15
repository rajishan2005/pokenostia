"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatMarket, formatPika } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store/user-store";
import { play } from "@/lib/sounds";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

interface Props {
  cardId: string;
  marketPrice: number;
  cardName: string;
  /** Hide trade actions if user doesn't own the card yet */
  canTrade?: boolean;
  /** Initial starred/keep state from collection */
  initialLocked?: boolean;
  onTraded?: () => void;
  onLockChange?: (locked: boolean) => void;
  className?: string;
  /** Compact star-only control (for pack left header) */
  showStarOnly?: boolean;
}

export function CardTradePanel({
  cardId,
  marketPrice,
  cardName,
  canTrade = true,
  initialLocked = false,
  onTraded,
  onLockChange,
  className,
  showStarOnly = false,
}: Props) {
  const { user, setUser } = useUserStore();
  const [history, setHistory] = useState<{ date: string; price: number }[]>(
    []
  );
  const [changePct, setChangePct] = useState(0);
  const [listPrice, setListPrice] = useState(
    Math.max(1, Math.round(marketPrice))
  );
  const [busy, setBusy] = useState(false);
  const [lockBusy, setLockBusy] = useState(false);
  const [locked, setLocked] = useState(initialLocked);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLocked(initialLocked);
  }, [initialLocked, cardId]);

  useEffect(() => {
    setListPrice(Math.max(1, Math.round(marketPrice * 1.05)));
    setMsg(null);
    setErr(null);
    let alive = true;
    fetch(`/api/cards/${encodeURIComponent(cardId)}/history`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setHistory(d.history || []);
        setChangePct(d.changePct ?? 0);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [cardId, marketPrice]);

  const chartData = useMemo(() => {
    return {
      labels: history.map((h) => h.date.slice(5)), // MM-DD
      datasets: [
        {
          label: "Market $",
          data: history.map((h) => h.price),
          borderColor: changePct >= 0 ? "#34d399" : "#fb7185",
          backgroundColor:
            changePct >= 0
              ? "rgba(52, 211, 153, 0.15)"
              : "rgba(251, 113, 133, 0.15)",
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
        },
      ],
    };
  }, [history, changePct]);

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: { y: number } }) =>
            formatMarket(ctx.parsed.y),
        },
      },
    },
    scales: {
      x: {
        ticks: { color: "#94a3b8", maxTicksLimit: 6, font: { size: 10 } },
        grid: { color: "rgba(255,255,255,0.04)" },
      },
      y: {
        ticks: {
          color: "#94a3b8",
          font: { size: 10 },
          callback: (v: string | number) => `$${v}`,
        },
        grid: { color: "rgba(255,255,255,0.06)" },
      },
    },
  };

  const toggleLock = async () => {
    if (!user || !canTrade) return;
    setLockBusy(true);
    setErr(null);
    const next = !locked;
    try {
      const res = await fetch("/api/collection/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, locked: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Could not update keep status");
        play("error");
      } else {
        setLocked(data.locked);
        onLockChange?.(data.locked);
        setMsg(
          data.locked
            ? "Starred — kept in collection (skipped by quick sell)"
            : "Unstarred — can be quick-sold again"
        );
        play("click");
      }
    } catch {
      setErr("Network error");
    } finally {
      setLockBusy(false);
    }
  };

  const quickSell = async () => {
    if (!user || !canTrade) return;
    if (locked) {
      setErr("This card is starred (kept). Unstar it to sell.");
      play("error");
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/trade/quick-sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Quick sell failed");
        play("error");
      } else {
        setUser(data.user);
        setMsg(
          `Sold instantly for ${formatPika(data.payout)} (${data.percent}% of market ${formatMarket(data.marketPrice)})`
        );
        play("sell");
        onTraded?.();
      }
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  };

  const listForSale = async () => {
    if (!user || !canTrade) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/trade/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, price: Number(listPrice) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "List failed");
        play("error");
      } else {
        if (data.user) setUser(data.user);
        setMsg(
          `Listed ${cardName} for ${formatPika(data.listing.price)} — others can buy on Marketplace`
        );
        play("click");
        onTraded?.();
      }
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  };

  const starButton = (
    <button
      type="button"
      disabled={!user || !canTrade || lockBusy}
      onClick={() => void toggleLock()}
      title={
        locked
          ? "Unstar — allow quick sell"
          : "Star / keep — skip quick sell & sell-all"
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
        locked
          ? "border-amber-400/50 bg-amber-500/20 text-amber-200"
          : "border-white/15 bg-white/5 text-white/70 hover:border-amber-400/40 hover:text-amber-200",
        (!user || !canTrade) && "opacity-40 cursor-not-allowed"
      )}
      aria-pressed={locked}
      aria-label={locked ? "Unstar card" : "Star card to keep"}
    >
      <Star
        className={cn("h-4 w-4", locked && "fill-amber-300 text-amber-300")}
      />
      {locked ? "Kept" : "Keep"}
    </button>
  );

  if (showStarOnly) {
    return (
      <div className={cn("space-y-2", className)}>
        {starButton}
        {msg && (
          <p className="text-[10px] text-emerald-200/90 leading-snug">{msg}</p>
        )}
        {err && (
          <p className="text-[10px] text-rose-200/90 leading-snug">{err}</p>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-wider text-white/40">
            30-day price action
          </p>
          <p
            className={cn(
              "text-xs font-semibold",
              changePct >= 0 ? "text-emerald-300" : "text-rose-300"
            )}
          >
            {changePct >= 0 ? "+" : ""}
            {changePct}%
          </p>
        </div>
        <div className="h-36 w-full rounded-xl border border-white/10 bg-black/30 p-2">
          {history.length > 1 ? (
            <Line data={chartData} options={chartOpts as never} />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-white/35">
              Loading chart…
            </div>
          )}
        </div>
        <p className="mt-1 text-[10px] text-white/35">
          Live market {formatMarket(marketPrice)} · chart is simulated market
          action for interactivity
        </p>
      </div>

      {canTrade && user && (
        <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-wider text-white/40">
              Keep & trade
            </p>
            {starButton}
          </div>
          {locked && (
            <p className="rounded-lg border border-amber-400/25 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-100/90">
              Starred for collection — skipped by Quick sell and Sell all
            </p>
          )}
          <Button
            size="sm"
            className="w-full"
            disabled={busy || locked}
            onClick={() => void quickSell()}
          >
            {locked ? "Starred — can't quick sell" : "Quick sell (70–95% market)"}
          </Button>
          <p className="text-[10px] text-white/40 text-center">
            Instant cash · random 70–95% of {formatMarket(marketPrice)}
          </p>

          <div className="flex gap-2 pt-1">
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-amber-200/80">
                $
              </span>
              <input
                type="number"
                min={1}
                step={1}
                value={listPrice}
                onChange={(e) => setListPrice(Number(e.target.value))}
                className="w-full rounded-xl border border-white/10 bg-black/40 py-2 pl-7 pr-2 text-sm outline-none focus:border-violet-400/50"
              />
            </div>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy || listPrice < 1}
              onClick={() => void listForSale()}
            >
              List for sale
            </Button>
          </div>
          <p className="text-[10px] text-white/40">
            Suggested list ~{formatPika(Math.round(marketPrice * 1.05))} (others
            buy on Marketplace)
          </p>
        </div>
      )}

      {!user && (
        <p className="text-xs text-white/45">Log in to sell or list cards.</p>
      )}
      {user && !canTrade && (
        <p className="text-xs text-white/45">
          Add this card to your collection to trade it.
        </p>
      )}

      {msg && (
        <p className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {msg}
        </p>
      )}
      {err && (
        <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {err}
        </p>
      )}
    </div>
  );
}
