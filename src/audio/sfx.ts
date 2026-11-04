// Sound effects, all synthesised with Web Audio so there are no audio files to
// license or download. Each style picks a "voice" that changes the character:
// marker = magnets on a whiteboard, warm = wood and felt, chip = 8-bit beeps,
// crisp = clean UI clicks.

import { getEngine, midiToHz } from "./engine";
import type { SoundVoice } from "../theme/themes";

export type SfxName =
  | "select"
  | "move"
  | "capture"
  | "check"
  | "kickoff"
  | "fulltime"
  | "correct"
  | "wrong"
  | "form"
  | "powerup"
  | "locked"
  | "tick"
  | "cheer"
  | "groan";

export const SFX_LABELS: Record<SfxName, string> = {
  select: "Pick up a piece",
  move: "Move",
  capture: "Capture",
  check: "Check (referee's whistle)",
  kickoff: "Kick-off",
  fulltime: "Full time",
  correct: "Right answer",
  wrong: "Wrong answer",
  form: "Form earned",
  powerup: "Power-up used",
  locked: "Not enough Form",
  tick: "Timer running out",
  cheer: "Crowd cheer",
  groan: "Crowd groan",
};

type Osc = OscillatorType;

interface ToneOpts {
  type?: Osc;
  at?: number;
  dur: number;
  gain?: number;
  attack?: number;
  slideTo?: number;
  vibrato?: { rate: number; depth: number };
}

function tone(freq: number, o: ToneOpts): void {
  const e = getEngine();
  if (!e) return;
  const { ctx } = e;
  const t = ctx.currentTime + (o.at ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(freq, t);
  if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t + o.dur);
  if (o.vibrato) {
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = o.vibrato.rate;
    lg.gain.value = o.vibrato.depth;
    lfo.connect(lg).connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + o.dur + 0.05);
  }
  const peak = o.gain ?? 0.3;
  const a = o.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(g).connect(e.sfx);
  osc.start(t);
  osc.stop(t + o.dur + 0.05);
}

interface NoiseOpts {
  at?: number;
  dur: number;
  gain?: number;
  filter?: BiquadFilterType;
  freq: number;
  freqTo?: number;
  q?: number;
  attack?: number;
}

function noise(o: NoiseOpts): void {
  const e = getEngine();
  if (!e) return;
  const { ctx } = e;
  const t = ctx.currentTime + (o.at ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = e.noise;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = o.filter ?? "bandpass";
  f.frequency.setValueAtTime(o.freq, t);
  if (o.freqTo) f.frequency.exponentialRampToValueAtTime(o.freqTo, t + o.dur);
  f.Q.value = o.q ?? 1;
  const g = ctx.createGain();
  const peak = o.gain ?? 0.3;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + (o.attack ?? 0.004));
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(f).connect(g).connect(e.sfx);
  src.start(t, Math.random());
  src.stop(t + o.dur + 0.05);
}

function arpeggio(notes: number[], step: number, type: Osc, gain: number, dur = 0.25): void {
  notes.forEach((n, i) => tone(midiToHz(n), { type, at: i * step, dur, gain }));
}

function whistle(at: number, dur: number, voice: SoundVoice): void {
  if (voice === "chip") {
    tone(2093, { type: "square", at, dur, gain: 0.08, vibrato: { rate: 28, depth: 120 } });
    return;
  }
  // A pea whistle: a high tone with a fast warble, plus breath noise.
  tone(2750, { type: "sine", at, dur, gain: 0.18, attack: 0.02, vibrato: { rate: 32, depth: 110 } });
  noise({ at, dur, gain: 0.05, freq: 2750, q: 6, attack: 0.02 });
}

function crowd(kind: "cheer" | "groan"): void {
  const cheer = kind === "cheer";
  const dur = cheer ? 1.8 : 1.2;
  // Several overlapping bands of noise sound like lots of voices at once.
  [420, 700, 1100, 1600].forEach((f, i) =>
    noise({ at: i * 0.03, dur, gain: cheer ? 0.09 : 0.07, freq: f, freqTo: cheer ? f * 1.25 : f * 0.7, q: 2.5, attack: cheer ? 0.25 : 0.12 }),
  );
  if (!cheer) tone(196, { type: "sawtooth", dur: 0.9, gain: 0.03, attack: 0.1, slideTo: 130 });
}

