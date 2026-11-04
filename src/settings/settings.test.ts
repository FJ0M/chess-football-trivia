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
