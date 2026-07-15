"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface FloatCard {
  id: string;
  name: string;
  imageSmall: string | null;
  x: string;
  y: string;
  rotate: number;
  delay: number;
}

const LAYOUT = [
  { x: "6%", y: "14%", rotate: -16, delay: 0 },
  { x: "78%", y: "12%", rotate: 12, delay: 0.35 },
  { x: "10%", y: "66%", rotate: 9, delay: 0.7 },
  { x: "82%", y: "60%", rotate: -11, delay: 1.0 },
  { x: "46%", y: "6%", rotate: 5, delay: 0.5 },
  { x: "55%", y: "74%", rotate: -7, delay: 0.9 },
];

const FALLBACK_IMGS = [
  {
    id: "base1-4",
    name: "Charizard",
    imageSmall: "https://images.pokemontcg.io/base1/4.png",
  },
  {
    id: "base1-58",
    name: "Pikachu",
    imageSmall: "https://images.pokemontcg.io/base1/58.png",
  },
  {
    id: "base1-2",
    name: "Blastoise",
    imageSmall: "https://images.pokemontcg.io/base1/2.png",
  },
  {
    id: "base1-15",
    name: "Venusaur",
    imageSmall: "https://images.pokemontcg.io/base1/15.png",
  },
  {
    id: "base1-10",
    name: "Mewtwo",
    imageSmall: "https://images.pokemontcg.io/base1/10.png",
  },
  {
    id: "base3-5",
    name: "Gengar",
    imageSmall: "https://images.pokemontcg.io/base3/5.png",
  },
];

export function FloatingCards() {
  const [cards, setCards] = useState<FloatCard[]>(
    FALLBACK_IMGS.map((c, i) => ({ ...c, ...LAYOUT[i]! }))
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/seed");
        const data = await res.json();
        const sample = (data.sample || []) as {
          id: string;
          name: string;
          imageSmall: string | null;
        }[];
        if (!alive || sample.length < 3) return;
        setCards(
          sample.slice(0, 6).map((c, i) => ({
            id: c.id,
            name: c.name,
            imageSmall: c.imageSmall,
            ...LAYOUT[i % LAYOUT.length]!,
          }))
        );
      } catch {
        /* keep real Base Set fallbacks */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {cards.map((c, i) => (
        <motion.div
          key={c.id}
          className="absolute h-28 w-20 overflow-hidden rounded-xl shadow-2xl md:h-36 md:w-24 border border-white/20"
          style={{ left: c.x, top: c.y }}
          initial={{ opacity: 0, y: 30 }}
          animate={{
            opacity: 0.85,
            y: [0, -14, 0],
            rotate: [c.rotate, c.rotate + 3, c.rotate],
          }}
          transition={{
            opacity: { duration: 0.6 },
            y: {
              duration: 6 + i * 0.4,
              delay: c.delay,
              repeat: Infinity,
              ease: "easeInOut",
            },
            rotate: {
              duration: 6 + i * 0.4,
              delay: c.delay,
              repeat: Infinity,
              ease: "easeInOut",
            },
          }}
        >
          {c.imageSmall ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.imageSmall}
              alt={c.name}
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-violet-800 text-xs">
              {c.name}
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