export function playSfx(name: SfxName, voice: SoundVoice = "marker"): void {
  const chip = voice === "chip";
  switch (name) {
    case "select":
      if (chip) tone(880, { type: "square", dur: 0.05, gain: 0.06 });
      else tone(voice === "warm" ? 520 : 740, { type: "triangle", dur: 0.07, gain: 0.12 });
      break;

    case "move":
      if (chip) {
        tone(523, { type: "square", dur: 0.06, gain: 0.07 });
        tone(784, { type: "square", at: 0.05, dur: 0.06, gain: 0.07 });
      } else if (voice === "marker") {
        // Magnet snapping onto the board.
        noise({ dur: 0.05, gain: 0.35, freq: 2400, q: 1.5 });
        tone(170, { dur: 0.09, gain: 0.35, slideTo: 110 });
      } else if (voice === "warm") {
        // Wooden piece on felt.
        tone(240, { type: "triangle", dur: 0.12, gain: 0.35, slideTo: 150 });
        noise({ dur: 0.04, gain: 0.12, freq: 900, q: 0.8 });
      } else {
        noise({ dur: 0.03, gain: 0.25, freq: 4200, q: 2 });
        tone(620, { dur: 0.06, gain: 0.15, slideTo: 480 });
      }
      break;

    case "capture":
      if (chip) {
        arpeggio([76, 72, 67, 60], 0.05, "square", 0.07, 0.08);
        noise({ at: 0.18, dur: 0.12, gain: 0.08, filter: "highpass", freq: 3000 });
      } else {
        // A thud, then the captured piece being swept off.
        tone(voice === "warm" ? 160 : 130, { dur: 0.18, gain: 0.45, slideTo: 70 });
        noise({ dur: 0.08, gain: 0.3, freq: 1800, q: 1.2 });
        noise({ at: 0.08, dur: 0.22, gain: 0.12, freq: 600, freqTo: 3500, q: 1 });
      }
      break;

    case "check":
      whistle(0, 0.38, voice);
      break;

    case "kickoff":
      whistle(0, 0.7, voice);
      break;

    case "fulltime":
      whistle(0, 0.35, voice);
      whistle(0.45, 0.35, voice);
      whistle(0.9, 0.9, voice);
      if (!chip) setTimeout(() => crowd("cheer"), 900);
      break;

    case "correct":
      if (chip) arpeggio([72, 76, 79, 84], 0.07, "square", 0.07, 0.12);
      else arpeggio([72, 76, 79, 84], 0.07, voice === "warm" ? "triangle" : "sine", 0.18, 0.35);
      break;

    case "wrong":
      if (chip) {
        tone(196, { type: "square", dur: 0.18, gain: 0.08 });
        tone(147, { type: "square", at: 0.18, dur: 0.3, gain: 0.08 });
      } else {
        tone(233, { type: "sawtooth", dur: 0.18, gain: 0.08, slideTo: 220 });
        tone(175, { type: "sawtooth", at: 0.17, dur: 0.38, gain: 0.08, slideTo: 150 });
      }
      break;

    case "form":
      tone(midiToHz(83), { type: chip ? "square" : "triangle", dur: 0.08, gain: chip ? 0.06 : 0.16 });
      tone(midiToHz(88), { type: chip ? "square" : "triangle", at: 0.07, dur: 0.22, gain: chip ? 0.06 : 0.16 });
      break;

    case "powerup":
      if (chip) {
        for (let i = 0; i < 8; i++) tone(midiToHz(60 + i * 3), { type: "square", at: i * 0.03, dur: 0.05, gain: 0.05 });
      } else {
        noise({ dur: 0.45, gain: 0.18, freq: 300, freqTo: 4000, q: 2, attack: 0.15 });
        tone(330, { type: "triangle", dur: 0.45, gain: 0.12, attack: 0.1, slideTo: 990 });
        tone(midiToHz(84), { at: 0.4, dur: 0.4, gain: 0.12 });
      }
      break;

    case "locked":
      tone(150, { type: chip ? "square" : "triangle", dur: 0.12, gain: chip ? 0.06 : 0.2 });
      tone(150, { type: chip ? "square" : "triangle", at: 0.14, dur: 0.12, gain: chip ? 0.06 : 0.2 });
      break;

    case "tick":
      if (chip) tone(1200, { type: "square", dur: 0.02, gain: 0.04 });
      else noise({ dur: 0.025, gain: 0.15, freq: 5000, q: 4 });
      break;

    case "cheer":
    case "groan":
      if (chip) {
        if (name === "cheer") arpeggio([67, 72, 76, 79, 84, 88], 0.06, "square", 0.06, 0.1);
        else arpeggio([67, 63, 60, 55], 0.12, "square", 0.06, 0.15);
      } else crowd(name);
      break;
  }
}
