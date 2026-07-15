"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Package,
  BookOpen,
  Store,
  Trophy,
  User,
  Gamepad2,
  Gift,
  History,
  LogIn,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPika } from "@/lib/currency";
import { useUserStore } from "@/store/user-store";
import { APP_NAME, APP_SHORT_TAGLINE } from "@/lib/brand";
import { PokeBallMark } from "@/components/pack/PokePackArt";
import { useEffect } from "react";

const links = [
  { href: "/open", label: "Open", icon: Package },
  { href: "/collection", label: "Collection", icon: BookOpen },
  { href: "/marketplace", label: "Market", icon: Store },
  { href: "/trade", label: "Trade", icon: Send },
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/leaderboards", label: "Ranks", icon: Trophy },
  { href: "/rewards", label: "Rewards", icon: Gift },
  { href: "/history", label: "History", icon: History },
  { href: "/profile", label: "Profile", icon: User },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, refresh, loading } = useUserStore();

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 glass-strong">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 group">
          <motion.div
            whileHover={{ rotate: 12, scale: 1.08 }}
            className="flex h-9 w-9 items-center justify-center"
          >
            <PokeBallMark size="sm" />
          </motion.div>
          <div className="leading-tight">
            <p className="font-bold tracking-wide text-gradient">{APP_NAME}</p>
            <p className="text-[10px] text-white/50 hidden sm:block">
              {APP_SHORT_TAGLINE}
            </p>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "text-white"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 -z-10 rounded-lg bg-white/10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {!loading && user ? (
            <>
              <div
                className="flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-sm"
                title="Pikadollars"
              >
                <span className="text-amber-300 font-bold">$</span>
                <span className="font-semibold text-amber-100">
                  {formatPika(user.coins).replace("$", "")}
                </span>
                <span className="hidden sm:inline text-[10px] uppercase tracking-wide text-amber-200/50">
                  Pika
                </span>
              </div>
              <Link
                href="/profile"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg border border-white/15"
                title={user.username}
              >
                {user.avatar}
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className="btn-primary flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm text-white"
            >
              <LogIn className="h-3.5 w-3.5" />
              Login
            </Link>
          )}
        </div>
      </div>

      {/* Mobile nav */}
      <div className="flex lg:hidden gap-1 overflow-x-auto px-3 pb-2 scrollbar-none">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs",
                active ? "bg-white/15 text-white" : "text-white/60"
              )}
            >
              <Icon className="h-3 w-3" />
              {label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
