"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/Button";
import { rarityColor, normalizeRarity } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import { formatMarket, formatPika } from "@/lib/currency";
import { useUserStore } from "@/store/user-store";
import type { ExpansionData, PackPhase } from "@/types";
import { CardTradePanel } from "@/components/trade/CardTradePanel";
import { PokePackArt, PokeBallMark } from "@/components/pack/PokePackArt";
import { play, playRarityWin, unlockAudio } from "@/lib/sounds";
import { preloadImageUrls } from "@/lib/image-cache";
import { Star, X } from "lucide-react";

interface PullCard {
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
  isNew?: boolean;
  hp?: string | null;
  types?: string[];
}

interface CardDetails extends PullCard {
  attacks?: {
    name: string;
    cost?: string[];
    convertedEnergyCost?: number;
    damage?: string;
    text?: string;
  }[];
  abilities?: { name: string; text?: string; type?: string }[];
  weaknesses?: { type: string; value: string }[];
  resistances?: { type: string; value: string }[];
  retreatCost?: string[];
  convertedRetreatCost?: number | null;
  rules?: string[];
  subtypes?: string[];
  nationalPokedexNumbers?: number[];
  evolvesFrom?: string | null;
  flavorText?: string | null;
  level?: string | null;
  number?: string | null;
  setSeries?: string | null;
  releaseDate?: string | null;
  supertype?: string | null;
}

interface Props {
  expansion: ExpansionData;
  onDone?: () => void;
}

const CARD_RATIO = 1.396;

function haptic(pattern: number | number[] = 30) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    /* ignore */
  }
}

