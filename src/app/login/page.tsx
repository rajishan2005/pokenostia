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
  const [imageUrl, setImageUrl] = useState("");
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
      const res = await fetch("/api/auth/captcha");
      const data = await res.json();
      setImageUrl(data.imageUrl || "");
      setOptions(data.options || []);
      setCaptchaToken(data.token || "");
    } catch {
      setError("Could not load bot check");
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaAnswer) {
      setError("Complete the Pokémon check first");
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
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed");
        setLoading(false);
        if (res.status === 403) void loadCaptcha();
        play("error");
        return;
      }
      setUser(data.user);
      play("complete");
      router.push("/open");
    } catch {
      setError("Network error");
      setLoading(false);
      play("error");
    }
  };

  const playAsGuest = async () => {
    if (!captchaAnswer) {
      setError("Complete the Pokémon check first");
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
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Guest failed");
        setLoading(false);
        if (res.status === 403) void loadCaptcha();
        play("error");
        return;
      }
      setUser(data.user);
      play("complete");
      router.push("/open");
    } catch {
      setError("Network error");
      setLoading(false);
      play("error");
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md items-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-strong w-full rounded-3xl p-8"
      >
        <h1 className="text-2xl font-bold text-gradient">Trainer check-in</h1>
        <p className="mt-1 text-sm text-white/50">
          Prove you&apos;re not a bot · then login, register, or play as guest
        </p>

        {/* Bot verification */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-white/80">
              What Pokémon is this?
            </p>
            <button
              type="button"
              onClick={() => void loadCaptcha()}
              className="rounded-lg p-1.5 text-white/45 hover:bg-white/10 hover:text-white"
              title="New challenge"
            >
              <RefreshCw
                className={`h-4 w-4 ${captchaLoading ? "animate-spin" : ""}`}
              />
            </button>
          </div>

          <div className="mx-auto mb-4 flex h-36 w-36 items-center justify-center overflow-hidden rounded-2xl border border-amber-300/30 bg-gradient-to-br from-yellow-400/20 to-amber-600/10">
            {imageUrl && !captchaLoading ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="Mystery Pokémon"
                className="h-full w-full object-contain p-2"
                draggable={false}
              />
            ) : (
              <span className="text-white/40 text-sm">Loading…</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                disabled={captchaLoading}
                onClick={() => pickAnswer(opt)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
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
              Selected: {captchaAnswer} — you can continue below
            </p>
          )}
        </div>

        {/* Auth forms — only interactive after selection (still validated server-side) */}
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
                className={`flex-1 rounded-lg py-2 text-sm capitalize ${
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 outline-none focus:border-violet-400/60"
              />
            </label>

            {mode === "register" && (
              <>
                <label className="block text-sm">
                  <span className="text-white/60">Username</span>
                  <input
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 outline-none focus:border-violet-400/60"
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
                        className={`h-10 w-10 rounded-full text-lg ${
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 outline-none focus:border-violet-400/60"
              />
            </label>

            {error && <p className="text-sm text-rose-300">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading || !captchaAnswer}>
              {loading ? "…" : mode === "login" ? "Login" : "Register"}
            </Button>
          </form>

          <div className="relative my-5 text-center">
            <span className="relative z-10 bg-transparent px-2 text-xs text-white/35">
              or
            </span>
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/10" />
          </div>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={loading || !captchaAnswer}
            onClick={() => void playAsGuest()}
          >
            Play as guest
          </Button>
          <p className="mt-2 text-center text-[11px] text-white/40">
            Guest gets a random trainer + starting Pikadollars · no email needed
          </p>
        </div>

        <p className="mt-5 text-center text-xs text-white/35">
          Demo: demo@holovault.app · demo1234
        </p>
      </motion.div>
    </div>
  );
}
