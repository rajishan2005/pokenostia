/** Pikadollars — in-game currency shown with $ for easy comparison to card market values. */

export const CURRENCY_NAME = "Pikadollar";
export const CURRENCY_NAME_PLURAL = "Pikadollars";
export const CURRENCY_SYMBOL = "$";

/** Format balance / pack cost (whole Pikadollars). */
export function formatPika(amount: number): string {
  if (!Number.isFinite(amount)) return "$0";
  const n = Math.round(amount);
  return `$${n.toLocaleString()}`;
}

/** Format market / pull values (can be fractional). */
export function formatMarket(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "$0.00";
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
  return `$${amount.toFixed(2)}`;
}

/** Suggested pack price in Pikadollars from set identity. */
export function packPriceForSet(setId: string, series?: string | null): number {
  if (setId === "base1") return 8;
  if (setId === "base2" || setId === "base3") return 6;
  if (setId === "base4" || setId === "base5") return 7;
  if (setId === "neo1" || setId?.startsWith("gym")) return 6;
  if (setId === "ex1" || setId?.startsWith("xy")) return 5;
  if (setId === "sv3pt5") return 7;
  if (series?.toLowerCase().includes("base")) return 7;
  if (series?.toLowerCase().includes("sword")) return 5;
  if (series?.toLowerCase().includes("scarlet")) return 5;
  return 5;
}

/** New guest / register balance */
export const STARTING_BALANCE = 500;
export const DEMO_BALANCE = 500;
