import { SignJWT, jwtVerify } from "jose";

const secret = () =>
  new TextEncoder().encode(
    process.env.JWT_SECRET || "holovault-dev-secret-change-in-production"
  );

export type CaptchaChallenge = {
  imageUrl: string;
  options: string[];
  token: string;
};

/** Rotating easy quiz — always one correct answer in signed token */
const QUIZZES = [
  {
    answer: "Pikachu",
    imageUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png",
    decoys: ["Raichu", "Eevee", "Jolteon"],
  },
  {
    answer: "Pikachu",
    imageUrl: "https://images.pokemontcg.io/base1/58.png",
    decoys: ["Charmander", "Squirtle", "Bulbasaur"],
  },
  {
    answer: "Pikachu",
    imageUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png",
    decoys: ["Meowth", "Psyduck", "Growlithe"],
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
    .setExpirationTime("10m")
    .sign(secret());

  return {
    imageUrl: q.imageUrl,
    options,
    token,
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
