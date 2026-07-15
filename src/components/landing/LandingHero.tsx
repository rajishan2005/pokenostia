"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { FloatingCards } from "@/components/ui/FloatingCards";
import { LiveFeed } from "@/components/layout/LiveFeed";
import {
  Package,
  BookOpen,
  Store,
  Trophy,
  User,
  Sparkles,
  Send,
} from "lucide-react";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { PokePackArt } from "@/components/pack/PokePackArt";
import { SHOP_PACKS, highRareChanceForPrice } from "@/lib/shop-packs";
import { formatPika } from "@/lib/currency";

const actions = [
  { href: "/open", label: "Open Pack", icon: Package, primary: true },
  { href: "/collection", label: "Collection", icon: BookOpen },
  { href: "/marketplace", label: "Marketplace", icon: Store },
  { href: "/trade", label: "Trade", icon: Send },
  { href: "/leaderboards", label: "Leaderboards", icon: Trophy },
  { href: "/profile", label: "Profile", icon: User },
];

export function LandingHero() {
  return (
    <section className="relative min-h-[calc(100dvh-4rem)] overflow-hidden">
      <FloatingCards />

      <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-14 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-20">
        <div className="text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-white/70"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            Fan-made Pokémon pack openings
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-5xl font-black tracking-tight md:text-6xl lg:text-7xl"
          >
            <span className="text-gradient">{APP_NAME}</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="mx-auto mt-4 max-w-xl text-lg text-white/65 lg:mx-0"
          >
            {APP_TAGLINE}. Seven premium pack tiers from {formatPika(100)} to{" "}
            {formatPika(500)} — Vault Breaker, Crown Circuit, Apex & more.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
          >
            {actions.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className={
                  a.primary
                    ? "btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white"
                    : "btn-ghost inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white"
                }
              >
                <a.icon className="h-4 w-4" />
                {a.label}
              </Link>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-strong rounded-3xl p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Live Rare Feed</h2>
            <span className="flex items-center gap-1.5 text-xs text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Live
            </span>
          </div>
          <LiveFeed compact />
        </motion.div>
      </div>

      {/* All shop packs on homescreen */}
      <div className="relative mx-auto max-w-7xl px-4 pb-10">
        <div className="mb-6 text-center lg:text-left">
          <h2 className="text-2xl font-bold text-white md:text-3xl">
            All packs
          </h2>
          <p className="mt-1 text-sm text-white/50">
            Pick a tier — higher price, higher high-rare odds · each pack has
            its own premium look
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {SHOP_PACKS.map((pack, i) => {
            const chance = Math.round(highRareChanceForPrice(pack.packCost) * 1000) / 10;
            return (
              <motion.div
                key={pack.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="flex flex-col items-center"
              >
                <Link
                  href={`/open?pack=${encodeURIComponent(pack.id)}`}
                  className="group block"
                >
                  <motion.div
                    whileHover={{ y: -8, scale: 1.04 }}
                    transition={{ type: "spring", stiffness: 320, damping: 22 }}
                  >
                    <PokePackArt
                      packId={pack.id}
                      name={pack.name}
                      priceLabel={formatPika(pack.packCost)}
                      packSize={pack.packSize}
                      banner={pack.banner}
                      chanceLabel={`${chance}% high-rare`}
                      compact
                      className="!h-[220px] !w-[148px] sm:!h-56 sm:!w-40"
                    />
                  </motion.div>
                </Link>
                <p className="mt-2 line-clamp-2 px-1 text-center text-[11px] text-white/45">
                  {pack.tagline}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              t: "Global Scarcity",
              d: "Every pull permanently lowers world supply and odds.",
            },
            {
              t: "Earn, Don't Gamble",
              d: "Earn Pikadollars ($) from skill games. Compare pack cost vs market pull value.",
            },
            {
              t: "Binder vibes",
              d: "Flip pages, glow holos, silhouette missing slots.",
            },
            {
              t: "Trade globally",
              d: "Send cards free to any trainer by unique @username.",
            },
          ].map((f, i) => (
            <motion.div
              key={f.t}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="glass rounded-2xl p-5"
            >
              <h3 className="font-semibold text-white">{f.t}</h3>
              <p className="mt-2 text-sm text-white/55">{f.d}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
