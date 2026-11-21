// Crowd atmosphere for a match: a low murmur from the stands that never quite
// settles, the odd "ooh", bursts of rhythmic clapping, and swells when something
// happens on the board. All filtered noise on the Web Audio clock, no recordings.

import { getEngine } from "./engine";
import type { SfxName } from "./sfx";

interface Running {
  sources: AudioScheduledSourceNode[];
  out: GainNode;
  /** Opens up for a moment when the crowd reacts. */
  swell: GainNode;
  timer: number;
}

let running: Running | null = null;

/** One burst of filtered noise on the crowd bus. */
function burst(dest: AudioNode, at: number, dur: number, freq: number, gain: number, opts: { q?: number; attack?: number; freqTo?: number } = {}): void {
  const e = getEngine();
  if (!e) return;
  const { ctx } = e;
  const src = ctx.createBufferSource();
  src.buffer = e.noise;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.setValueAtTime(freq, at);
  if (opts.freqTo) f.frequency.exponentialRampToValueAtTime(opts.freqTo, at + dur);
  f.Q.value = opts.q ?? 2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + (opts.attack ?? 0.003));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(at, Math.random());
  src.stop(at + dur + 0.05);
}

/** The stands clapping together: clap, clap, clap-clap-clap. */
function rhythmClap(dest: AudioNode, at: number): void {
  const beats = [0, 0.5, 1, 1.25, 1.5, 2.5, 3, 3.5, 3.75, 4];
  for (const b of beats) {
    // Each clap is a crowd of hands, a few milliseconds apart.
    for (let i = 0; i < 6; i++) burst(dest, at + b * 0.42 + Math.random() * 0.03, 0.05, 1400 + Math.random() * 1600, 0.05, { q: 1.2 });
  }
}

function ooh(dest: AudioNode, at: number, gain: number): void {
  [320, 540, 900].forEach((f, i) => burst(dest, at + i * 0.02, 1.1, f, gain, { q: 5, attack: 0.22, freqTo: f * 0.78 }));
}

/** Starts the crowd (does nothing if it's already going or audio is still locked). */
export function startCrowd(): void {
  const e = getEngine();
  if (!e || running) return;
  const { ctx } = e;
  const t = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(1, t + 2);
  const swell = ctx.createGain();
  swell.gain.value = 1;
  swell.connect(out).connect(e.crowd);

  // The murmur: four bands of noise, each drifting up and down at its own slow rate.
  const sources: AudioScheduledSourceNode[] = [];
  [[250, 0.05, 0.13], [480, 0.04, 0.09], [800, 0.03, 0.17], [1300, 0.015, 0.07]].forEach(([freq, level, rate]) => {
    const src = ctx.createBufferSource();
    src.buffer = e.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    f.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.value = level;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rate;
    const depth = ctx.createGain();
    depth.gain.value = level * 0.5;
    lfo.connect(depth).connect(g.gain);
    src.connect(f).connect(g).connect(swell);
    src.start(t, Math.random() * 1.5);
    lfo.start(t);
    sources.push(src, lfo);
  });

  // Every few seconds the stands do something.
  const timer = window.setInterval(() => {
    const now = getEngine()?.ctx.currentTime;
    if (now === undefined || Math.random() > 0.35) return;
    const r = Math.random();
    if (r < 0.45) ooh(swell, now, 0.025);
    else if (r < 0.75) rhythmClap(swell, now);
    else for (let i = 0; i < 30; i++) burst(swell, now + Math.random() * 1.6, 0.03, 1500 + Math.random() * 1500, 0.03);
  }, 3000);

  running = { sources, out, swell, timer };
}

/** Fades the crowd out. */
export function stopCrowd(): void {
  const e = getEngine();
  const r = running;
  running = null;
  if (!r) return;
  window.clearInterval(r.timer);
  if (!e) return;
  const t = e.ctx.currentTime;
  r.out.gain.cancelScheduledValues(t);
  r.out.gain.setTargetAtTime(0.0001, t, 0.3);
  r.sources.forEach((s) => s.stop(t + 1.5));
  setTimeout(() => r.out.disconnect(), 1700);
}

export function crowdRunning(): boolean {
  return running !== null;
}

/** How much the murmur rises for each moment (1 = no change). */
const SWELL: Partial<Record<SfxName, number>> = { capture: 1.8, bigCapture: 3, check: 2.2, castle: 1.3, redCard: 2.5, foul: 2, kickoff: 1.5 };

/** The stands react to a sound effect: the murmur swells, and the big moments get an "ooh". */
export function crowdReact(s: SfxName): void {
  const e = getEngine();
  const r = running;
  const k = SWELL[s];
  if (!e || !r || !k) return;
  const t = e.ctx.currentTime;
  r.swell.gain.cancelScheduledValues(t);
  r.swell.gain.setTargetAtTime(k, t, 0.12);
  r.swell.gain.setTargetAtTime(1, t + 0.7, 0.6);
  if (s === "check") ooh(r.swell, t + 0.15, 0.03);
}
