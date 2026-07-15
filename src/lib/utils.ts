import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Market / pull values (and any $ amount). Alias of formatMarket. */
export function formatPrice(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "$0.00";
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(2)}`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat().format(n);
}

export function scarcityRatio(remaining: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(1, remaining / max));
}

export function scarcityLabel(remaining: number, max: number): string {
  const r = scarcityRatio(remaining, max);
  if (r <= 0) return "Sold Out";
  if (r < 0.05) return "Ultra Scarce";
  if (r < 0.15) return "Extremely Rare";
  if (r < 0.35) return "Scarce";
  if (r < 0.6) return "Limited";
  return "Available";
}

export function dateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}
