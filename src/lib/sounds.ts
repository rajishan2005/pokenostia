/**
 * Lightweight Web Audio sound design — original synth only
 * (no copyrighted samples). Distinct win stingers per rarity tier.
 */

type SoundName =
  | "click"
  | "packOpen"
  | "shake"
  | "deal"
  | "select"
  | "complete"
  | "sell"
  | "error"
  // Rarity win stingers
  | "winCommon"
  | "winUncommon"
  | "winRare"
  | "winHolo"
  | "winUltra"
  | "winIllustration"
  | "winSpecialIllustration"
  | "winHyper"
  | "winSecret";

let ctx: AudioContext | null = null;
let muted = false;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export function unlockAudio() {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  unlocked = true;
}

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem("holovault_muted", m ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem("holovault_muted") === "1") return true;
  } catch {
    /* ignore */
  }
  return muted;
}

export function loadMutePref() {
  muted = isMuted();
  return muted;
}

function tone(
  freq: number,
  when: number,
  dur: number,
  type: OscillatorType = "sine",
  gain = 0.08,
  slideTo?: number
) {
  const c = getCtx();
  if (!c || muted || !unlocked) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo != null) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, slideTo),
      t0 + dur
    );
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noiseBurst(when: number, dur: number, gain = 0.04, freq = 1200) {
  const c = getCtx();
  if (!c || muted || !unlocked) return;
  const t0 = c.currentTime + when;
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f);
  f.connect(g);
  g.connect(c.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

/** Chord helper: play several notes slightly staggered */
function chord(
  freqs: number[],
  when: number,
  dur: number,
  type: OscillatorType = "sine",
  gain = 0.045,
  stagger = 0.04
) {
  freqs.forEach((f, i) => {
    tone(f, when + i * stagger, dur, type, gain);
  });
}

/**
 * Map rarityTier (1–10) → distinct win stinger.
 * 1 Common · 2 Uncommon · 3 Rare · 4 Holo · 5–6 Ultra
 * 7 Illustration · 8 Special Illustration · 9 Hyper · 10 Secret
 */
export function playRarityWin(tier: number) {
  const t = Math.max(1, Math.min(10, Math.round(tier || 1)));
  if (t <= 1) play("winCommon");
  else if (t === 2) play("winUncommon");
  else if (t === 3) play("winRare");
  else if (t === 4) play("winHolo");
  else if (t <= 6) play("winUltra");
  else if (t === 7) play("winIllustration");
  else if (t === 8) play("winSpecialIllustration");
  else if (t === 9) play("winHyper");
  else play("winSecret");
}

export function play(name: SoundName) {
  if (muted) return;
  unlockAudio();
  const c = getCtx();
  if (!c) return;

  switch (name) {
    case "click":
      tone(880, 0, 0.05, "triangle", 0.05);
      break;
    case "packOpen":
      noiseBurst(0, 0.08, 0.05, 900);
      tone(180, 0, 0.18, "sawtooth", 0.04, 90);
      tone(320, 0.05, 0.2, "triangle", 0.05, 520);
      break;
    case "shake":
      noiseBurst(0, 0.04, 0.03, 800);
      tone(140, 0, 0.06, "square", 0.025);
      break;
    case "deal":
      tone(520, 0, 0.07, "triangle", 0.045, 780);
      tone(780, 0.03, 0.05, "sine", 0.028);
      break;
    case "select":
      tone(660, 0, 0.08, "sine", 0.055, 990);
      break;
    case "complete":
      chord([392, 494, 587], 0, 0.22, "triangle", 0.045, 0.09);
      break;
    case "sell":
      tone(700, 0, 0.08, "sine", 0.05, 400);
      tone(500, 0.06, 0.12, "triangle", 0.04);
      break;
    case "error":
      tone(200, 0, 0.15, "sawtooth", 0.04, 120);
      break;

    /* ── Rarity win stingers (increasing drama) ── */

    // Soft paper flick — common
    case "winCommon":
      tone(320, 0, 0.06, "triangle", 0.04);
      tone(400, 0.04, 0.07, "sine", 0.03);
      break;

    // Brighter two-tone — uncommon
    case "winUncommon":
      tone(380, 0, 0.08, "triangle", 0.045);
      tone(480, 0.06, 0.1, "triangle", 0.04);
      tone(560, 0.12, 0.1, "sine", 0.035);
      break;

    // Clean major lift — rare
    case "winRare":
      tone(440, 0, 0.1, "triangle", 0.055);
      tone(554, 0.08, 0.12, "triangle", 0.05);
      tone(659, 0.16, 0.16, "sine", 0.055);
      break;

    // Shimmer + sparkle — holo rare
    case "winHolo":
      noiseBurst(0, 0.08, 0.028, 2400);
      tone(523, 0, 0.12, "sine", 0.05);
      tone(659, 0.07, 0.14, "triangle", 0.05);
      tone(784, 0.14, 0.16, "sine", 0.055);
      tone(1046, 0.22, 0.12, "sine", 0.03);
      break;

    // Bold triumphant — ultra rare
    case "winUltra":
      noiseBurst(0, 0.1, 0.035, 1600);
      chord([349, 440, 523], 0, 0.18, "triangle", 0.05, 0.05);
      tone(698, 0.2, 0.22, "sine", 0.06);
      tone(880, 0.32, 0.2, "sine", 0.045);
      break;

    // Airy ethereal arpeggio — illustration rare
    case "winIllustration":
      tone(587, 0, 0.14, "sine", 0.05);
      tone(740, 0.1, 0.14, "sine", 0.05);
      tone(880, 0.2, 0.16, "triangle", 0.05);
      tone(1175, 0.32, 0.22, "sine", 0.045);
      noiseBurst(0.15, 0.12, 0.025, 3000);
      break;

    // Lush layered fanfare — special illustration
    case "winSpecialIllustration":
      noiseBurst(0, 0.12, 0.04, 1800);
      chord([392, 494, 587, 740], 0, 0.25, "triangle", 0.04, 0.06);
      tone(784, 0.28, 0.25, "sine", 0.055);
      tone(988, 0.4, 0.28, "sine", 0.05);
      tone(1175, 0.52, 0.3, "triangle", 0.04);
      break;

    // Golden sparkle cascade — hyper rare
    case "winHyper":
      noiseBurst(0, 0.1, 0.04, 2200);
      tone(523, 0, 0.12, "sine", 0.05);
      tone(659, 0.08, 0.12, "sine", 0.05);
      tone(784, 0.16, 0.14, "triangle", 0.055);
      tone(1046, 0.26, 0.16, "sine", 0.05);
      tone(1319, 0.38, 0.22, "sine", 0.045);
      chord([523, 784, 1046], 0.45, 0.3, "triangle", 0.04, 0.03);
      break;

    // Full confetti anthem — secret rare
    case "winSecret":
      noiseBurst(0, 0.14, 0.05, 1400);
      noiseBurst(0.08, 0.12, 0.035, 2800);
      chord([262, 330, 392], 0, 0.2, "sawtooth", 0.03, 0.04);
      tone(523, 0.15, 0.18, "triangle", 0.06);
      tone(659, 0.28, 0.2, "sine", 0.06);
      tone(784, 0.4, 0.22, "triangle", 0.055);
      tone(1046, 0.52, 0.28, "sine", 0.05);
      tone(1319, 0.65, 0.35, "sine", 0.045);
      chord([659, 831, 1046, 1319], 0.55, 0.4, "sine", 0.035, 0.05);
      break;

    default:
      break;
  }
}
