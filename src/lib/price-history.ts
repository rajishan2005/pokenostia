/**
 * Deterministic synthetic price history for a card.
 * Uses card id + market price as seed so the chart is stable across loads
 * but still feels like real price action.
 */

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PricePoint {
  date: string;
  price: number;
}

/** 30 daily points ending at current market price */
export function generatePriceHistory(
  cardId: string,
  marketPrice: number,
  days = 30
): PricePoint[] {
  const base = Math.max(0.05, marketPrice || 1);
  const rand = mulberry32(hashSeed(cardId + ":px"));
  const points: PricePoint[] = [];

  // Walk backwards with mean-reverting noise, then reverse
  let p = base * (0.75 + rand() * 0.35);
  const series: number[] = [];
  for (let i = 0; i < days; i++) {
    const drift = (base - p) * 0.08;
    const shock = (rand() - 0.48) * base * 0.06;
    const spike = rand() < 0.04 ? (rand() - 0.3) * base * 0.25 : 0;
    p = Math.max(0.01, p + drift + shock + spike);
    series.push(p);
  }

  // Blend end toward real market price
  const last = series[series.length - 1] || base;
  const scale = base / last;
  for (let i = 0; i < series.length; i++) {
    const t = i / (series.length - 1 || 1);
    series[i] = series[i]! * (1 - t) + series[i]! * scale * t;
    // final point exact market
    if (i === series.length - 1) series[i] = base;
  }

  const now = Date.now();
  for (let i = 0; i < days; i++) {
    const d = new Date(now - (days - 1 - i) * 86400000);
    points.push({
      date: d.toISOString().slice(0, 10),
      price: Math.round(series[i]! * 100) / 100,
    });
  }
  return points;
}

export function quickSellMultiplier(seed: string): number {
  const rand = mulberry32(hashSeed(seed + String(Date.now())));
  // 70% – 95% of market
  return 0.7 + rand() * 0.25;
}
