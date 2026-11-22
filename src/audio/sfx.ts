// Sound effects, all synthesised with Web Audio so there are no audio files to
// license or download. Each style picks a "voice" that changes the character:
// marker = magnets on a whiteboard, warm = wood and felt, chip = 8-bit beeps,
// crisp = clean UI clicks.

import { duckFor, getEngine, midiToHz } from "./engine";
import type { SoundVoice } from "../theme/themes";
import type { PowerUpId } from "../game/types";

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
  | "groan"
  | "castle"
  | "bigCapture"
  | "win"
  | "lose"
  | "draw"
  | "redCard"
  | "foul"
  | "bus"
  | "rewind"
  | "stopwatch"
  | "coins"
  | "subBoard"
  | "whoosh"
  | "shuffle"
  | "doubleWhistle"
  | "scan"
  | "save"
  | "badge"
  | "hatTrick"
  | "tap";

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
  castle: "Castling",
  bigCapture: "Taking a queen or rook",
  win: "You win",
  lose: "You lose",
  draw: "A draw",
  redCard: "Red Card",
  foul: "Tactical Foul",
  bus: "Park the Bus",
  rewind: "VAR Review",
  stopwatch: "Fergie Time",
  coins: "Golden Boot",
  subBoard: "Substitution board",
  whoosh: "Counter-Attack",
  shuffle: "Formation Change",
  doubleWhistle: "Extra Time",
  scan: "Scouting hint",
  save: "Penalty saved",
  badge: "Badge won",
  hatTrick: "Hat-trick",
  tap: "Menu button",
};

