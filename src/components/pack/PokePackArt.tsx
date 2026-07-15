"use client";

import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/brand";
import {
  type PackTheme,
  PACK_THEMES,
  getShopPack,
} from "@/lib/shop-packs";

/** Classic Poké Ball mark — pure CSS */
export function PokeBallMark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dim =
    size === "sm" ? "h-8 w-8" : size === "lg" ? "h-16 w-16" : "h-12 w-12";
  return (
    <div
      className={cn(
        "relative shrink-0 rounded-full border-2 border-black/80 shadow-lg overflow-hidden",
        dim,
        className
      )}
      aria-hidden
    >
      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-red-400 to-red-600" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-b from-slate-100 to-white" />
      <div className="absolute left-0 right-0 top-1/2 h-[12%] -translate-y-1/2 bg-black/90" />
      <div className="absolute left-1/2 top-1/2 h-[34%] w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-black/90 bg-white shadow-inner" />
      <div className="absolute left-1/2 top-1/2 h-[14%] w-[14%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/50 bg-slate-200" />
    </div>
  );
}

function ThemeSeal({
  seal,
  size,
}: {
  seal: (typeof PACK_THEMES)[PackTheme]["seal"];
  size: "sm" | "md" | "lg";
}) {
  if (seal === "ball") return <PokeBallMark size={size} className="mb-2" />;
  const dim =
    size === "sm" ? "h-8 w-8 text-lg" : size === "lg" ? "h-16 w-16 text-3xl" : "h-12 w-12 text-2xl";
  const icon =
    seal === "lock"
      ? "🔐"
      : seal === "crown"
        ? "👑"
        : seal === "gem"
          ? "💎"
          : seal === "bolt"
            ? "⚡"
            : seal === "neon"
              ? "💜"
              : "🌃";
  return (
    <div
      className={cn(
        "mb-2 flex items-center justify-center rounded-2xl border border-white/25 bg-black/30 shadow-lg backdrop-blur-sm",
        dim
      )}
    >
      {icon}
    </div>
  );
}

type PackArtProps = {
  name: string;
  priceLabel?: string;
  packSize?: number;
  className?: string;
  compact?: boolean;
  /** Shop pack id or theme key for premium skins */
  packId?: string;
  theme?: PackTheme;
  banner?: string;
  tagline?: string;
  chanceLabel?: string;
};

/**
 * Pokémon-inspired booster art — themed per shop pack tier.
 */
export function PokePackArt({
  name,
  priceLabel,
  packSize = 10,
  className,
  compact,
  packId,
  theme: themeProp,
  banner,
  tagline,
  chanceLabel,
}: PackArtProps) {
  const shop = packId ? getShopPack(packId) : undefined;
  const themeKey: PackTheme = themeProp || shop?.theme || "rookie";
  const t = PACK_THEMES[themeKey];
  const bannerText = banner || shop?.banner || "Trainer Pack";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border-2 shadow-2xl",
        t.premium && "holo-shine",
        themeKey === "apex" && "holo-shine-gold",
        themeKey === "crown" && "holo-shine-grail",
        compact ? "h-56 w-40" : "h-72 w-52 md:h-80 md:w-56",
        className
      )}
      style={{
        background: t.bg,
        borderColor: t.border,
        boxShadow: t.glow,
      }}
    >
      {/* Foil diagonal */}
      <div className="pointer-events-none absolute -left-8 top-0 h-full w-16 rotate-12 bg-gradient-to-b from-white/40 via-white/10 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_15%,rgba(255,255,255,0.35),transparent_45%)]" />

      {/* Premium edge ring */}
      {t.premium && (
        <div
          className="pointer-events-none absolute inset-1 rounded-xl border border-white/20"
          style={{ boxShadow: `inset 0 0 24px ${t.border}` }}
        />
      )}

      {/* Top stripe */}
      <div
        className="absolute inset-x-0 top-0 h-9 border-b-2 border-black/30"
        style={{ background: t.banner }}
      >
        <p className="flex h-full items-center justify-center text-[9px] font-black uppercase tracking-[0.22em] text-white drop-shadow">
          {bannerText}
        </p>
      </div>

      <div
        className={cn(
          "relative flex h-full flex-col items-center justify-center px-3 text-center",
          compact ? "pt-6" : "pt-8"
        )}
      >
        <ThemeSeal seal={t.seal} size={compact ? "md" : "lg"} />
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.18em] drop-shadow"
          style={{ color: t.accent }}
        >
          {t.premium ? "Premium sealed" : "Energy sealed"}
        </p>
        <p
          className={cn(
            "mt-1 font-black leading-tight text-white drop-shadow-md",
            compact ? "text-sm" : "text-xl"
          )}
        >
          {name}
        </p>
        {priceLabel && (
          <p
            className="mt-2 rounded-full bg-black/40 px-3 py-0.5 text-sm font-bold ring-1"
            style={{ color: t.accent, borderColor: t.border }}
          >
            {priceLabel}
          </p>
        )}
        {chanceLabel && (
          <p className="mt-1 text-[10px] font-semibold text-white/80">
            {chanceLabel}
          </p>
        )}
        {!chanceLabel && (
          <p className="mt-1 text-[10px] font-medium text-white/75">
            {packSize} cards · real art
          </p>
        )}
        {tagline && !compact && (
          <p className="mt-2 line-clamp-2 text-[10px] text-white/55">{tagline}</p>
        )}
      </div>

      {/* Bottom brand bar */}
      <div className="absolute inset-x-0 bottom-0 border-t-2 border-black/25 bg-black/50 px-2 py-1.5 backdrop-blur-sm">
        <p
          className="text-center text-[9px] font-bold uppercase tracking-[0.18em]"
          style={{ color: t.accent }}
        >
          {APP_NAME}
        </p>
      </div>

      {/* Corner energy dots */}
      <div className="absolute bottom-10 left-2 flex flex-col gap-1 opacity-80">
        {["#fbbf24", "#3b82f6", "#ef4444", "#22c55e"].map((c) => (
          <span
            key={c}
            className="h-2 w-2 rounded-full border border-black/40"
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}
