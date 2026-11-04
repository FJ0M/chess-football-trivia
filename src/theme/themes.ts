// The ten visual styles. Each id matches a `.style-<id>` block in themes.css.
// Tactics Board is the default; the rest are picked in Settings.

export type StyleId =
  | "tactics"
  | "floodlit"
  | "programme"
  | "sticker"
  | "tabletop"
  | "fanzine"
  | "broadcast"
  | "teletext"
  | "shirt"
  | "pundit";

/** Which synth voice the sound effects use for this style. */
export type SoundVoice = "marker" | "warm" | "chip" | "crisp";

export type MusicTrackId = "training-ground" | "under-the-lights" | "page-302" | "half-time";

export interface GameStyle {
  id: StyleId;
  name: string;
  blurb: string;
  /** Page background colour, used for the browser's theme-color. */
  chrome: string;
  swatches: string[];
  voice: SoundVoice;
  music: MusicTrackId;
}

export const DEFAULT_STYLE: StyleId = "tactics";

export const STYLES: GameStyle[] = [
  { id: "tactics", name: "Tactics Board", blurb: "Magnets on the manager's whiteboard, marker-pen arrows, sticky-note questions.", chrome: "#f6f8f8", swatches: ["#f6f8f8", "#4a9a4f", "#1f5fbf", "#d1342f", "#fff7a8"], voice: "marker", music: "training-ground" },
  { id: "floodlit", name: "Floodlit Night", blurb: "A striped pitch under the lights against a navy sky.", chrome: "#070c1d", swatches: ["#070c1d", "#3f873a", "#4e9b45", "#ffe066", "#f4f4ef"], voice: "warm", music: "under-the-lights" },
  { id: "programme", name: "Matchday Programme", blurb: "Halftone sky-blue paper, slab headlines and claret blocks.", chrome: "#a9d4ee", swatches: ["#a9d4ee", "#7a263a", "#f3ead6", "#1c2a4a", "#2a0f17"], voice: "warm", music: "half-time" },
  { id: "sticker", name: "Sticker Album", blurb: "Pieces on round stickers with foil borders.", chrome: "#ffd23f", swatches: ["#ffd23f", "#ff8a3d", "#1e1240", "#46d6b4", "#ff3d7f"], voice: "crisp", music: "half-time" },
  { id: "tabletop", name: "Tabletop Flick", blurb: "Felt pitch on a wooden frame, pieces on round bases.", chrome: "#6b3f1f", swatches: ["#6b3f1f", "#2f7238", "#3e8a45", "#c8242a", "#fff8ec"], voice: "warm", music: "training-ground" },
  { id: "fanzine", name: "Terrace Fanzine", blurb: "Photocopied grain, highlighter and tape.", chrome: "#f0efe9", swatches: ["#f0efe9", "#111111", "#ff3ea5", "#fff200", "#ffffff"], voice: "crisp", music: "under-the-lights" },
  { id: "broadcast", name: "Live Broadcast", blurb: "TV score bug, italic type and a ticker.", chrome: "#04161a", swatches: ["#04161a", "#1b3d43", "#2d5960", "#00e0c6", "#ff4b55"], voice: "crisp", music: "under-the-lights" },
  { id: "teletext", name: "Teletext Page 302", blurb: "Seven colours on black; answers on the remote's coloured buttons.", chrome: "#000000", swatches: ["#000000", "#0000ff", "#00ffff", "#ffff00", "#ff0000"], voice: "chip", music: "page-302" },
  { id: "shirt", name: "Shirt Fabric", blurb: "Claret mesh, stitched seams and a care-label question card.", chrome: "#6b1d33", swatches: ["#6b1d33", "#4a1022", "#9bc9e6", "#e8be5a", "#fbfaf5"], voice: "warm", music: "half-time" },
  { id: "pundit", name: "Pundit Stats", blurb: "Clean analytics look with one orange accent.", chrome: "#fbfbf9", swatches: ["#fbfbf9", "#0e0e0d", "#ececea", "#cfd0cb", "#ff5a1f"], voice: "crisp", music: "training-ground" },
];

export function getStyle(id: string | undefined): GameStyle {
  return STYLES.find((s) => s.id === id) ?? STYLES[0];
}
