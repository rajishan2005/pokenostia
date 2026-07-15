"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type Done = (score: number) => void;

export function MemoryGame({ onComplete }: { onComplete: Done }) {
  const symbols = ["⚡", "🔥", "💧", "🌿", "⭐", "🌙"];
  const deck = useMemo(
    () =>
      [...symbols, ...symbols]
        .map((s, i) => ({ id: i, s }))
        .sort(() => Math.random() - 0.5),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [lock, setLock] = useState(false);

  const flip = (i: number) => {
    if (lock || open.includes(i) || matched.includes(i)) return;
    const next = [...open, i];
    setOpen(next);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      setLock(true);
      const [a, b] = next;
      if (deck[a].s === deck[b].s) {
        const nextMatched = [...matched, a, b];
        setMatched(nextMatched);
        setOpen([]);
        setLock(false);
        if (nextMatched.length >= deck.length) {
          onComplete(Math.max(100, 1000 - (moves + 1) * 40));
        }
      } else {
        setTimeout(() => {
          setOpen([]);
          setLock(false);
        }, 650);
      }
    }
  };

  return (
    <div>
      <p className="text-sm text-white/50 mb-4">Moves: {moves}</p>
      <div className="grid grid-cols-4 gap-3 max-w-md">
        {deck.map((c, i) => {
          const show = open.includes(i) || matched.includes(i);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => flip(i)}
              className={cn(
                "aspect-square rounded-xl text-2xl border border-white/15 transition",
                show
                  ? "bg-violet-500/30"
                  : "bg-gradient-to-br from-indigo-900 to-purple-900"
              )}
            >
              {show ? c.s : "✦"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ReactionGame({ onComplete }: { onComplete: Done }) {
  const [state, setState] = useState<"wait" | "ready" | "go" | "done">("wait");
  const [ms, setMs] = useState(0);
  const t0 = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = () => {
    setState("ready");
    const delay = 1200 + Math.random() * 2500;
    timer.current = setTimeout(() => {
      t0.current = performance.now();
      setState("go");
    }, delay);
  };

  const tap = () => {
    if (state === "ready") {
      if (timer.current) clearTimeout(timer.current);
      setState("wait");
      return;
    }
    if (state === "go") {
      const d = Math.round(performance.now() - t0.current);
      setMs(d);
      setState("done");
      onComplete(Math.max(50, 1000 - d));
    }
  };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return (
    <div className="text-center space-y-4">
      <p className="text-sm text-white/50">
        Wait for neon flash, then tap as fast as you can.
      </p>
      <button
        type="button"
        onClick={state === "wait" ? start : tap}
        className={cn(
          "mx-auto flex h-48 w-full max-w-md items-center justify-center rounded-3xl text-xl font-bold transition",
          state === "go"
            ? "bg-gradient-to-br from-fuchsia-500 to-amber-300 text-black"
            : state === "ready"
              ? "bg-rose-900/50"
              : "glass"
        )}
      >
        {state === "wait" && "Start"}
        {state === "ready" && "Wait…"}
        {state === "go" && "TAP!"}
        {state === "done" && `${ms} ms`}
      </button>
      {state === "done" && (
        <Button size="sm" variant="ghost" onClick={() => setState("wait")}>
          Retry
        </Button>
      )}
    </div>
  );
}

const TRIVIA = [
  {
    q: "How many cards are typically in a modern booster pack?",
    options: ["5", "10", "20", "50"],
    a: 1,
  },
  {
    q: "Which rarity is usually highest?",
    options: ["Common", "Uncommon", "Secret Rare", "Rare"],
    a: 2,
  },
  {
    q: "What does a holographic card typically have?",
    options: ["Foil pattern", "No art", "Only text", "Wooden frame"],
    a: 0,
  },
  {
    q: "Pikadollars ($) in PokeNostia are earned by…",
    options: ["Real money only", "Skill mini-games", "Watching ads only", "Nothing"],
    a: 1,
  },
];

export function TriviaGame({ onComplete }: { onComplete: Done }) {
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const q = TRIVIA[i];

  const pick = (idx: number) => {
    const next = score + (idx === q.a ? 250 : 0);
    if (i + 1 >= TRIVIA.length) {
      setScore(next);
      setDone(true);
      onComplete(next);
    } else {
      setScore(next);
      setI(i + 1);
    }
  };

  if (done) {
    return <p className="text-center text-lg">Score: {score}</p>;
  }

  return (
    <div className="space-y-4 max-w-lg">
      <p className="font-medium">
        {i + 1}/{TRIVIA.length}. {q.q}
      </p>
      <div className="grid gap-2">
        {q.options.map((o, idx) => (
          <button
            key={o}
            type="button"
            onClick={() => pick(idx)}
            className="btn-ghost rounded-xl px-4 py-3 text-left text-sm"
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PuzzleGame({ onComplete }: { onComplete: Done }) {
  const target = [1, 2, 3, 4];
  const [arr, setArr] = useState(() =>
    [...target].sort(() => Math.random() - 0.5)
  );
  const [sel, setSel] = useState<number | null>(null);

  const click = (i: number) => {
    if (sel === null) {
      setSel(i);
      return;
    }
    const next = [...arr];
    [next[sel], next[i]] = [next[i], next[sel]];
    setArr(next);
    setSel(null);
    if (next.every((v, idx) => v === target[idx])) {
      onComplete(800);
    }
  };

  return (
    <div>
      <p className="text-sm text-white/50 mb-4">
        Reorder tiles 1→4 (swap by tapping two)
      </p>
      <div className="flex gap-3">
        {arr.map((n, i) => (
          <button
            key={i}
            type="button"
            onClick={() => click(i)}
            className={cn(
              "h-16 w-16 rounded-xl text-xl font-bold glass",
              sel === i && "ring-2 ring-amber-300"
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export function GuessGame({ onComplete }: { onComplete: Done }) {
  const pool = [
    { name: "Pikachu", hint: "Electric mouse mascot" },
    { name: "Charizard", hint: "Fire dragon final evo" },
    { name: "Mewtwo", hint: "Genetic powerhouse" },
    { name: "Gengar", hint: "Shadow grin" },
  ];
  const card = useMemo(
    () => pool[Math.floor(Math.random() * pool.length)],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [val, setVal] = useState("");
  const [msg, setMsg] = useState("");

  return (
    <div className="max-w-md space-y-4">
      <div className="h-40 rounded-2xl bg-black/50 flex items-center justify-center text-6xl opacity-40 blur-[1px]">
        ?
      </div>
      <p className="text-sm text-white/50">Hint: {card.hint}</p>
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2"
        placeholder="Card name"
      />
      <Button
        size="sm"
        onClick={() => {
          if (val.trim().toLowerCase() === card.name.toLowerCase()) {
            setMsg("Correct!");
            onComplete(700);
          } else {
            setMsg("Try again");
          }
        }}
      >
        Guess
      </Button>
      {msg && <p className="text-sm text-violet-200">{msg}</p>}
    </div>
  );
}

export function SpotGame({ onComplete }: { onComplete: Done }) {
  const odd = useMemo(() => Math.floor(Math.random() * 9), []);
  const [found, setFound] = useState(false);

  return (
    <div>
      <p className="text-sm text-white/50 mb-4">Find the card that glows differently</p>
      <div className="grid grid-cols-3 gap-3 max-w-sm">
        {Array.from({ length: 9 }).map((_, i) => (
          <button
            key={i}
            type="button"
            disabled={found}
            onClick={() => {
              if (i === odd) {
                setFound(true);
                onComplete(650);
              }
            }}
            className={cn(
              "aspect-square rounded-xl border border-white/15",
              i === odd
                ? "bg-gradient-to-br from-amber-400/40 to-fuchsia-500/40"
                : "bg-violet-900/40"
            )}
          >
            ✦
          </button>
        ))}
      </div>
      {found && <p className="mt-3 text-emerald-300 text-sm">Found it!</p>}
    </div>
  );
}

export function WheelGame({ onComplete }: { onComplete: Done }) {
  // Skill-based: stop near target zone — not a cash gambling mechanic
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const raf = useRef(0);
  const vel = useRef(0);

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    setResult(null);
    vel.current = 18 + Math.random() * 10;
    const tick = () => {
      vel.current *= 0.985;
      setAngle((a) => a + vel.current);
      if (vel.current > 0.4) {
        raf.current = requestAnimationFrame(tick);
      } else {
        setSpinning(false);
        const norm = ((angle + vel.current) % 360 + 360) % 360;
        const score = norm > 150 && norm < 210 ? 900 : norm > 100 && norm < 260 ? 400 : 150;
        setResult(score >= 900 ? "Bullseye zone!" : score >= 400 ? "Nice" : "OK");
        onComplete(score);
      }
    };
    raf.current = requestAnimationFrame(tick);
  };

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-white/50 text-center max-w-sm">
        Timed skill spin — stop near the gold zone. Pikadollars only; not real-money gambling.
      </p>
      <div
        className="relative h-48 w-48 rounded-full border-4 border-white/20"
        style={{
          background:
            "conic-gradient(#ffd56a 0deg 40deg, #7c5cff 40deg 120deg, #46e0ff 120deg 200deg, #ff6bcb 200deg 280deg, #7c5cff 280deg 360deg)",
          transform: `rotate(${angle}deg)`,
          transition: spinning ? undefined : "transform 0.2s",
        }}
      />
      <div className="h-0 w-0 border-l-8 border-r-8 border-t-[14px] border-l-transparent border-r-transparent border-t-white -mt-2" />
      <Button size="sm" onClick={spin} disabled={spinning}>
        Spin
      </Button>
      {result && <p className="text-sm text-amber-200">{result}</p>}
    </div>
  );
}

export function TreasureGame({ onComplete }: { onComplete: Done }) {
  const treasure = useMemo(() => {
    const s = new Set<number>();
    while (s.size < 3) s.add(Math.floor(Math.random() * 16));
    return s;
  }, []);
  const [found, setFound] = useState<number[]>([]);
  const [tries, setTries] = useState(0);

  return (
    <div>
      <p className="text-sm text-white/50 mb-4">
        Find 3 treasures · tries {tries}
      </p>
      <div className="grid grid-cols-4 gap-2 max-w-sm">
        {Array.from({ length: 16 }).map((_, i) => {
          const isFound = found.includes(i);
          const isT = treasure.has(i);
          return (
            <button
              key={i}
              type="button"
              disabled={isFound || found.length >= 3}
              onClick={() => {
                setTries((t) => t + 1);
                if (isT) {
                  const next = [...found, i];
                  setFound(next);
                  if (next.length >= 3) {
                    onComplete(Math.max(200, 1000 - tries * 30));
                  }
                }
              }}
              className={cn(
                "aspect-square rounded-lg border border-white/10 text-lg",
                isFound && isT
                  ? "bg-amber-400/40"
                  : "bg-slate-900/60 hover:bg-white/10"
              )}
            >
              {isFound && isT ? "💎" : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}
