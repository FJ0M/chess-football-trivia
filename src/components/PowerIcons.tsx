// Icons for power-ups and trivia hints: 24x24 line drawings in currentColor,
// so every visual style colours them through its own `.pw svg` rule.

import type { ReactNode } from "react";

const F = { fill: "currentColor", stroke: "none" } as const;

/** A pawn outline, used inside a few icons. */
const pawn = (x: number, y: number, s = 1) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <circle cx="0" cy="-7" r="3" />
    <path d="M-2.4 -3.6h4.8M-1.8 -3.6c0 3.4 -1.2 5 -3.4 6v1h10.4v-1c-2.2-1-3.4-2.6-3.4-6" />
  </g>
);

const ICONS: Record<string, ReactNode> = {
  // Stopwatch with a plus: added time.
  "fergie-time": (
    <>
      <circle cx="10" cy="13.5" r="6.5" />
      <path d="M8 3h4M10 3v4M10 13.5l2.5-2.5M15.5 6.5l1.5-1.5" />
      <path d="M20 14v6M17 17h6" />
    </>
  ),
  // A pawn with a snowflake: frozen for a turn.
  "tactical-foul": (
    <>
      {pawn(8, 14)}
      <path d="M18 4v8M14.5 6l7 4M21.5 6l-7 4" />
    </>
  ),
  // A bus parked across the goal.
  "park-the-bus": (
    <>
      <rect x="3" y="5" width="18" height="12" rx="2.5" />
      <path d="M3 11h18M8 5v6M13 5v6M18 5v6" />
      <circle cx="7.5" cy="18.5" r="1.6" style={F} />
      <circle cx="16.5" cy="18.5" r="1.6" style={F} />
    </>
  ),
  // A screen with a rewind arrow.
  "var-review": (
    <>
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M9 20h6M12 17v3" />
      <path d="M10 10.5a3 3 0 1 0 1-2.2M10.5 6v2.5H13" />
    </>
  ),
  // Two chevrons charging forward.
  "counter-attack": (
    <>
      <path d="M6 13l6-6 6 6M6 19l6-6 6 6" />
      <circle cx="12" cy="3.5" r="1.5" style={F} />
    </>
  ),
  // The fourth official's board: one arrow on, one off.
  substitution: (
    <>
      <path d="M8 20V5M4 9l4-4 4 4" />
      <path d="M16 4v15M12 15l4 4 4-4" />
    </>
  ),
  // A football boot.
  "golden-boot": (
    <>
      <path d="M5 3.5h5.5v6.5c3 .5 6.5 1.2 8.8 3 1.2.9 1.7 2 1.7 3.5H4c-.6 0-1-.4-1-1z" />
      <path d="M6 16.5v2.5M10 16.5v2.5M15 16.5v2.5M19 16.5v2.5M10.5 11.5l1.5-1.5M13 12l1.5-1.5" />
    </>
  ),
  // Two players swapping places.
  "formation-change": (
    <>
      <circle cx="6" cy="17" r="2.5" />
      <circle cx="18" cy="7" r="2.5" />
      <path d="M9.5 6.5h5M12.5 4.5l2 2-2 2M14.5 17.5h-5M11.5 15.5l-2 2 2 2" />
    </>
  ),
  // A red card, shown. Always red, whatever the style's accent, or it reads as a yellow card.
  "red-card": (
    <>
      <rect x="7" y="3" width="11" height="16" rx="1.5" transform="rotate(12 12.5 11)" style={{ fill: "#d62b2b", stroke: "none" }} />
    </>
  ),
  // A knight's head with a star: pawn upgraded to a knight.
  "super-sub": (
    <>
      <path d="M7 20h10M8 20c0-3 1-5 3-7l-3.5 1-1.5-2 4-5.5c1.5-1.5 4-1.5 5.5.5 1.5 2 2 5 1.5 8.5-.3 2-.5 3-.5 4.5" />
      <circle cx="12.5" cy="8.5" r=".9" style={F} />
      <path d="M19 2.5l.7 1.6 1.7.2-1.3 1.1.4 1.7-1.5-.9-1.5.9.4-1.7-1.3-1.1 1.7-.2z" style={F} />
    </>
  ),
  // Fast-forward: two moves in one turn.
  "extra-time": (
    <>
      <path d="M3 6l8 6-8 6zM12 6l8 6-8 6z" />
    </>
  ),
  // The linesman's chequered flag.
  "assistants-flag": (
    <>
      <path d="M6 21V3" />
      <path d="M6 4h12v9H6z" />
      <path d="M6 4h4v3H6zM14 4h4v3h-4zM10 7h4v3h-4zM6 10h4v3H6zM14 10h4v3h-4z" style={F} />
    </>
  ),
  // Binoculars.
  "scout-report": (
    <>
      <circle cx="6.5" cy="15" r="3.5" />
      <circle cx="17.5" cy="15" r="3.5" />
      <path d="M10 14.5h4M4 12.5l2-7h3l1 6M20 12.5l-2-7h-3l-1 6" />
    </>
  ),
  // A tactics clipboard with an arrow.
  "managers-tip": (
    <>
      <rect x="4.5" y="4" width="15" height="17" rx="2" />
      <path d="M9 2.5h6v3H9z" />
      <path d="M8 17c2-1 3-4 5-5.5s3-1 3-1M14 9.5l2 1-1 2" />
      <path d="M7.5 9.5l2 2M9.5 9.5l-2 2" />
    </>
  ),
  // A pawn with sparkles: the engine plays a masterclass for you.
  masterclass: (
    <>
      {pawn(9, 15)}
      <path d="M18 3l1 2.5L21.5 6.5 19 7.5 18 10l-1-2.5L14.5 6.5 17 5.5z" style={F} />
      <path d="M19.5 13v3M18 14.5h3" />
    </>
  ),
  // Trivia hints.
  "fifty-fifty": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18" />
      <path d="M12 3a9 9 0 0 1 0 18z" style={F} />
    </>
  ),
  "ask-the-crowd": (
    <>
      <circle cx="12" cy="8" r="2.5" />
      <circle cx="5" cy="10" r="2" />
      <circle cx="19" cy="10" r="2" />
      <path d="M7.5 18c0-3 2-5 4.5-5s4.5 2 4.5 5M1.5 17c0-2 1.5-3.5 3.5-3.5M22.5 17c0-2-1.5-3.5-3.5-3.5" />
    </>
  ),
  "phone-a-friend": (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M10.5 18.5h3M10 5h4" />
    </>
  ),
};

/** The generic icon for a power-up that has no drawing yet. */
const FALLBACK = <path d="M13 2L4 14h7l-1 8 9-12h-7z" />;

export function PowerIcon({ id, className }: { id: string; className?: string }): ReactNode {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {ICONS[id] ?? FALLBACK}
    </svg>
  );
}

export const POWER_ICON_IDS = Object.keys(ICONS);