export function PackOpening({ expansion, onDone }: Props) {
  const { user, setUser } = useUserStore();
  const [phase, setPhase] = useState<PackPhase>("idle");
  const [cards, setCards] = useState<PullCard[]>([]);
  const [dealt, setDealt] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [details, setDetails] = useState<CardDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [achievements, setAchievements] = useState<
    { name: string; icon: string; coins: number }[]
  >([]);
  const [sellAllBusy, setSellAllBusy] = useState(false);
  const [sellAllMsg, setSellAllMsg] = useState<string | null>(null);
  /** Full-screen aesthetic flash when pack seals break */
  const [flash, setFlash] = useState(false);
  const [flashHard, setFlashHard] = useState(false);
  /** High-value pull cinematic overlay (single big hit) */
  const [jackpot, setJackpot] = useState<PullCard | null>(null);
  /** Multi-rare showcase — side by side as they deal onto the deck */
  const [rareShowcase, setRareShowcase] = useState<PullCard[]>([]);
  /** Warming art while shake/tear runs — never deal until these are ready */
  const [warmingCards, setWarmingCards] = useState<PullCard[]>([]);
  const [loadStatus, setLoadStatus] = useState("");
  /** cardId → starred/kept so sell-all UI can reflect skips */
  const [keptIds, setKeptIds] = useState<Record<string, boolean>>({});
  const stripRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const shakeRef = useRef<number | null>(null);
  const rareShowcaseRef = useRef<PullCard[]>([]);

  // Previous base ~300px tall → +15%
  const cardH = Math.round(300 * 1.15); // 345
  const cardW = Math.round(cardH / CARD_RATIO); // ~247
  const overlap = Math.round(cardW * 0.18);

  const stopShake = () => {
    if (shakeRef.current != null) {
      window.clearInterval(shakeRef.current);
      shakeRef.current = null;
    }
  };

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      stopShake();
    },
    []
  );

  // Load full TCG details when a card is selected
  useEffect(() => {
    if (selected == null || !cards[selected]) {
      setDetails(null);
      return;
    }
    const card = cards[selected];
    let cancelled = false;
    setDetailsLoading(true);
    setDetails({
      ...card,
      types: card.types,
      hp: card.hp,
    });

    fetch(`/api/cards/${encodeURIComponent(card.id)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data.card) return;
        setDetails({
          ...card,
          ...data.card,
          marketPrice: card.marketPrice || data.card.marketPrice,
          remaining: card.remaining ?? data.card.remaining,
          maxSupply: card.maxSupply ?? data.card.maxSupply,
          isNew: card.isNew,
        });
      })
      .catch(() => {
        /* keep base details */
      })
      .finally(() => {
        if (!cancelled) setDetailsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selected, cards]);

  // Deal in pack order — rares can appear start/middle, not sorted to the end
  const revealOrder = useMemo(() => {
    return cards.map((_, i) => i);
  }, [cards]);

  const pullTotal = useMemo(
    () => cards.reduce((s, c) => s + c.marketPrice, 0),
    [cards]
  );

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  // If parent swaps expansion without remount (safety), hard reset
  useEffect(() => {
    clearTimers();
    stopShake();
    setPhase("idle");
    setCards([]);
    setDealt(0);
    setSelected(null);
    setDetails(null);
    setError(null);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expansion.id]);

  // When deal finishes, scroll just enough to show the last card (no overshoot)
  useEffect(() => {
    if (phase !== "complete" || !cards.length) return;
    const t = window.setTimeout(() => {
      scrollCardIntoView(cards.length - 1, cards.length);
    }, 80);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cards.length]);

  const sleep = (ms: number) =>
    new Promise<void>((r) => window.setTimeout(r, ms));

  // Prefetch pool thumbs as soon as this pack is selected (before click)
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/packs/warm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expansionId: expansion.id }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (Array.isArray(d.thumbs)) {
          void preloadImageUrls(d.thumbs as string[]);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [expansion.id]);

  const triggerOpenFlash = (hard = false) => {
    setFlashHard(hard);
    setFlash(true);
    window.setTimeout(() => {
      setFlash(false);
      setFlashHard(false);
    }, hard ? 900 : 700);
  };

  const isShowcaseRare = (card: PullCard) =>
    card.rarityTier >= 3 || card.marketPrice >= 25;

  const isUltraHit = (card: PullCard) =>
    card.marketPrice >= 80 ||
    card.rarityTier >= 6 ||
    card.marketPrice > 1000;

  /** Push rare into side-by-side showcase as it lands on the deck */
  const pushRareShowcase = (card: PullCard) => {
    if (!isShowcaseRare(card)) return;
    // Avoid dup if same card id appears twice in one pack
    if (rareShowcaseRef.current.some((c) => c.id === card.id)) return;
    const next = [...rareShowcaseRef.current, card];
    rareShowcaseRef.current = next;
    setRareShowcase(next);

    if (next.length >= 2) {
      try {
        confetti({
          particleCount: 36 + next.length * 14,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#fbbf24", "#fff", "#c084fc", rarityColor(card.rarityTier)],
        });
      } catch {
        /* ignore */
      }
      playRarityWin(Math.max(card.rarityTier, 5));
      haptic([20, 25, 40]);
    }
  };

  const fireHighValuePull = (card: PullCard) => {
    if (!isUltraHit(card)) return;
    // Still add to multi-rare row; also big solo flash for ultra
    pushRareShowcase(card);
    try {
      confetti({
        particleCount: card.marketPrice > 1000 ? 140 : 70 + card.rarityTier * 10,
        spread: 80,
        startVelocity: 45,
        origin: { y: 0.55 },
        colors:
          card.marketPrice > 1000
            ? ["#fbbf24", "#f59e0b", "#fff7ed", "#fde68a", "#fff"]
            : [rarityColor(card.rarityTier), "#fff", "#ffd56a", "#c084fc"],
      });
      confetti({
        particleCount: 40,
        angle: 60,
        spread: 50,
        origin: { x: 0, y: 0.7 },
        colors: ["#fbbf24", "#fff"],
      });
      confetti({
        particleCount: 40,
        angle: 120,
        spread: 50,
        origin: { x: 1, y: 0.7 },
        colors: ["#fbbf24", "#fff"],
      });
    } catch {
      /* ignore */
    }
    // Solo legendary banner only when it's the first ultra of the pack
    if (rareShowcaseRef.current.filter(isUltraHit).length <= 1) {
      setJackpot(card);
      window.setTimeout(() => setJackpot(null), 2200);
    }
    playRarityWin(Math.max(card.rarityTier, 8));
    haptic([40, 30, 60, 40, 80]);
  };

  const sharePull = async (card?: PullCard) => {
    const best =
      card ||
      [...cards].sort(
        (a, b) => b.marketPrice - a.marketPrice || b.rarityTier - a.rarityTier
      )[0];
    if (!best) return;
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/share/card/${encodeURIComponent(best.id)}`
        : "";
    const text = `I pulled ${best.name} (${best.rarity}) worth $${best.marketPrice.toFixed(2)} on PokeNostia! ${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "PokeNostia pull", text, url });
      } else {
        await navigator.clipboard.writeText(text);
        setSellAllMsg("Share text copied to clipboard!");
      }
      play("click");
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        setSellAllMsg("Share text copied to clipboard!");
      } catch {
        /* ignore */
      }
    }
  };

  const startOpen = async () => {
    unlockAudio();
    if (!user) {
      setError("Please log in to open packs.");
      play("error");
      return;
    }
    if (user.coins < expansion.packCost) {
      setError(
        `Need ${formatPika(expansion.packCost)} Pikadollars. Play games to earn more!`
      );
      play("error");
      return;
    }

    setError(null);
    setLoading(true);
    setFlash(false);
    setDealt(0);
    setSelected(null);
    setDetails(null);
    setCards([]);
    setWarmingCards([]);
    setLoadStatus("Opening…");
    setAchievements([]);
    setSellAllMsg(null);
    setKeptIds({});
    setJackpot(null);
    setRareShowcase([]);
    rareShowcaseRef.current = [];

    // Shake animation starts immediately
    setPhase("vibrating");
    play("packOpen");
    play("shake");
    haptic([25, 40, 25, 40, 50]);
    stopShake();
    shakeRef.current = window.setInterval(() => {
      play("shake");
      haptic(10);
    }, 400);

    // Shake + fetch in parallel; warm images in background (never block deal)
    const MIN_OPEN_MS = 2800;
    const TEAR_MS = 1300;
    const minTimer = sleep(MIN_OPEN_MS);

    try {
      const fetchPromise = fetch("/api/packs/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expansionId: expansion.id }),
      }).then(async (res) => ({ res, data: await res.json() }));

      // max(shake, API) — not sum, and no image wait
      const [{ res, data }] = await Promise.all([fetchPromise, minTimer]);

      if (!res.ok) {
        stopShake();
        setError(data.error || "Failed to open pack");
        setPhase("idle");
        setLoading(false);
        setWarmingCards([]);
        setLoadStatus("");
        play("error");
        return;
      }

      const pullCards: PullCard[] = data.cards || [];
      if (!pullCards.length) {
        stopShake();
        setError("Pack came back empty — try again");
        setPhase("idle");
        setLoading(false);
        setLoadStatus("");
        play("error");
        return;
      }

      setUser(data.user);
      setAchievements(data.achievements || []);
      setCards(pullCards);

      // Fire-and-forget: warm thumbs while tear plays (don't await)
      const thumbUrls = pullCards
        .map((c) => c.imageSmall || c.imageLarge || "")
        .filter(Boolean);
      void preloadImageUrls(thumbUrls, 12);

      setWarmingCards([]);
      setLoadStatus("");
      stopShake();
      setLoading(false);

      const hasBig =
        pullCards.some((c) => c.marketPrice > 1000 || c.rarityTier >= 8) ||
        pullCards.reduce((s, c) => s + c.marketPrice, 0) > 200;
      triggerOpenFlash(true);
      window.setTimeout(() => triggerOpenFlash(hasBig), 160);
      play("packOpen");
      haptic([40, 30, 70, 40, 90]);
      setPhase("tearing");

      await sleep(TEAR_MS);

      setPhase("aligning");
      haptic(40);
    } catch {
      stopShake();
      setError("Network error");
      setPhase("idle");
      setLoading(false);
      setWarmingCards([]);
      setLoadStatus("");
      play("error");
    }
  };

  /** Scroll so newest card is visible — last card flushes to the right edge (no dead space) */
  const scrollCardIntoView = (stepIdx: number, total: number) => {
    const el = stripRef.current;
    if (!el) return;
    const step = cardW - overlap;
    const leftPad = 12;
    // Position of card's right edge in content coordinates
    const cardLeft = leftPad + stepIdx * step;
    const cardRight = cardLeft + cardW;

    const apply = () => {
      const strip = stripRef.current;
      if (!strip) return;
      const maxScroll = Math.max(0, strip.scrollWidth - strip.clientWidth);
      // Keep card fully in view; on last card, scroll just enough (maxScroll with tight strip)
      let target = cardRight - strip.clientWidth + 12;
      if (stepIdx >= total - 1) {
        target = maxScroll; // end of content = last card's right edge
      }
      target = Math.max(0, Math.min(target, maxScroll));
      strip.scrollTo({ left: target, behavior: "smooth" });
    };

    apply();
    window.requestAnimationFrame(() => {
      window.setTimeout(apply, 50);
    });
  };

  useEffect(() => {
    if (phase !== "aligning" || !cards.length) return;
    clearTimers();
    setDealt(0);
    setSelected(null);
    rareShowcaseRef.current = [];
    setRareShowcase([]);

    // Sequential pack order (not rarity-sorted)
    const order = cards.map((_, i) => i);

    order.forEach((cardIndex, stepIdx) => {
      const t = window.setTimeout(() => {
        setDealt(stepIdx + 1);
        haptic(10);
        const card = cards[cardIndex];
        if (card) {
          if (isUltraHit(card)) {
            fireHighValuePull(card);
          } else if (isShowcaseRare(card)) {
            pushRareShowcase(card);
            playRarityWin(card.rarityTier);
            haptic(15);
          } else {
            play("deal");
          }
        } else {
          play("deal");
        }
        scrollCardIntoView(stepIdx, order.length);
        if (stepIdx === order.length - 1) {
          // Hold multi-rare showcase a beat, then finish
          const hold =
            rareShowcaseRef.current.length >= 2 ? 1600 : 450;
          const fin = window.setTimeout(() => {
            scrollCardIntoView(order.length - 1, order.length);
            setPhase("complete");
            play("complete");
            // Soft fade showcase after complete
            const fade = window.setTimeout(() => {
              setRareShowcase([]);
              rareShowcaseRef.current = [];
            }, 2200);
            timers.current.push(fade);
          }, hold);
          timers.current.push(fin);
        }
      }, 160 + stepIdx * 220);
      timers.current.push(t);
    });

    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cards]);

  const fireRare = (card: PullCard) => {
    // Replay rarity win sound when selecting a card
    playRarityWin(card.rarityTier);
    if (card.rarityTier < 4) return;
    try {
      confetti({
        particleCount: 28 + card.rarityTier * 8,
        spread: 55 + card.rarityTier * 4,
        origin: { y: 0.65 },
        colors: [rarityColor(card.rarityTier), "#fff", "#ffd56a"],
      });
    } catch {
      /* ignore */
    }
  };

  const reset = () => {
    clearTimers();
    setPhase("idle");
    setCards([]);
    setDealt(0);
    setSelected(null);
    setDetails(null);
    setError(null);
    setSellAllMsg(null);
    setKeptIds({});
    setFlash(false);
    setFlashHard(false);
    setJackpot(null);
    setRareShowcase([]);
    rareShowcaseRef.current = [];
    setWarmingCards([]);
    setLoadStatus("");
    play("click");
    onDone?.();
  };

  /** Quick-sell free cards from this pack (skips starred/kept) */
  const sellAllFromPack = async () => {
    if (!user || !cards.length || sellAllBusy) return;
    setSellAllBusy(true);
    setSellAllMsg(null);
    try {
      const res = await fetch("/api/trade/sell-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardIds: cards.map((c) => c.id) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSellAllMsg(data.error || "Sell all failed");
        play("error");
      } else {
        setUser(data.user);
        const keptN = cards.filter((c) => keptIds[c.id]).length;
        setSellAllMsg(
          keptN > 0
            ? `Sold ${data.soldCount} · kept ${keptN} starred · ${formatPika(data.totalPayout)}`
            : `Sold ${data.soldCount} cards for ${formatPika(data.totalPayout)}`
        );
        play("sell");
      }
    } catch {
      setSellAllMsg("Network error");
      play("error");
    } finally {
      setSellAllBusy(false);
    }
  };

  const displayList = useMemo(() => {
    return revealOrder.slice(0, dealt).map((cardIndex, displayIndex) => ({
      card: cards[cardIndex]!,
      cardIndex,
      displayIndex,
    }));
  }, [revealOrder, dealt, cards]);

  const profit = pullTotal - expansion.packCost;
  const showingDeck = phase === "aligning" || phase === "complete";
  const panelOpen = selected != null && details != null;

  return (
    <div className="relative w-full">
      {/* Off-screen art warm while opening animation runs — so deal never waits on CDN */}
      {warmingCards.length > 0 && (
        <div
          className="pointer-events-none fixed left-[-9999px] top-0 h-px w-px overflow-hidden opacity-0"
          aria-hidden
        >
          {warmingCards.map((c) => (
            <span key={c.id}>
              {c.imageLarge ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.imageLarge} alt="" width={1} height={1} />
              ) : null}
              {c.imageSmall ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.imageSmall} alt="" width={1} height={1} />
              ) : null}
            </span>
          ))}
        </div>
      )}

      {/* Aesthetic full-screen flash when the seal breaks */}
      {flash && (
        <div
          className={cn(
            "pack-open-flash pointer-events-none fixed inset-0 z-[100]",
            flashHard && "pack-open-flash--hard"
          )}
          aria-hidden
        />
      )}

      {/* High-value pull cinematic (single ultra) */}
      {jackpot && rareShowcase.length < 2 && (
        <div className="jackpot-overlay pointer-events-none fixed inset-0 z-[110] flex items-center justify-center">
          <div className="jackpot-burst" />
          <div className="relative z-10 flex max-w-sm flex-col items-center px-6 text-center">
            <p className="text-xs font-black uppercase tracking-[0.35em] text-amber-200 drop-shadow">
              {jackpot.marketPrice > 1000 ? "LEGENDARY PULL" : "HIGH VALUE"}
            </p>
            <p className="mt-2 text-3xl font-black text-white drop-shadow-lg">
              {jackpot.name}
            </p>
            <p className="mt-1 text-lg font-bold text-amber-300">
              {formatMarket(jackpot.marketPrice)}
            </p>
            {(jackpot.imageLarge || jackpot.imageSmall) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={jackpot.imageLarge || jackpot.imageSmall || ""}
                alt={jackpot.name}
                className="jackpot-card mt-4 w-36 rounded-xl border-2 border-amber-300/70 shadow-2xl"
              />
            )}
          </div>
        </div>
      )}

      {/* Multi-rare showcase — side by side as rares land on the deck */}
      {rareShowcase.length >= 1 && (phase === "aligning" || phase === "complete") && (
        <div
          className={cn(
            "pointer-events-none fixed inset-x-0 bottom-6 z-[105] flex justify-center px-3",
            rareShowcase.length >= 2 && "rare-multi-stage"
          )}
          aria-hidden
        >
          <div className="rare-multi-row flex max-w-[96vw] items-end justify-center gap-2 sm:gap-3">
            {rareShowcase.map((c, i) => {
              const img = c.imageSmall || c.imageLarge;
              const n = rareShowcase.length;
              // Fan layout: outer cards tilt out
              const mid = (n - 1) / 2;
              const tilt = (i - mid) * 7;
              const lift = Math.abs(i - mid) * 6;
              return (
                <div
                  key={`${c.id}-${i}`}
                  className="rare-multi-card relative"
                  style={{
                    animationDelay: `${i * 0.08}s`,
                    zIndex: 10 + i,
                  }}
                >
                  <div
                    style={{
                      transform: `rotate(${tilt}deg) translateY(${lift}px)`,
                    }}
                  >
                    <div
                      className="overflow-hidden rounded-xl border-2 shadow-2xl"
                      style={{
                        width: n >= 4 ? 72 : n === 3 ? 88 : 104,
                        borderColor:
                          c.marketPrice > 1000
                            ? "rgba(251,191,36,0.85)"
                            : `${rarityColor(c.rarityTier)}99`,
                        boxShadow: `0 12px 32px rgba(0,0,0,0.5), 0 0 20px ${rarityColor(c.rarityTier)}55`,
                      }}
                    >
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={img}
                          alt={c.name}
                          className="block h-auto w-full"
                          draggable={false}
                        />
                      ) : (
                        <div className="flex aspect-[63/88] items-center justify-center bg-slate-900 p-1 text-center text-[9px] font-bold text-white">
                          {c.name}
                        </div>
                      )}
                    </div>
                    {n >= 2 && (
                      <p className="mt-1 max-w-[104px] truncate text-center text-[9px] font-semibold text-white/80 drop-shadow">
                        {c.name}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {rareShowcase.length >= 2 && (
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-amber-300/40 bg-black/55 px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-amber-200 backdrop-blur-sm">
              {rareShowcase.length} rares · multi hit
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
          <button type="button" className="ml-3 underline" onClick={reset}>
            Reset
          </button>
        </div>
      )}

      <div
        className={cn(
          "relative mx-auto w-full overflow-hidden rounded-3xl border border-white/10",
          "bg-gradient-to-b from-[#1a1040]/95 via-[#0c0828] to-[#07061a]",
          "min-h-[460px]"
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(124,92,255,0.22),transparent_60%)]" />

        {(phase === "idle" || phase === "vibrating") && (
          <div className="relative z-10 flex min-h-[460px] flex-col items-center justify-center py-10">
            <button
              type="button"
              disabled={loading || phase === "vibrating"}
              onClick={() => void startOpen()}
              className={cn(
                "cursor-pointer border-0 bg-transparent p-0",
                phase === "vibrating" && "pack-shake"
              )}
            >
              <PackVisual expansion={expansion} />
            </button>
            <p className="mt-5 text-sm text-white/60">
              {phase === "vibrating"
                ? loadStatus || "Opening pack…"
                : `Click pack · ${formatPika(expansion.packCost)}`}
            </p>
          </div>
        )}

        {/* Top cut-open beat */}
        {phase === "tearing" && (
          <div className="relative z-10 flex min-h-[460px] flex-col items-center justify-center py-10">
            <PackCutVisual expansion={expansion} />
            <p className="mt-6 text-sm text-white/60">Cutting the pack open…</p>
          </div>
        )}

        {showingDeck && (
          <div className="relative z-10 flex min-h-[460px]">
            {/* LEFT DETAIL PANEL */}
            <aside
              className={cn(
                "shrink-0 overflow-y-auto border-r border-white/10 transition-all duration-300",
                panelOpen
                  ? "w-[min(340px,42vw)] opacity-100"
                  : "w-0 opacity-0 overflow-hidden border-0"
              )}
            >
              {panelOpen && details && (
                <CardInfoPanel
                  details={details}
                  loading={detailsLoading}
                  canTrade={phase === "complete" || phase === "aligning"}
                  locked={!!keptIds[details.id]}
                  onClose={() => {
                    setSelected(null);
                    setDetails(null);
                  }}
                  onLockChange={(locked) => {
                    setKeptIds((prev) => ({ ...prev, [details.id]: locked }));
                  }}
                  onTraded={() => {
                    // keep panel open; balance already updated in store
                  }}
                />
              )}
            </aside>

            {/* CARD STRIP */}
            <div className="flex min-w-0 flex-1 flex-col">
              <div
                ref={stripRef}
                className="flex-1 overflow-x-auto overflow-y-visible px-5 py-8"
                style={{
                  WebkitOverflowScrolling: "touch",
                  touchAction: "pan-x",
                }}
              >
                <div
                  className="flex items-end"
                  style={{
                    // Exact width for N overlapping cards — no dead space after last
                    width:
                      displayList.length === 0
                        ? "100%"
                        : 12 +
                          (displayList.length - 1) * (cardW - overlap) +
                          cardW +
                          12,
                    minHeight: cardH + 48,
                    paddingLeft: 12,
                    paddingRight: 12,
                  }}
                >
                  {displayList.map(({ card, cardIndex, displayIndex }) => {
                    const isSelected = selected === cardIndex;
                    return (
                      <button
                        key={`${card.id}-${cardIndex}`}
                        type="button"
                        onClick={() => {
                          const next =
                            selected === cardIndex ? null : cardIndex;
                          setSelected(next);
                          haptic(15);
                          if (next != null) fireRare(card);
                          else play("click");
                        }}
                        className="deal-card-enter relative shrink-0 border-0 bg-transparent p-0 text-left outline-none"
                        style={{
                          width: cardW,
                          height: cardH,
                          marginLeft: displayIndex === 0 ? 0 : -overlap,
                          zIndex: isSelected ? 50 : 10 + displayIndex,
                          transform: isSelected
                            ? "translateY(-32px) scale(1.04)"
                            : "translateY(0) scale(1)",
                          transition:
                            "transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)",
                          cursor: "pointer",
                          pointerEvents: "auto",
                        }}
                      >
                        <CardFace card={card} raised={isSelected} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="pb-3 text-center text-xs text-white/40">
                {phase === "aligning"
                  ? `Dealing ${dealt}/${cards.length}…`
                  : panelOpen
                    ? "Tap another card or close the panel"
                    : "Scroll · tap a card for full stats on the left"}
              </p>
            </div>
          </div>
        )}
      </div>

      {phase === "aligning" && (
        <div className="mx-auto mt-3 h-1.5 max-w-lg overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-all duration-300"
            style={{
              width: `${cards.length ? (dealt / cards.length) * 100 : 0}%`,
            }}
          />
        </div>
      )}

      {phase === "complete" && (
        <div className="mt-5 space-y-4">
          <div className="glass-strong mx-auto flex max-w-2xl flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid flex-1 grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[10px] uppercase text-white/40">Pack cost</p>
                <p className="text-lg font-bold">
                  {formatPika(expansion.packCost)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-white/40">Pull value</p>
                <p className="text-lg font-bold text-amber-300">
                  {formatMarket(pullTotal)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-white/40">Result</p>
                <p
                  className={cn(
                    "text-lg font-bold",
                    profit >= 0 ? "text-emerald-300" : "text-rose-300"
                  )}
                >
                  {profit >= 0 ? "+" : "−"}
                  {formatMarket(Math.abs(profit))}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:min-w-[140px]">
              <Button
                size="sm"
                className="w-full"
                disabled={sellAllBusy || !!sellAllMsg?.startsWith("Sold")}
                onClick={() => void sellAllFromPack()}
              >
                {sellAllBusy
                  ? "Selling…"
                  : sellAllMsg?.startsWith("Sold")
                    ? "Sold"
                    : "Sell all"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="w-full"
                onClick={() => void sharePull()}
              >
                Share best pull
              </Button>
            </div>
          </div>
          {sellAllMsg && (
            <p className="text-center text-sm text-emerald-200/90">{sellAllMsg}</p>
          )}
          <p className="text-center text-[11px] text-white/40">
            Sell all = 70–95% market · star cards on the left to keep them
          </p>
          {achievements.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {achievements.map((a) => (
                <span
                  key={a.name}
                  className="glass rounded-full px-3 py-1 text-sm"
                >
                  {a.icon} {a.name} (+{formatPika(a.coins)})
                </span>
              ))}
            </div>
          )}
          <div className="flex justify-center">
            <Button size="sm" variant="ghost" onClick={reset}>
              Open another
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CardInfoPanel({
  details,
  loading,
  canTrade,
  locked,
  onClose,
  onTraded,
  onLockChange,
}: {
  details: CardDetails;
  loading: boolean;
  canTrade?: boolean;
  locked?: boolean;
  onClose: () => void;
  onTraded?: () => void;
  onLockChange?: (locked: boolean) => void;
}) {
  const src = details.imageLarge || details.imageSmall;
  const types = details.types || [];

  return (
    <div className="flex h-full max-h-[min(78vh,640px)] min-h-[460px] flex-col p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          {/* Star keep — left side of pack detail panel */}
          {canTrade ? (
            <button
              type="button"
              title={
                locked
                  ? "Unstar — allow quick sell"
                  : "Star to keep in collection (skip quick sell)"
              }
              onClick={async () => {
                const next = !locked;
                try {
                  const res = await fetch("/api/collection/lock", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      cardId: details.id,
                      locked: next,
                    }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    onLockChange?.(data.locked);
                    play("click");
                  } else {
                    play("error");
                  }
                } catch {
                  play("error");
                }
              }}
              className={cn(
                "mt-0.5 shrink-0 rounded-lg border p-1.5 transition-colors",
                locked
                  ? "border-amber-400/50 bg-amber-500/20 text-amber-300"
                  : "border-white/15 bg-white/5 text-white/45 hover:border-amber-400/40 hover:text-amber-200"
              )}
              aria-pressed={!!locked}
              aria-label={locked ? "Unstar card" : "Star card to keep"}
            >
              <Star
                className={cn(
                  "h-5 w-5",
                  locked && "fill-amber-300 text-amber-300"
                )}
              />
            </button>
          ) : null}
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-violet-300/80">
              Card details
            </p>
            <h3 className="truncate text-lg font-bold leading-tight">
              {details.name}
            </h3>
            {locked && (
              <p className="mt-0.5 text-[10px] font-medium text-amber-300/90">
                ★ Kept · skipped by sell
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto text-sm pr-1">
        {src && (
          <div className="relative mx-auto w-[40%] overflow-hidden rounded-xl border border-white/15 shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={details.name} className="block w-full h-auto" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Stat
            label="Market value"
            value={formatMarket(details.marketPrice)}
            accent
          />
          <Stat
            label="Rarity"
            value={normalizeRarity(details.rarity)}
            color={rarityColor(details.rarityTier)}
          />
          <Stat label="HP" value={details.hp || "—"} />
          <Stat
            label="Type"
            value={types.length ? types.join(" · ") : "—"}
          />
          <Stat label="Set" value={details.setName || "—"} />
          <Stat
            label="No."
            value={details.number ? `#${details.number}` : "—"}
          />
          <Stat label="Artist" value={details.artist || "—"} />
          <Stat
            label="Supply"
            value={`${details.remaining}/${details.maxSupply}`}
          />
        </div>

        {/* Price chart + trade */}
        <CardTradePanel
          cardId={details.id}
          marketPrice={details.marketPrice}
          cardName={details.name}
          canTrade={!!canTrade}
          initialLocked={!!locked}
          onLockChange={onLockChange}
          onTraded={onTraded}
        />

        {details.nationalPokedexNumbers &&
          details.nationalPokedexNumbers.length > 0 && (
            <Stat
              label="Pokédex"
              value={details.nationalPokedexNumbers
                .map((n) => `#${n}`)
                .join(", ")}
            />
          )}

        {details.evolvesFrom && (
          <Stat label="Evolves from" value={details.evolvesFrom} />
        )}

        {details.subtypes && details.subtypes.length > 0 && (
          <Stat label="Subtypes" value={details.subtypes.join(", ")} />
        )}

        {details.abilities && details.abilities.length > 0 && (
          <section>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-white/40">
              Abilities
            </p>
            <div className="space-y-2">
              {details.abilities.map((a) => (
                <div
                  key={a.name}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <p className="font-semibold text-violet-200">
                    {a.name}
                    {a.type ? (
                      <span className="ml-2 text-[10px] text-white/40">
                        {a.type}
                      </span>
                    ) : null}
                  </p>
                  {a.text && (
                    <p className="mt-1 text-xs leading-relaxed text-white/60">
                      {a.text}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {details.attacks && details.attacks.length > 0 && (
          <section>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-white/40">
              Attacks
            </p>
            <div className="space-y-2">
              {details.attacks.map((a) => (
                <div
                  key={a.name + (a.damage || "")}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{a.name}</p>
                    {a.damage && (
                      <span className="text-sm font-bold text-amber-200">
                        {a.damage}
                      </span>
                    )}
                  </div>
                  {a.cost && a.cost.length > 0 && (
                    <p className="mt-0.5 text-[11px] text-white/45">
                      Cost: {a.cost.join(" · ")}
                    </p>
                  )}
                  {a.text && (
                    <p className="mt-1 text-xs leading-relaxed text-white/60">
                      {a.text}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {(details.weaknesses?.length || details.resistances?.length) && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40">
                Weakness
              </p>
              <p className="text-xs text-white/70">
                {details.weaknesses?.length
                  ? details.weaknesses
                      .map((w) => `${w.type} ${w.value}`)
                      .join(", ")
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40">
                Resistance
              </p>
              <p className="text-xs text-white/70">
                {details.resistances?.length
                  ? details.resistances
                      .map((w) => `${w.type} ${w.value}`)
                      .join(", ")
                  : "—"}
              </p>
            </div>
          </div>
        )}

        {details.flavorText && (
          <p className="border-l-2 border-violet-400/40 pl-3 text-xs italic leading-relaxed text-white/45">
            {details.flavorText}
          </p>
        )}

        {details.isNew && (
          <p className="text-center text-xs font-semibold text-emerald-300">
            ⚡ New to your collection
          </p>
        )}

        {loading && (
          <p className="text-center text-[11px] text-white/35">
            Loading live TCG stats…
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  color,
}: {
  label: string;
  value: string;
  accent?: boolean;
  color?: string;
}) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 px-2.5 py-2">
      <p className="text-[9px] uppercase tracking-wider text-white/40">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-sm font-semibold truncate",
          accent && "text-amber-300"
        )}
        style={color ? { color } : undefined}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function PackVisual({ expansion }: { expansion: ExpansionData }) {
  return (
    <PokePackArt
      packId={expansion.id}
      name={expansion.name}
      priceLabel={formatPika(expansion.packCost)}
      packSize={expansion.packSize}
      tagline={expansion.tagline}
    />
  );
}

/**
 * Pack top cuts open left→right, then flaps split apart.
 * Pure CSS so it always plays visibly.
 */
function PackCutVisual({ expansion }: { expansion: ExpansionData }) {
  const packBg =
    "linear-gradient(165deg, #1e3a8a 0%, #2563eb 22%, #dc2626 55%, #fbbf24 88%, #fef3c7 100%)";

  return (
    <div className="relative h-80 w-56 md:h-[22rem] md:w-60">
      {/* Blank card silhouettes rising out of the cut (not rods) */}
      <div className="pack-cut-cards pointer-events-none absolute inset-x-4 top-4 bottom-8 z-0 flex items-end justify-center gap-1.5 px-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="pack-cut-card shrink-0"
            style={{
              width: "18%",
              maxHeight: "82%",
              animationDelay: `${0.32 + i * 0.08}s`,
            }}
          >
            <div
              className="relative w-full overflow-hidden rounded-[6px] border border-white/35 shadow-2xl"
              style={{
                aspectRatio: "63 / 88",
                background:
                  "linear-gradient(165deg, #1e293b 0%, #0f172a 40%, #1e1b4b 100%)",
                transform: `rotate(${(i - 2) * 4}deg)`,
                boxShadow: "0 8px 20px rgba(0,0,0,0.55)",
              }}
            >
              {/* Card face fake art area */}
              <div className="absolute inset-[8%] rounded-[3px] border border-white/10 bg-gradient-to-br from-slate-700/80 via-slate-900 to-indigo-950" />
              {/* Holo sheen */}
              <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.12)_48%,transparent_65%)]" />
              {/* Bottom name bar stub */}
              <div className="absolute inset-x-[10%] bottom-[10%] h-[10%] rounded-sm bg-white/10" />
              {/* Corner rarity pip */}
              <div className="absolute right-[12%] top-[12%] h-1.5 w-1.5 rounded-full bg-amber-300/50" />
            </div>
          </div>
        ))}
      </div>

      {/* Lower body of pack (stays) */}
      <div
        className="absolute inset-x-0 bottom-0 top-[38%] z-10 overflow-hidden rounded-b-2xl border-2 border-t-0 border-yellow-300/40 shadow-2xl"
        style={{ background: packBg }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.2),transparent_55%)]" />
        <div className="absolute inset-x-0 bottom-5 flex flex-col items-center text-center">
          <PokeBallMark size="sm" className="mb-1 opacity-90" />
          <p className="text-sm font-bold drop-shadow-md">{expansion.name}</p>
          <p className="text-[10px] text-yellow-100/80">
            {formatPika(expansion.packCost)}
          </p>
        </div>
      </div>

      {/* Top half — splits into left & right flaps */}
      <div className="absolute inset-x-0 top-0 z-20 h-[42%]">
        {/* Left flap — blue energy */}
        <div
          className="pack-cut-flap-left absolute left-0 top-0 h-full w-1/2 overflow-hidden rounded-tl-2xl border-2 border-r-0 border-yellow-200/40"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.55) 0%, rgba(59,130,246,0.85) 45%, rgba(30,58,138,0.95) 100%)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)] opacity-60" />
        </div>
        {/* Right flap — red energy */}
        <div
          className="pack-cut-flap-right absolute right-0 top-0 h-full w-1/2 overflow-hidden rounded-tr-2xl border-2 border-l-0 border-yellow-200/40"
          style={{
            background:
              "linear-gradient(225deg, rgba(255,255,255,0.55) 0%, rgba(248,113,113,0.85) 45%, rgba(185,28,28,0.95) 100%)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)] opacity-60" />
        </div>

        {/* Cutting beam left → right */}
        <div className="pointer-events-none absolute left-0 right-0 top-[72%] z-30 h-[3px]">
          <div className="pack-cut-beam h-full rounded-full bg-gradient-to-r from-transparent via-amber-100 to-white shadow-[0_0_12px_#fde68a,0_0_24px_#fbbf24]" />
        </div>
        {/* Blade / cut head */}
        <div className="pack-cut-blade pointer-events-none absolute top-[62%] z-40 h-5 w-5 -translate-y-1/2">
          <div className="h-full w-full rotate-45 rounded-sm bg-gradient-to-br from-white via-amber-100 to-amber-300 shadow-[0_0_16px_#fbbf24]" />
        </div>
      </div>

      {/* Label */}
      <div className="pointer-events-none absolute inset-x-0 top-[18%] z-10 text-center">
        <span className="rounded-full bg-black/35 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-yellow-100/90 backdrop-blur-sm">
          Tear open
        </span>
      </div>
    </div>
  );
}

/** Full card art — always paint the image (no opacity gate that can stick at 0) */
function CardFace({ card, raised }: { card: PullCard; raised: boolean }) {
  const src = card.imageSmall || card.imageLarge || "";
  const [failed, setFailed] = useState(false);
  const fallback = !failed ? "" : card.imageLarge && card.imageLarge !== src
    ? card.imageLarge
    : "";

  useEffect(() => {
    setFailed(false);
  }, [card.id, card.imageSmall, card.imageLarge]);

  const displaySrc = failed && fallback ? fallback : src;
  const isGold = card.marketPrice > 1000;
  const isHolo = !isGold && (card.rarityTier >= 3 || card.marketPrice >= 15);
  const isSuper =
    !isGold &&
    (card.rarityTier >= 6 ||
      card.marketPrice >= 80 ||
      /secret|illustration|rainbow|hyper|amazing|vmax|gx|ex/i.test(
        card.rarity || ""
      ));
  const isGrail =
    !isGold && (card.marketPrice >= 500 || card.rarityTier >= 8);
  const glow = isGold ? "#fbbf24" : rarityColor(card.rarityTier);

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden rounded-2xl border bg-slate-900",
        raised
          ? isGold
            ? "border-amber-300/90 ring-2 ring-amber-400/50"
            : "border-amber-300/70 ring-2 ring-amber-300/30"
          : isGold
            ? "border-amber-400/70"
            : "border-white/25",
        isHolo && "holo-shine",
        isSuper && "holo-shine-super",
        isGrail && "holo-shine-grail",
        isGold && "holo-shine-gold"
      )}
      style={{
        boxShadow: raised
          ? `0 24px 50px rgba(0,0,0,0.65), 0 0 36px ${glow}88`
          : isGold
            ? "0 14px 44px rgba(0,0,0,0.55), 0 0 32px rgba(251,191,36,0.55)"
            : "0 12px 32px rgba(0,0,0,0.5)",
      }}
    >
      {/* Soft underlay while network paints */}
      <div
        className="absolute inset-0 z-0"
        style={{
          background: `linear-gradient(160deg, #1e293b, ${glow}44, #0f172a)`,
        }}
      />
      <div className="absolute inset-0 z-0 flex items-center justify-center p-2 text-center text-xs font-bold text-white/70">
        {card.name}
      </div>

      {displaySrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={displaySrc}
          src={displaySrc}
          alt={card.name}
          className="pointer-events-none absolute inset-0 z-[1] h-full w-full object-cover"
          draggable={false}
          loading="eager"
          decoding="async"
          onError={() => {
            if (!failed && card.imageLarge && card.imageLarge !== src) {
              setFailed(true);
            }
          }}
        />
      ) : null}

      {isGold && (
        <>
          <div className="gold-shine-band z-[2]" aria-hidden />
          <div
            className="pointer-events-none absolute inset-0 z-[2] gold-sparkle"
            aria-hidden
          />
        </>
      )}
      {isHolo && !isGold && (
        <div
          className={cn(
            "white-shine-band z-[2]",
            isSuper && "white-shine-band--super",
            isGrail && "white-shine-band--grail"
          )}
          aria-hidden
        />
      )}
      {isSuper && !isGold && (
        <div
          className="pointer-events-none absolute inset-0 z-[2] card-sparkle"
          aria-hidden
        />
      )}
    </div>
  );
}
