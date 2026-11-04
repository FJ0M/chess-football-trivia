import { DEFAULT_STYLE, STYLES, type MusicTrackId, type StyleId } from "../theme/themes";
import { TRACKS } from "../audio/music";

export interface Settings {
  style: StyleId;
  sfxOn: boolean;
  sfxVolume: number;
  musicOn: boolean;
  musicVolume: number;
  /** "match" plays the track that goes with the chosen style. */
  musicTrack: "match" | MusicTrackId;
}

export const DEFAULT_SETTINGS: Settings = {
  style: DEFAULT_STYLE,
  sfxOn: true,
  sfxVolume: 0.8,
  musicOn: true,
  musicVolume: 0.35,
  musicTrack: "match",
};

const KEY = "cft.settings.v1";

const clamp01 = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;

/** Accepts anything (old saves, hand-edited storage) and returns valid settings. */
export function sanitize(raw: unknown): Settings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof Settings, unknown>>;
  const d = DEFAULT_SETTINGS;
  const style = STYLES.some((s) => s.id === r.style) ? (r.style as StyleId) : d.style;
  const track = r.musicTrack === "match" || TRACKS.some((t) => t.id === r.musicTrack) ? (r.musicTrack as Settings["musicTrack"]) : d.musicTrack;
  return {
    style,
    sfxOn: typeof r.sfxOn === "boolean" ? r.sfxOn : d.sfxOn,
    sfxVolume: clamp01(r.sfxVolume, d.sfxVolume),
    musicOn: typeof r.musicOn === "boolean" ? r.musicOn : d.musicOn,
    musicVolume: clamp01(r.musicVolume, d.musicVolume),
    musicTrack: track,
  };
}

export function loadSettings(storage: Pick<Storage, "getItem"> | undefined = safeStorage()): Settings {
  try {
    const text = storage?.getItem(KEY);
    return sanitize(text ? JSON.parse(text) : {});
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings, storage: Pick<Storage, "setItem"> | undefined = safeStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(s));
  } catch {
    // Private browsing or storage full: settings just won't persist.
  }
}

function safeStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
