// Match animations, all drawn over the board or the game card and never in the way of a tap:
// a ball trail on each move, the net rippling on a capture, a Red Card flash, hat-trick
// confetti, Scorched Turf on a Hot Spot (a ring of fire and a burnt patch), a trophy lift on checkmate and the Elite Ball
// Knowledge celebration. Each shows for a short time after its event, then goes.
// None of them show when motion is off (the setting, or the phone's reduce-motion setting).

import type { CSSProperties, ReactNode } from "react";
import type { GameEvent } from "../game/match";
import type { Color } from "../game/types";
import { POWER_UP_BY_ID } from "../game/powerups";
import { PowerIcon } from "./PowerIcons";

const FILES = "abcdefgh";

/** How long each animation lasts, in ms. */
export const FX_MS: Partial<Record<GameEvent["kind"], number>> = {
  move: 650, power: 1300, answer: 2600, "hot-spot": 2800, checkmate: 4200, ebk: 3800,
};

/** Square centre in board units (0 to 8) as seen from `orientation`. */
function xy(sq: string, orientation: Color): [number, number] {
  const f = FILES.indexOf(sq[0]), r = Number(sq[1]) - 1;
  return orientation === "white" ? [f + 0.5, 7 - r + 0.5] : [7 - f + 0.5, r + 0.5];
}

const live = (e: GameEvent, now: number) => now - e.at < (FX_MS[e.kind] ?? 0);

