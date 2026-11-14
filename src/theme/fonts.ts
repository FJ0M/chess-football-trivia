// Web fonts, loaded per look instead of all twenty families up front. The menus use the
// Tactics Board fonts and the stadium clock uses VT323, so those always load; each look
// adds its own, and the Look picker in Settings loads the rest so its previews are right.

import type { StyleId } from "./themes";

const ALWAYS = ["Kalam:wght@400;700", "Permanent+Marker", "VT323"];

export const STYLE_FONTS: Record<StyleId, string[]> = {
  tactics: [],
  floodlit: ["Saira+Condensed:wght@700;800", "Saira:wght@400;600"],
  programme: ["Alfa+Slab+One", "Libre+Franklin:wght@400;600;800"],
  sticker: ["Anton", "Nunito:wght@600;800"],
  tabletop: ["Archivo+Black", "Archivo:wght@400;600"],
  fanzine: ["Rubik+Mono+One", "Special+Elite"],
  broadcast: ["Barlow+Condensed:ital,wght@0,600;1,800", "Barlow:wght@400;600"],
  teletext: [],
  shirt: ["Teko:wght@500;600", "Hind:wght@400;600"],
  pundit: ["Familjen+Grotesk:wght@400;600;700", "IBM+Plex+Mono:wght@400;500"],
};

const loaded = new Set<string>();

/** Adds a Google Fonts stylesheet for any of these families not already requested. */
function request(families: string[]): void {
  const fresh = families.filter((f) => !loaded.has(f));
  if (!fresh.length || typeof document === "undefined") return;
  fresh.forEach((f) => loaded.add(f));
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${fresh.map((f) => `family=${f}`).join("&")}&display=swap`;
  document.head.appendChild(link);
}

/** The fonts for the menus, the clock and one look. */
export function loadStyleFonts(id: StyleId): void {
  request([...ALWAYS, ...STYLE_FONTS[id]]);
}

/** Every look's fonts (for the Look picker's previews). */
export function loadAllFonts(): void {
  request([...ALWAYS, ...Object.values(STYLE_FONTS).flat()]);
}
