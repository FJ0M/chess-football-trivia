// One shared AudioContext with separate volume buses for sound effects and music.
// Browsers only allow audio after the player touches the page, so nothing makes a
// sound until unlockAudio() has run from a tap or key press.

interface Engine {
  ctx: AudioContext;
  sfx: GainNode;
  music: GainNode;
  noise: AudioBuffer;
}

let engine: Engine | null = null;
let unlocked = false;
let sfxLevel = 0.8;
let musicLevel = 0.4;

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
  sfx.gain.value = sfxLevel;
  music.gain.value = musicLevel;
  sfx.connect(master);
  music.connect(master);

  // Two seconds of white noise, reused for whistles, crowds, hats and swishes.
  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) void ctx.suspend();
    else if (unlocked) void ctx.resume();
  });
  return { ctx, sfx, music, noise };
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
  if (engine) engine.music.gain.setTargetAtTime(v, engine.ctx.currentTime, 0.05);
}

export const midiToHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
