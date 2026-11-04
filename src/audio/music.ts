// Background music: four original looping tracks played by a small step
// sequencer on the Web Audio clock. No audio files and no licensed tunes.

import { getEngine, midiToHz } from "./engine";
import type { MusicTrackId } from "../theme/themes";

type PadStyle = "hold" | "stabs" | "arp" | "oompah";

interface TrackDef {
  id: MusicTrackId;
  name: string;
  mood: string;
  bpm: number;
  /** Chord per bar, as note names. The loop length is the number of lead bars. */
  chords: string[][];
  /** Bass root per bar. */
  bass: string[];
  /** Lead melody, one string per bar, 8 tokens (eighth notes). "-" holds, "." rests. */
  lead: string[];
  /** 16 steps per bar: "x" hits. */
  kick: string;
  snare: string;
  hat: string;
  bassSteps: number[];
  pad: PadStyle;
  stabSteps?: number[];
  sound: { pad: OscillatorType; lead: OscillatorType; bass: OscillatorType; filter: number; chip?: boolean; organ?: boolean };
  level: { pad: number; lead: number; bass: number; drums: number };
}

export const TRACKS: TrackDef[] = [
  {
    id: "training-ground", name: "Training Ground", mood: "Laid-back, for thinking moves through", bpm: 84,
    chords: [["F3", "A3", "C4", "E4"], ["E3", "G3", "B3", "D4"], ["D3", "F3", "A3", "C4"], ["C3", "E3", "G3", "B3"]],
    bass: ["F2", "E2", "D2", "C2"],
    lead: ["A4 - C5 - E5 - - .", "D5 - B4 - G4 - - .", "F4 - A4 - C5 - D5 -", "E5 - - - - - . .", "A4 - C5 - G5 - E5 -", "D5 - - B4 - - G4 -", "A4 - F4 - A4 - C5 -", "B4 - - - G4 - - ."],
    kick: "x.......x.x.....", snare: "....x.......x...", hat: "..x...x...x...x.",
    bassSteps: [0, 7, 10], pad: "stabs", stabSteps: [0, 10],
    sound: { pad: "triangle", lead: "sine", bass: "sine", filter: 1800 },
    level: { pad: 0.07, lead: 0.09, bass: 0.18, drums: 0.5 },
  },
  {
    id: "under-the-lights", name: "Under the Lights", mood: "Big-match, terrace energy", bpm: 122,
    chords: [["A3", "C4", "E4"], ["F3", "A3", "C4"], ["G3", "C4", "E4"], ["G3", "B3", "D4"]],
    bass: ["A2", "F2", "C3", "G2"],
    lead: ["E5 - E5 - D5 C5 D5 -", "C5 - A4 - - - . .", "G4 - C5 - E5 - G5 -", "F5 - E5 - D5 - - .", "E5 - E5 - D5 C5 D5 E5", "F5 - E5 - C5 - A4 -", "G4 - C5 - E5 - D5 C5", "D5 - - - B4 - - ."],
    kick: "x...x...x...x...", snare: "....x.......x...", hat: ".x.x.x.x.x.x.x.x",
    bassSteps: [0, 2, 4, 6, 8, 10, 12, 14], pad: "hold",
    sound: { pad: "sawtooth", lead: "square", bass: "sawtooth", filter: 1400 },
    level: { pad: 0.035, lead: 0.05, bass: 0.09, drums: 0.6 },
  },
  {
    id: "page-302", name: "Page 302", mood: "Chiptune, for the Teletext style", bpm: 140,
    chords: [["C4", "E4", "G4"], ["A3", "C4", "E4"], ["F3", "A3", "C4"], ["G3", "B3", "D4"]],
    bass: ["C3", "A2", "F2", "G2"],
    lead: ["C5 - E5 G5 - E5 C5 -", "A4 - C5 E5 - C5 A4 -", "F4 A4 C5 F5 - E5 D5 C5", "B4 - D5 - G5 - - .", "C5 - E5 G5 - A5 G5 E5", "A4 - C5 E5 - D5 C5 -", "F5 - E5 - D5 - C5 -", "D5 - B4 - G4 - - ."],
    kick: "x.......x.......", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x.",
    bassSteps: [0, 2, 4, 6, 8, 10, 12, 14], pad: "arp",
    sound: { pad: "square", lead: "square", bass: "triangle", filter: 6000, chip: true },
    level: { pad: 0.025, lead: 0.045, bass: 0.14, drums: 0.35 },
  },
  {
    id: "half-time", name: "Half-Time Organ", mood: "Jolly stadium organ", bpm: 108,
    chords: [["G3", "B3", "D4"], ["G3", "C4", "E4"], ["F#3", "A3", "D4"], ["G3", "B3", "D4"]],
    bass: ["G2", "C3", "D3", "G2"],
    lead: ["D5 - B4 - G4 - B4 -", "C5 - E5 - G5 - E5 -", "D5 - F#5 - A5 - F#5 -", "G5 - - - - - . .", "B4 - D5 - G5 - D5 -", "E5 - C5 - G4 - C5 -", "A4 - D5 - F#5 - E5 D5", "G4 - - - - - . ."],
    kick: "x.......x.......", snare: "....x.......x...", hat: "................",
    bassSteps: [0, 8], pad: "oompah",
    sound: { pad: "sine", lead: "sine", bass: "triangle", filter: 3000, organ: true },
    level: { pad: 0.06, lead: 0.07, bass: 0.2, drums: 0.3 },
  },
];

