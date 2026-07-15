"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { useUserStore } from "@/store/user-store";
import { unlockAudio, play } from "@/lib/sounds";
import { RefreshCw } from "lucide-react";

const AVATARS = ["✨", "⚡", "🔥", "💧", "🌿", "🌙", "⭐", "🎮", "🃏", "👑"];

export default function LoginPage() {
  const router = useRouter();
  const setUser = useUserStore((s) => s.setUser);
  const [verified, setVerified] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [prompt, setPrompt] = useState("Which Pokémon is the electric mouse?");
  const [emoji, setEmoji] = useState("⚡");
  const [options, setOptions] = useState<string[]>([]);
  const [captchaLoading, setCaptchaLoading] = useState(true);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("demo@holovault.app");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("demo1234");
  const [avatar, setAvatar] = useState("⚡");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    setCaptchaAnswer("");
    setVerified(false);
    setError(null);
    try {
      const res = await fetch("/api/auth/captcha", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not load bot check");
        // Offline fallback so phones can still continue if API glitches
        setPrompt("Which Pokémon is the electric mouse?");
        setEmoji("⚡");
        setOptions(["Pikachu", "Snorlax", "Onix", "Gyarados"]);
        setCaptchaToken("");
        return;
      }
      setPrompt(data.prompt || "Which Pokémon is the electric mouse?");
      setEmoji(data.emoji || "⚡");
      setOptions(data.options || ["Pikachu", "Snorlax", "Onix", "Gyarados"]);
      setCaptchaToken(data.token || "");
    } catch {
      setError("Could not load bot check — retry or check connection");
      setPrompt("Which Pokémon is the electric mouse?");
      setEmoji("⚡");
      setOptions(["Pikachu", "Snorlax", "Onix", "Gyarados"]);
    } finally {
      setCaptchaLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCaptcha();
  }, [loadCaptcha]);

  const pickAnswer = (opt: string) => {
    unlockAudio();
    play("click");
    setCaptchaAnswer(opt);
    setVerified(true);
  };

  const authBody = (extra: Record<string, unknown> = {}) => ({
    captchaToken,
    captchaAnswer,
    ...extra,
  });

  const handleAuthResult = async (
    res: Response,
    data: { error?: string; user?: unknown }
  ) => {
    if (!res.ok) {
      const msg =
        data.error ||
        (res.status === 403
          ? "Bot check failed — tap Pikachu again"
          : res.status === 401
            ? "Invalid email or password"
            : res.status === 500
              ? "Server error — wait for Railway to finish starting, then retry"
              : `Failed (${res.status})`);
      setError(msg);
      setLoading(false);
      if (res.status === 403) void loadCaptcha();
      play("error");
      return false;
    }
    setUser(data.user as never);
    play("complete");
    router.push("/open");
    return true;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaAnswer) {
      setError("Tap Pikachu in the check first");
      return;
    }
    if (!captchaToken) {
      setError("Bot check not ready — tap the refresh icon");
      void loadCaptcha();
      return;
    }
    setLoading(true);
    setError(null);
    unlockAudio();
    try {
      const res = await fetch(
        mode === "login" ? "/api/auth/login" : "/api/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(
            mode === "login"
              ? authBody({ email, password })
              : authBody({ email, password, username, avatar })
          ),
        }
      );
      let data: { error?: string; user?: unknown } = {};
      try {
        data = await res.json();
      } catch {
        setError(`Server returned ${res.status} — try again in a moment`);
        setLoading(false);
        play("error");
        return;
      }
      await handleAuthResult(res, data);
    } catch {
      setError("Network error — check connection / Railway is online");
      setLoading(false);
      play("error");
    }
  };

  const playAsGuest = async () => {
    if (!captchaAnswer) {
      setError("Tap Pikachu in the check first");
      return;
    }
    if (!captchaToken) {
      setError("Bot check not ready — tap the refresh icon");
      void loadCaptcha();
      return;
    }
    setLoading(true);
    setError(null);
    unlockAudio();
    try {
      const res = await fetch("/api/auth/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(authBody()),
      });
      let data: { error?: string; user?: unknown } = {};
      try {
        data = await res.json();
      } catch {
        setError(`Server returned ${res.status} — try again in a moment`);
        setLoading(false);
        play("error");
        return;
      }
      await handleAuthResult(res, data);
    } catch {
      setError("Network error — check connection / Railway is online");
      setLoading(false);
      play("error");
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md items-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-strong w-full rounded-3xl p-6 sm:p-8"
      >
        <h1 className="text-2xl font-bold text-gradient">Trainer check-in</h1>
        <p className="mt-1 text-sm text-white/50">
          Tap <strong className="text-amber-200">Pikachu</strong>, then login or
          guest
        </p>

        {/* Bot verification — emoji, no external images (mobile-friendly) */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white/80">{prompt}</p>
            <button
              type="button"
              onClick={() => void loadCaptcha()}
              className="shrink-0 rounded-lg p-1.5 text-white/45 hover:bg-white/10 hover:text-white"
              title="New challenge"
            >
              <RefreshCw
                className={`h-4 w-4 ${captchaLoading ? "animate-spin" : ""}`}
              />
            </button>
          </div>

          <div className="mx-auto mb-4 flex h-28 w-full items-center justify-center rounded-2xl border border-amber-300/30 bg-gradient-to-br from-yellow-400/25 to-amber-600/15 text-5xl">
            {captchaLoading ? (
              <span className="text-sm text-white/40">Loading…</span>
            ) : (
              <span aria-hidden>{emoji}</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                disabled={captchaLoading}
                onClick={() => pickAnswer(opt)}
                className={`min-h-[48px] rounded-xl border px-3 py-3 text-sm font-medium transition active:scale-[0.98] ${
                  captchaAnswer === opt
                    ? "border-amber-300/70 bg-amber-400/20 text-amber-100 ring-2 ring-amber-300/40"
                    : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>

          {verified && captchaAnswer && (
            <p className="mt-3 text-center text-xs text-emerald-300">
              Selected: {captchaAnswer} — continue below
            </p>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">
            {error}
          </p>
        )}

        <div
          className={`mt-6 transition ${
            captchaAnswer ? "opacity-100" : "pointer-events-none opacity-40"
          }`}
        >
          <div className="flex gap-2">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 rounded-lg py-2.5 text-sm capitalize ${
                  mode === m ? "bg-white/15 text-white" : "text-white/50"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-4 space-y-4">
            <label className="block text-sm">
              <span className="text-white/60">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-base outline-none focus:border-violet-400/60"
              />
            </label>

            {mode === "register" && (
              <>
                <label className="block text-sm">
                  <span className="text-white/60">Username</span>
                  <input
                    required
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-base outline-none focus:border-violet-400/60"
                  />
                </label>
                <div>
                  <span className="text-sm text-white/60">Avatar</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {AVATARS.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setAvatar(a)}
                        className={`h-11 w-11 rounded-full text-lg ${
                          avatar === a
                            ? "ring-2 ring-violet-400 bg-white/15"
                            : "bg-white/5"
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <label className="block text-sm">
              <span className="text-white/60">Password</span>
              <input
                type="password"
                required
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-base outline-none focus:border-violet-400/60"
              />
            </label>

            <Button
              type="submit"
              className="w-full min-h-[48px]"
              disabled={loading || !captchaAnswer}
            >
              {loading ? "Working…" : mode === "login" ? "Login" : "Register"}
            </Button>
          </form>

          <div className="relative my-5 text-center">
            <span className="relative z-10 px-2 text-xs text-white/35">or</span>
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/10" />
          </div>

          <Button
            type="button"
            variant="ghost"
            className="w-full min-h-[48px]"
            disabled={loading || !captchaAnswer}
            onClick={() => void playAsGuest()}
          >
            Play as guest
          </Button>
          <p className="mt-2 text-center text-[11px] text-white/40">
            No email · random trainer · starting Pikadollars
          </p>
        </div>

        <p className="mt-5 text-center text-xs text-white/35">
          Demo: demo@holovault.app · demo1234
          <br />
          Always pick <span className="text-amber-200">Pikachu</span>
        </p>
      </motion.div>
    </div>
  );
}
