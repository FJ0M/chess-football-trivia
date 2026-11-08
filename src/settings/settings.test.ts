import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, loadSettings, sanitize, saveSettings } from "./settings";
import { parseLead, noteToMidi, TRACKS } from "../audio/music";
import { STYLES } from "../theme/themes";

describe("settings", () => {
  it("defaults to the Tactics Board style", () => {
    expect(DEFAULT_SETTINGS.style).toBe("tactics");
    expect(loadSettings({ getItem: () => null }).style).toBe("tactics");
  });

  it("round-trips through storage", () => {
    const store = new Map<string, string>();
    const s = { ...DEFAULT_SETTINGS, style: "teletext" as const, musicVolume: 0.1, sfxOn: false };
    saveSettings(s, { setItem: (k, v) => store.set(k, v) });
    expect(loadSettings({ getItem: (k) => store.get(k) ?? null })).toEqual(s);
  });

  it("repairs bad or old saves", () => {
    expect(sanitize({ style: "nope", sfxVolume: 7, musicTrack: "x", musicOn: "yes" })).toEqual({ ...DEFAULT_SETTINGS, sfxVolume: 1 });
    expect(loadSettings({ getItem: () => "{not json" })).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps the motion and commentator switches, defaulting to motion on and the commentator on", () => {
    expect(DEFAULT_SETTINGS.reduceMotion).toBe(false);
    expect(DEFAULT_SETTINGS.commentary).toBe(true);
    expect(sanitize({ reduceMotion: true, commentary: false })).toMatchObject({ reduceMotion: true, commentary: false });
    expect(sanitize({ reduceMotion: "yes", commentary: 0 })).toMatchObject({ reduceMotion: false, commentary: true });
  });
});

describe("styles and music", () => {
  it("has ten styles, each with a known music track", () => {
    expect(STYLES).toHaveLength(10);
    for (const s of STYLES) expect(TRACKS.some((t) => t.id === s.music)).toBe(true);
  });

  it("parses notes and melodies", () => {
    expect(noteToMidi("A4")).toBe(69);
    expect(noteToMidi("F#3")).toBe(54);
    expect(parseLead(["C5 - E5 . G5 - - ."])).toEqual([
      { step: 0, midi: 72, steps: 4 },
      { step: 4, midi: 76, steps: 2 },
      { step: 8, midi: 79, steps: 6 },
    ]);
  });

  it("every track has 8 bars of 8 notes and valid note names", () => {
    for (const t of TRACKS) {
      expect(t.lead).toHaveLength(8);
      for (const bar of t.lead) expect(bar.trim().split(/\s+/)).toHaveLength(8);
      expect(() => parseLead(t.lead)).not.toThrow();
      t.chords.flat().concat(t.bass).forEach((n) => expect(() => noteToMidi(n)).not.toThrow());
      for (const p of [t.kick, t.snare, t.hat]) expect(p).toHaveLength(16);
    }
  });
});

describe("Pass and Play view", () => {
  it("defaults to flipping the whole screen, and moves old default saves over once", () => {
    expect(DEFAULT_SETTINGS.passAndPlayView).toBe("flip");
    const old = { getItem: () => JSON.stringify({ passAndPlayView: "hand-over" }) };
    expect(loadSettings(old).passAndPlayView).toBe("flip");
    let saved = "";
    saveSettings({ ...DEFAULT_SETTINGS, passAndPlayView: "hand-over" }, { setItem: (_k: string, v: string) => { saved = v; } });
    expect(loadSettings({ getItem: () => saved }).passAndPlayView).toBe("hand-over");
  });

  it("moves the retired face-to-face and off views to the closest of the two left", () => {
    const load = (v: string, viewVersion = 2) => loadSettings({ getItem: () => JSON.stringify({ passAndPlayView: v, viewVersion }) }).passAndPlayView;
    expect(load("face-to-face")).toBe("flip");
    expect(load("off")).toBe("hand-over");
    expect(load("face-to-face", 1)).toBe("flip");
    expect(sanitize({ passAndPlayView: "face-to-face" }).passAndPlayView).toBe("flip");
  });
});