/** Every power-up gets its own sound, played over the general power-up swell. */
export const POWER_SFX: Record<PowerUpId, SfxName> = {
  "fergie-time": "stopwatch",
  "tactical-foul": "foul",
  "park-the-bus": "bus",
  "var-review": "rewind",
  "counter-attack": "whoosh",
  substitution: "subBoard",
  "golden-boot": "coins",
  "formation-change": "shuffle",
  "super-sub": "subBoard",
  "red-card": "redCard",
  "extra-time": "doubleWhistle",
  "assistants-flag": "scan",
  "scout-report": "scan",
  "managers-tip": "scan",
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

/** The crowd's own sounds (cheers, groans, applause) go through the crowd volume, so Crowd off silences them too. */
let bus: "sfx" | "crowd" = "sfx";
function onCrowd(f: () => void): void {
  bus = "crowd";
  try { f(); } finally { bus = "sfx"; }
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
  osc.connect(g).connect(e[bus]);
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
  src.connect(f).connect(g).connect(e[bus]);
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

/** A short "ooh" from the stands: a vowel-ish swell that rises then drops. */
function ooh(at = 0, gain = 0.07): void {
  [300, 520, 850].forEach((f, i) =>
    noise({ at: at + i * 0.02, dur: 0.9, gain, freq: f, freqTo: f * 0.8, q: 5, attack: 0.18 }),
  );
}

/** Lots of hands clapping: many tiny noise bursts at random times. */
function applause(dur: number, gain = 0.12, at = 0): void {
  const n = Math.round(dur * 40);
  for (let i = 0; i < n; i++) {
    const t = at + Math.random() * dur;
    const fade = 1 - (t - at) / (dur * 1.2);
    noise({ at: t, dur: 0.03, gain: gain * fade * (0.5 + Math.random() * 0.5), freq: 1200 + Math.random() * 1800, q: 1.5, attack: 0.002 });
  }
}

/** A stadium air horn. */
function horn(at: number, dur: number, gain = 0.07): void {
  [233, 236, 466].forEach((f) => tone(f, { type: "sawtooth", at, dur, gain: gain / (f > 400 ? 2 : 1), attack: 0.03 }));
}

/** Crowd sounds are about 14 dB louder than they were (audit, 2026-11-22: a cheer was quieter than a move). */
const CROWD_GAIN = 5;

function crowd(kind: "cheer" | "groan" | "roar"): void {
  onCrowd(() => crowdSound(kind));
}

function crowdSound(kind: "cheer" | "groan" | "roar"): void {
  if (kind === "roar") {
    // The net bulges: a big rising roar that hangs in the air.
    [380, 650, 1000, 1500, 2200].forEach((f, i) =>
      noise({ at: i * 0.02, dur: 3.2, gain: 0.1 * CROWD_GAIN, freq: f * 0.8, freqTo: f * 1.3, q: 2, attack: 0.35 }),
    );
    applause(2.6, 0.1 * CROWD_GAIN, 0.6);
    return;
  }
  const cheer = kind === "cheer";
  const dur = cheer ? 1.8 : 1.2;
  // Several overlapping bands of noise sound like lots of voices at once.
  [420, 700, 1100, 1600].forEach((f, i) =>
    noise({ at: i * 0.03, dur, gain: (cheer ? 0.09 : 0.07) * CROWD_GAIN, freq: f, freqTo: cheer ? f * 1.25 : f * 0.7, q: 2.5, attack: cheer ? 0.25 : 0.12 }),
  );
  if (!cheer) tone(196, { type: "sawtooth", dur: 0.9, gain: 0.03 * CROWD_GAIN, attack: 0.1, slideTo: 130 });
}

/** The big moments dip the music and crowd for this long (ms) so they cut through. */
const DUCK_FOR: Partial<Record<SfxName, number>> = {
  fulltime: 2200, win: 3500, lose: 3000, draw: 2500, redCard: 1500, bigCapture: 1000, wrong: 1000, save: 1200, cheer: 1600, groan: 1200, hatTrick: 2000, badge: 1500,
};

export function playSfx(name: SfxName, voice: SoundVoice = "marker"): void {
  const chip = voice === "chip";
  const dip = DUCK_FOR[name];
  if (dip) duckFor(dip);
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
      break;

    case "correct":
      if (chip) arpeggio([72, 76, 79, 84], 0.07, "square", 0.07, 0.12);
      else arpeggio([72, 76, 79, 84], 0.07, voice === "warm" ? "triangle" : "sine", 0.18, 0.35);
      break;

    case "wrong":
      if (chip) {
        tone(196, { type: "square", dur: 0.18, gain: 0.12 });
        tone(147, { type: "square", at: 0.18, dur: 0.3, gain: 0.12 });
      } else {
        tone(233, { type: "sawtooth", dur: 0.18, gain: 0.2, slideTo: 220 });
        tone(175, { type: "sawtooth", at: 0.17, dur: 0.38, gain: 0.2, slideTo: 150 });
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
      if (chip) tone(1200, { type: "square", dur: 0.03, gain: 0.1 });
      else { noise({ dur: 0.03, gain: 0.5, freq: 4000, q: 3 }); tone(1800, { dur: 0.04, gain: 0.12 }); }
      break;

    case "cheer":
    case "groan":
      if (chip) {
        if (name === "cheer") arpeggio([67, 72, 76, 79, 84, 88], 0.06, "square", 0.06, 0.1);
        else arpeggio([67, 63, 60, 55], 0.12, "square", 0.06, 0.15);
      } else crowd(name);
      break;

    case "castle":
      // The king tucks away: two quick slides.
      if (chip) arpeggio([60, 67], 0.07, "square", 0.06, 0.07);
      else {
        noise({ dur: 0.12, gain: 0.12, freq: 800, freqTo: 2400, q: 1.5 });
        noise({ at: 0.13, dur: 0.12, gain: 0.12, freq: 2400, freqTo: 800, q: 1.5 });
        tone(196, { at: 0.24, dur: 0.1, gain: 0.25, slideTo: 130 });
      }
      break;

    case "bigCapture":
      playSfx("capture", voice);
      if (chip) arpeggio([72, 79], 0.08, "square", 0.05, 0.1);
      else ooh(0.1, 0.06);
      break;

    case "win":
      if (chip) arpeggio([60, 64, 67, 72, 76, 79, 84], 0.08, "square", 0.07, 0.2);
      else {
        crowd("roar");
        horn(0.15, 0.5);
        horn(0.75, 0.9);
        arpeggio([67, 72, 76, 79], 0.12, voice === "warm" ? "triangle" : "sine", 0.1, 0.5);
      }
      break;

    case "lose":
      if (chip) arpeggio([67, 66, 65, 64], 0.25, "square", 0.06, 0.3);
      else {
        crowd("groan");
        // A sad brass slide down.
        [0, 0.35, 0.7].forEach((at, i) => tone(midiToHz(62 - i), { type: "sawtooth", at, dur: 0.33, gain: 0.16, attack: 0.03 }));
        tone(midiToHz(59), { type: "sawtooth", at: 1.05, dur: 0.9, gain: 0.16, attack: 0.03, vibrato: { rate: 5, depth: 4 } });
      }
      break;

    case "draw":
      if (chip) arpeggio([67, 64, 67], 0.12, "square", 0.06, 0.12);
      else {
        onCrowd(() => applause(1.8, 0.09 * CROWD_GAIN));
        // A sporting "fair enough" from the band.
        arpeggio([67, 72, 67], 0.14, voice === "warm" ? "triangle" : "sine", 0.12, 0.3);
      }
      break;

    case "redCard":
      // A sharp whistle, the card comes out, and the crowd reacts.
      whistle(0, 0.25, voice);
      if (chip) { tone(311, { type: "square", at: 0.3, dur: 0.25, gain: 0.07 }); break; }
      noise({ at: 0.28, dur: 0.06, gain: 0.25, freq: 3500, q: 2 });
      ooh(0.35, 0.08);
      break;

    case "foul":
      whistle(0, 0.18, voice);
      whistle(0.22, 0.18, voice);
      if (!chip) noise({ at: 0.45, dur: 0.9, gain: 0.05, freq: 220, freqTo: 180, q: 3, attack: 0.15 });
      break;

    case "bus":
      // Bus horn, then the engine idling.
      if (chip) { tone(220, { type: "square", dur: 0.35, gain: 0.07 }); tone(277, { type: "square", dur: 0.35, gain: 0.05 }); break; }
      tone(330, { type: "sawtooth", dur: 0.45, gain: 0.06, attack: 0.02 });
      tone(415, { type: "sawtooth", dur: 0.45, gain: 0.05, attack: 0.02 });
      tone(60, { type: "sawtooth", at: 0.3, dur: 0.8, gain: 0.08, vibrato: { rate: 14, depth: 6 } });
      break;

    case "rewind":
      // Tape spooling backwards.
      for (let i = 0; i < 6; i++) tone(midiToHz(84 - i * 3), { type: chip ? "square" : "triangle", at: i * 0.05, dur: 0.06, gain: chip ? 0.05 : 0.1 });
      if (!chip) noise({ dur: 0.35, gain: 0.08, freq: 4000, freqTo: 600, q: 2 });
      break;

    case "stopwatch":
      for (let i = 0; i < 4; i++) {
        if (chip) tone(1500, { type: "square", at: i * 0.18, dur: 0.02, gain: 0.05 });
        else noise({ at: i * 0.18, dur: 0.02, gain: 0.25, freq: 5500, q: 6 });
      }
      tone(midiToHz(88), { type: chip ? "square" : "sine", at: 0.75, dur: 0.3, gain: chip ? 0.05 : 0.12 });
      break;

    case "coins":
      [88, 91, 96].forEach((m, i) => tone(midiToHz(m), { type: chip ? "square" : "sine", at: i * 0.06, dur: 0.25, gain: chip ? 0.05 : 0.1 }));
      if (!chip) noise({ dur: 0.3, gain: 0.04, filter: "highpass", freq: 6000 });
      break;

    case "subBoard":
      // The fourth official's board: two electronic beeps.
      tone(1046, { type: chip ? "square" : "sine", dur: 0.12, gain: chip ? 0.06 : 0.14 });
      tone(784, { type: chip ? "square" : "sine", at: 0.15, dur: 0.2, gain: chip ? 0.06 : 0.14 });
      if (!chip) applause(1, 0.06, 0.3);
      break;

    case "whoosh":
      if (chip) { for (let i = 0; i < 6; i++) tone(midiToHz(60 + i * 4), { type: "square", at: i * 0.025, dur: 0.04, gain: 0.05 }); break; }
      noise({ dur: 0.35, gain: 0.2, freq: 400, freqTo: 5000, q: 1.5, attack: 0.1 });
      break;

    case "shuffle":
      for (let i = 0; i < 3; i++) {
        if (chip) tone(660 + i * 110, { type: "square", at: i * 0.08, dur: 0.05, gain: 0.05 });
        else noise({ at: i * 0.08, dur: 0.06, gain: 0.2, freq: 1500 + i * 500, q: 2 });
      }
      break;

    case "doubleWhistle":
      whistle(0, 0.2, voice);
      whistle(0.28, 0.5, voice);
      break;

    case "scan":
      tone(1318, { type: chip ? "square" : "sine", dur: 0.1, gain: chip ? 0.05 : 0.1, slideTo: 1760 });
      tone(1760, { type: chip ? "square" : "sine", at: 0.12, dur: 0.1, gain: chip ? 0.05 : 0.08 });
      break;

    case "save":
      // A thump of gloves on the ball, and relief from the other end.
      tone(110, { dur: 0.15, gain: 0.4, slideTo: 60 });
      noise({ dur: 0.05, gain: 0.25, freq: 1200, q: 1 });
      if (chip) arpeggio([67, 63, 60], 0.08, "square", 0.05, 0.1);
      else ooh(0.1, 0.08);
      break;

    case "badge":
      if (chip) arpeggio([72, 79, 84, 88], 0.06, "square", 0.06, 0.15);
      else {
        [84, 88, 91, 96].forEach((m, i) => tone(midiToHz(m), { type: "triangle", at: i * 0.07, dur: 0.6, gain: 0.08 }));
        applause(1.2, 0.07, 0.25);
      }
      break;

    case "hatTrick":
      // Three blasts on the horn and the stands go up.
      if (chip) { arpeggio([72, 72, 72, 84], 0.12, "square", 0.07, 0.1); break; }
      horn(0, 0.18, 0.1);
      horn(0.24, 0.18, 0.1);
      horn(0.48, 0.45, 0.1);
      crowd("cheer");
      break;

    case "tap":
      if (chip) tone(990, { type: "square", dur: 0.03, gain: 0.03 });
      else tone(voice === "warm" ? 420 : 660, { type: "triangle", dur: 0.04, gain: 0.06 });
      break;
  }
}
