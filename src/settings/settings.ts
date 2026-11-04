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
  /** Pass and Play: turn the whole screen to face whoever is up (device flat on the table), flip just the board (hand the device over), keep the board fixed and turn the controls, or none. */
  passAndPlayView: PassAndPlayView;
}

export type PassAndPlayView = "flip" | "hand-over" | "face-to-face" | "off";
const VIEWS: PassAndPlayView[] = ["flip", "hand-over", "face-to-face", "off"];
/** Saves from before "flip" existed had "hand-over" as the default; they move to the new default once. */
const VIEW_VERSION = 2;

export const DEFAULT_SETTINGS: Settings = {
  style: DEFAULT_STYLE,
  sfxOn: true,
  sfxVolume: 0.8,
  musicOn: true,
  musicVolume: 0.35,
  musicTrack: "match",
  passAndPlayView: "flip",
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
    passAndPlayView: VIEWS.includes(r.passAndPlayView as PassAndPlayView) ? (r.passAndPlayView as PassAndPlayView) : d.passAndPlayView,
  };
}

export function loadSettings(storage: Pick<Storage, "getItem"> | undefined = safeStorage()): Settings {
  try {
    const text = storage?.getItem(KEY);
    const raw = text ? JSON.parse(text) : {};
    if (raw && typeof raw === "object" && raw.viewVersion !== VIEW_VERSION && raw.passAndPlayView === "hand-over") raw.passAndPlayView = "flip";
    return sanitize(raw);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings, storage: Pick<Storage, "setItem"> | undefined = safeStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify({ ...s, viewVersion: VIEW_VERSION }));
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