/** Animations tied to squares: drawn inside the board. */
export function BoardFx({ events, now, orientation }: { events: GameEvent[]; now: number; orientation: Color }): ReactNode {
  const shown = events.filter((e) => live(e, now));
  if (!shown.length) return null;
  return (
    <div className="fx-board" aria-hidden="true">
      {shown.map((e) => {
        if (e.kind === "move") {
          const [x1, y1] = xy(e.from, orientation);
          const [x2, y2] = xy(e.to, orientation);
          const d = `M${x1} ${y1} L${x2} ${y2}`;
          return (
            <div key={e.id} className="fx-layer">
              <svg className="fx-trail" viewBox="0 0 8 8">
                <path d={d} pathLength={1} />
                <g className="fx-ball">
                  <animateMotion dur="0.42s" fill="freeze" path={d} calcMode="spline" keyTimes="0;1" keySplines=".3 0 .2 1" />
                  <Ball />
                </g>
              </svg>
              {e.captured && <span className="fx-net" style={at(e.to, orientation)} />}
            </div>
          );
        }
        if (e.kind === "power" && e.power === "red-card" && e.square) {
          return <span key={e.id} className="fx-card-sq" style={at(e.square, orientation)} />;
        }
        if (e.kind === "power" && e.square) {
          // Every other targeted power-up: a pulse on its square (both squares for a Formation Change).
          return (
            <div key={e.id} className="fx-layer">
              {[e.square, e.square2].filter((s): s is string => !!s).map((s) => (
                <span key={s} className={`fx-pulse fx-${e.power}`} style={at(s, orientation)} />
              ))}
            </div>
          );
        }
        if (e.kind === "hot-spot") {
          return (
            // Scorched Turf (Freddie's pick, 2026-11-08): a ring of fire races out from the square
            // and leaves a burnt patch of grass round the piece, with smoke curling off it.
            <div key={e.id} className="fx-scorch" style={at(e.square, orientation)}>
              <span className="burn" />
              <span className="fire-ring" />
              {Array.from({ length: 10 }, (_, i) => <span key={i} className="tongue" style={{ "--a": `${i * 36}deg` } as CSSProperties} />)}
              {[0, 1, 2].map((i) => <span key={i} className="wisp" style={{ left: `${30 + i * 18}%`, "--t": `${1.2 + i * 0.3}s`, "--x": `${(i - 1) * 40}%` } as CSSProperties} />)}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

/** Animations for the whole game card: Red Card flash, confetti, trophy, Elite Ball Knowledge. */
export function ScreenFx({ events, now, names }: { events: GameEvent[]; now: number; names: Record<Color, string> }): ReactNode {
  const shown = events.filter((e) => live(e, now));
  const items = shown.map((e) => {
    if (e.kind === "power" && e.power === "red-card") {
      return (
        <div key={e.id} className="fx-full fx-redcard">
          <div className="card" />
        </div>
      );
    }
    if (e.kind === "power") {
      // Every power-up gets its name stamped across the card, with its icon.
      return (
        <div key={e.id} className={`fx-full fx-power fx-${e.power}`}>
          <b className="fx-power-stamp"><PowerIcon id={e.power} className="fx-power-icon" />{POWER_UP_BY_ID[e.power].name}</b>
        </div>
      );
    }
    if (e.kind === "answer" && e.hatTrick) {
      return (
        <div key={e.id} className="fx-full fx-confetti">
          {Array.from({ length: 36 }, (_, i) => <i key={i} style={confetti(i)} />)}
          <b className="fx-banner">Hat-trick!</b>
        </div>
      );
    }
    if (e.kind === "checkmate") {
      return (
        <div key={e.id} className="fx-full fx-trophy">
          <Trophy />
          <b className="fx-banner">{names[e.winner]} lifts the trophy!</b>
        </div>
      );
    }
    if (e.kind === "ebk") {
      return (
        <div key={e.id} className="fx-full fx-ebk">
          <div className="ebk-stamp"><EbkBadge /><b>Elite Ball Knowledge</b><small>{names[e.color]} · 10 right in a row</small></div>
        </div>
      );
    }
    return null;
  }).filter(Boolean);
  return items.length ? <div className="fx-screen" aria-hidden="true">{items}</div> : null;
}

/** Positions an element over one square. */
function at(sq: string, orientation: Color): CSSProperties {
  const [x, y] = xy(sq, orientation);
  return { left: `${(x - 0.5) * 12.5}%`, top: `${(y - 0.5) * 12.5}%` };
}

const CONFETTI = ["#d1342f", "#1f5fbf", "#ffd23f", "#2e9d4f", "#ffffff", "#ff6ad5"];
function confetti(i: number): CSSProperties {
  // Spread evenly with a fixed pseudo-random jitter, so it's the same each render.
  const j = (k: number) => ((i * 9301 + k * 49297) % 233280) / 233280;
  return {
    left: `${(i / 36) * 100 + j(1) * 3}%`, background: CONFETTI[i % CONFETTI.length],
    animationDelay: `${Math.round(j(2) * 500)}ms`, animationDuration: `${1600 + Math.round(j(3) * 900)}ms`,
    "--spin": `${Math.round(j(4) * 720 - 360)}deg`, "--drift": `${Math.round(j(5) * 60 - 30)}px`,
  } as CSSProperties;
}

function Ball() {
  return (
    <g transform="scale(.021) translate(-12 -12)">
      <circle cx="12" cy="12" r="10" fill="#fff" stroke="#111" strokeWidth="1.5" />
      <path d="M12 7l4 3-1.5 4.5h-5L8 10z" fill="#111" />
    </g>
  );
}

function Trophy() {
  return (
    <svg className="trophy" viewBox="0 0 64 80">
      <path d="M18 6h28v14a14 14 0 0 1-28 0z" fill="#ffd23f" stroke="#a06d00" strokeWidth="2" />
      <path d="M18 10H8a10 10 0 0 0 12 14M46 10h10a10 10 0 0 1-12 14" fill="none" stroke="#a06d00" strokeWidth="3" />
      <path d="M28 34h8v12h-8z" fill="#e0a100" />
      <path d="M20 46h24l3 10H17z" fill="#ffd23f" stroke="#a06d00" strokeWidth="2" />
      <path d="M14 56h36v8H14z" fill="#5b3a22" />
      <path d="M24 12l4 8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity=".7" />
      <g className="sparkles" fill="#fff">
        <path d="M6 4l1.5 3.5L11 9 7.5 10.5 6 14l-1.5-3.5L1 9l3.5-1.5z" />
        <path d="M58 30l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" />
      </g>
    </svg>
  );
}

/** The Elite Ball Knowledge badge: a ball inside a laurel. Used on the player bar too. */
export function EbkBadge({ className = "ebk-badge" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" role="img" aria-label="Elite Ball Knowledge">
      <path d="M8 30C3 24 3 14 9 8M32 30c5-6 5-16-1-22" fill="none" stroke="#2e9d4f" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M6 22l-3-1M6 16l-3-2M9 11l-2-3M34 22l3-1M34 16l3-2M31 11l2-3" stroke="#2e9d4f" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="20" cy="20" r="11" fill="#fff" stroke="#111" strokeWidth="1.8" />
      <path d="M20 14l5 3.6-1.9 5.6h-6.2L15 17.6z" fill="#111" />
      <path d="M12 34h16" stroke="#ffd23f" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
