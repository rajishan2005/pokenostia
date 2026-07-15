"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn, formatPrice, scarcityLabel } from "@/lib/utils";
import { rarityColor, normalizeRarity } from "@/lib/rarity";

interface Props {
  name: string;
  image?: string | null;
  rarity: string;
  rarityTier: number;
  marketPrice?: number;
  remaining?: number;
  maxSupply?: number;
  hp?: string | null;
  types?: string[];
  className?: string;
  size?: "sm" | "md" | "lg";
  showMeta?: boolean;
  silhouette?: boolean;
  onClick?: () => void;
}

export function HoloCard({
  name,
  image,
  rarity,
  rarityTier,
  marketPrice,
  remaining,
  maxSupply,
  className,
  size = "md",
  showMeta = true,
  silhouette = false,
  onClick,
}: Props) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [imgOk, setImgOk] = useState(true);
  const dims =
    size === "sm"
      ? "w-[110px] h-[154px]"
      : size === "lg"
        ? "w-[220px] h-[308px]"
        : "w-[160px] h-[224px]";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top) / rect.height;
        setTilt({ x: (py - 0.5) * -16, y: (px - 0.5) * 18 });
      }}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      whileHover={{ scale: 1.04 }}
      style={{
        transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        boxShadow:
          marketPrice != null && marketPrice > 1000
            ? "0 10px 40px rgba(251,191,36,0.45), 0 0 28px rgba(245,158,11,0.3)"
            : rarityTier >= 4
              ? `0 10px 40px ${rarityColor(rarityTier)}44`
              : "0 10px 30px rgba(0,0,0,0.4)",
      }}
      className={cn(
        "relative shrink-0 rounded-xl overflow-hidden border border-white/15 bg-black/40 perspective-1000 preserve-3d transition-shadow cursor-pointer text-left",
        dims,
        rarityTier >= 6 && "holo-shine",
        marketPrice != null && marketPrice > 1000 && "holo-shine-gold",
        silhouette && "grayscale opacity-40",
        className
      )}
    >
      {image && !silhouette && imgOk ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={name}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setImgOk(false)}
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950 flex flex-col items-center justify-center p-2">
          <span className="text-3xl opacity-40">{silhouette ? "?" : "✦"}</span>
          {!silhouette && (
            <span className="mt-1 text-[10px] text-center text-white/50 line-clamp-2">
              {name}
            </span>
          )}
        </div>
      )}

      {marketPrice != null && marketPrice > 1000 && !silhouette && (
        <>
          <div className="gold-shine-band" aria-hidden />
          <div
            className="pointer-events-none absolute inset-0 gold-sparkle"
            aria-hidden
          />
        </>
      )}
      {rarityTier >= 4 &&
        !silhouette &&
        !(marketPrice != null && marketPrice > 1000) && (
        <div
          className="pointer-events-none absolute inset-0 opacity-40 mix-blend-overlay"
          style={{
            background: `linear-gradient(125deg, transparent 30%, ${rarityColor(rarityTier)} 50%, transparent 70%)`,
          }}
        />
      )}

      {showMeta && !silhouette && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2 pt-8">
          <p className="text-[11px] font-semibold truncate">{name}</p>
          <div className="flex items-center justify-between gap-1 mt-0.5">
            <span
              className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
              style={{
                background: `${rarityColor(rarityTier)}33`,
                color: rarityColor(rarityTier),
              }}
            >
              {normalizeRarity(rarity)}
            </span>
            {marketPrice != null && (
              <span className="text-[10px] text-amber-200">
                {formatPrice(marketPrice)}
              </span>
            )}
          </div>
          {remaining != null && maxSupply != null && (
            <p className="text-[9px] text-white/50 mt-0.5">
              {remaining}/{maxSupply} · {scarcityLabel(remaining, maxSupply)}
            </p>
          )}
        </div>
      )}
    </motion.button>
  );
}