const NOTE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function noteToMidi(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`Bad note ${name}`);
  return 12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}

interface LeadNote { step: number; midi: number; steps: number }

/** Turns the bar strings into notes on a 16-step-per-bar grid. */
export function parseLead(bars: string[]): LeadNote[] {
  const tokens = bars.flatMap((b) => b.trim().split(/\s+/));
  const out: LeadNote[] = [];
  tokens.forEach((tok, i) => {
    if (tok === "-" || tok === ".") return;
    let len = 1;
    while (tokens[i + len] === "-") len++;
    out.push({ step: i * 2, midi: noteToMidi(tok), steps: len * 2 });
  });
  return out;
}

type Dest = AudioNode;

function voice(ctx: AudioContext, dest: Dest, t: number, midi: number, dur: number, type: OscillatorType, gain: number, filter: number, attack = 0.01, organ = false): void {
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = filter;
  const partials = organ ? [1, 2, 3, 4] : [1];
  const oscs = partials.map((p, i) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = midiToHz(midi) * p;
    const pg = ctx.createGain();
    pg.gain.value = organ ? [1, 0.5, 0.3, 0.15][i] : 1;
    o.connect(pg).connect(f);
    return o;
  });
  const release = Math.min(0.2, dur * 0.5);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.setValueAtTime(gain, t + Math.max(attack, dur - release));
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  f.connect(g).connect(dest);
  oscs.forEach((o) => { o.start(t); o.stop(t + dur + 0.02); });
}

function drum(ctx: AudioContext, dest: Dest, noise: AudioBuffer, t: number, kind: "kick" | "snare" | "hat", level: number, chip: boolean): void {
  const g = ctx.createGain();
  g.connect(dest);
  if (kind === "kick") {
    const o = ctx.createOscillator();
    o.type = chip ? "square" : "sine";
    o.frequency.setValueAtTime(chip ? 110 : 150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(level * (chip ? 0.25 : 0.9), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.3);
    return;
  }
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = kind === "hat" ? 7000 : 1500;
  const dur = kind === "hat" ? 0.04 : 0.16;
  g.gain.setValueAtTime(level * (kind === "hat" ? 0.15 : 0.35), t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g);
  src.start(t, Math.random());
  src.stop(t + dur + 0.02);
}

class Player {
  private track: TrackDef | null = null;
  private lead: LeadNote[] = [];
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;

  get current(): MusicTrackId | null {
    return this.track?.id ?? null;
  }

  play(id: MusicTrackId): void {
    const e = getEngine();
    if (!e) return;
    if (this.track?.id === id && this.timer !== null) return;
    this.stop();
    this.track = TRACKS.find((t) => t.id === id) ?? TRACKS[0];
    this.lead = parseLead(this.track.lead);
    this.step = 0;
    this.nextTime = e.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.track = null;
  }

  private schedule(): void {
    const e = getEngine();
    const tr = this.track;
    if (!e || !tr) return;
    const stepDur = 60 / tr.bpm / 4;
    const loopSteps = tr.lead.length * 16;
    while (this.nextTime < e.ctx.currentTime + 0.15) {
      this.playStep(e.ctx, e.music, e.noise, tr, this.step % loopSteps, this.nextTime, stepDur);
      this.step++;
      this.nextTime += stepDur;
    }
  }

  private playStep(ctx: AudioContext, dest: Dest, noise: AudioBuffer, tr: TrackDef, step: number, t: number, sd: number): void {
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const chord = tr.chords[bar % tr.chords.length].map(noteToMidi);
    const bass = noteToMidi(tr.bass[bar % tr.bass.length]);
    const { sound: snd, level } = tr;

    if (tr.kick[s] === "x") drum(ctx, dest, noise, t, "kick", level.drums, !!snd.chip);
    if (tr.snare[s] === "x") drum(ctx, dest, noise, t, "snare", level.drums, !!snd.chip);
    if (tr.hat[s] === "x") drum(ctx, dest, noise, t, "hat", level.drums, !!snd.chip);

    if (tr.bassSteps.includes(s)) {
      const octave = snd.chip && s % 4 === 2 ? 12 : 0;
      voice(ctx, dest, t, bass + octave, sd * (tr.bassSteps.length > 4 ? 1.6 : 3), snd.bass, level.bass, 900);
    }

    if (tr.pad === "hold" && s === 0) chord.forEach((m) => voice(ctx, dest, t, m, sd * 16, snd.pad, level.pad, snd.filter, 0.3));
    if (tr.pad === "stabs" && tr.stabSteps?.includes(s)) chord.forEach((m) => voice(ctx, dest, t, m, sd * 5, snd.pad, level.pad, snd.filter, 0.02));
    if (tr.pad === "arp") voice(ctx, dest, t, chord[s % chord.length] + 12, sd * 0.9, snd.pad, level.pad, snd.filter, 0.003);
    if (tr.pad === "oompah" && (s === 4 || s === 12)) chord.forEach((m) => voice(ctx, dest, t, m, sd * 3, snd.pad, level.pad, snd.filter, 0.01, snd.organ));

    for (const n of this.lead) {
      if (n.step === step) voice(ctx, dest, t, n.midi, sd * n.steps * 0.95, snd.lead, level.lead, snd.filter * 1.5, 0.015, snd.organ);
    }
  }
}

export const music = new Player();
