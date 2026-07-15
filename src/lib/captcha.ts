import { SignJWT, jwtVerify } from "jose";

const secret = () =>
  new TextEncoder().encode(
    process.env.JWT_SECRET || "holovault-dev-secret-change-in-production"
  );

export type CaptchaChallenge = {
  /** No external image — works offline / on mobile */
  prompt: string;
  emoji: string;
  options: string[];
  token: string;
  /** legacy field so old clients don't crash */
  imageUrl?: string;
};

/** Emoji captcha — no CDN, works on phones even when images are blocked */
const QUIZZES = [
  {
    answer: "Pikachu",
    prompt: "Which Pokémon is the electric mouse?",
    emoji: "⚡🐭",
    decoys: ["Snorlax", "Gyarados", "Onix"],
  },
  {
    answer: "Pikachu",
    prompt: "Ash’s yellow partner is…",
    emoji: "🟡⚡",
    decoys: ["Eevee", "Meowth", "Psyduck"],
  },
  {
    answer: "Pikachu",
    prompt: "Tap the correct name for ⚡",
    emoji: "⚡",
    decoys: ["Charmander", "Squirtle", "Bulbasaur"],
  },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export async function createCaptchaChallenge(): Promise<CaptchaChallenge> {
  const q = QUIZZES[Math.floor(Math.random() * QUIZZES.length)]!;
  const options = shuffle([q.answer, ...q.decoys]);
  const token = await new SignJWT({
    ans: q.answer.toLowerCase(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret());

  return {
    prompt: q.prompt,
    emoji: q.emoji,
    options,
    token,
    imageUrl: "",
  };
}

export async function verifyCaptcha(
  token: string | undefined,
  answer: string | undefined
): Promise<boolean> {
  if (!token || !answer) return false;
  try {
    const { payload } = await jwtVerify(token, secret());
    const ans = typeof payload.ans === "string" ? payload.ans : "";
    return ans === answer.trim().toLowerCase();
  } catch {
    return false;
  }
}
