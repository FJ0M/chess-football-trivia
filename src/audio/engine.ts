// One shared AudioContext with separate volume buses for sound effects and music.
// Browsers only allow audio after the player touches the page, so nothing makes a
// sound until unlockAudio() has run from a tap or key press.

interface Engine {
  ctx: AudioContext;
  sfx: GainNode;
  music: GainNode;
  /** The crowd atmosphere in a match. */
  crowd: GainNode;
  noise: AudioBuffer;
}

let engine: Engine | null = null;
let unlocked = false;
let sfxLevel = 0.8;
let musicLevel = 0.4;
let crowdLevel = 0.5;
/** Music and crowd drop while a question is up, so you can think. */
let ducked = false;
const DUCK = 0.35;
/** And dip further for a moment under the big stings (full time, a red card, a wrong answer…). */
let dippedUntil = 0;
const DIP = 0.2;
let dipTimer: ReturnType<typeof setTimeout> | undefined;
/** The music sits a little under the effects and the crowd (audit, 2026-11-22: it was louder than the payoffs). */
const MUSIC_TRIM = 0.7;
const level = (): number => Math.min(ducked ? DUCK : 1, Date.now() < dippedUntil ? DIP : 1);

function create(): Engine | null {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  const ctx = new Ctor();
  const master = ctx.createDynamicsCompressor();
  master.threshold.value = -12;
  master.ratio.value = 4;
  master.connect(ctx.destination);
  const sfx = ctx.createGain();
  const music = ctx.createGain();
  const crowd = ctx.createGain();
  sfx.gain.value = sfxLevel;
  music.gain.value = musicLevel * MUSIC_TRIM * level();
  crowd.gain.value = crowdLevel * level();
  sfx.connect(master);
  music.connect(master);
  crowd.connect(master);

  // Two seconds of white noise, reused for whistles, crowds, hats and swishes.
  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) void ctx.suspend();
    else if (unlocked) void ctx.resume();
  });
  return { ctx, sfx, music, crowd, noise };
}

export function getEngine(): Engine | null {
  if (!unlocked) return null;
  if (!engine) engine = create();
  return engine;
}

/** Call from a user gesture. Safe to call many times. */
export function unlockAudio(): void {
  unlocked = true;
  const e = getEngine();
  if (e && e.ctx.state !== "running") void e.ctx.resume();
}

export function isAudioUnlocked(): boolean {
  return unlocked;
}

export function setSfxVolume(v: number): void {
  sfxLevel = v;
  if (engine) engine.sfx.gain.setTargetAtTime(v, engine.ctx.currentTime, 0.02);
}

export function setMusicVolume(v: number): void {
  musicLevel = v;
  if (engine) engine.music.gain.setTargetAtTime(v * MUSIC_TRIM * level(), engine.ctx.currentTime, 0.05);
}

export function setCrowdVolume(v: number): void {
  crowdLevel = v;
  if (engine) engine.crowd.gain.setTargetAtTime(v * level(), engine.ctx.currentTime, 0.1);
}

/** Turns the music and the crowd down (true) or back up (false). */
export function setDucked(on: boolean): void {
  if (ducked === on) return;
  ducked = on;
  applyLevel(on ? 0.15 : 0.4);
}

function applyLevel(tau: number): void {
  if (!engine) return;
  const k = level();
  const t = engine.ctx.currentTime;
  engine.music.gain.setTargetAtTime(musicLevel * MUSIC_TRIM * k, t, tau);
  engine.crowd.gain.setTargetAtTime(crowdLevel * k, t, tau);
}

/** Dips the music and crowd for `ms` under a big sound, then brings them back. */
export function duckFor(ms: number): void {
  dippedUntil = Math.max(dippedUntil, Date.now() + ms);
  applyLevel(0.06);
  clearTimeout(dipTimer);
  dipTimer = setTimeout(() => applyLevel(0.6), dippedUntil - Date.now() + 20);
}

export const midiToHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
