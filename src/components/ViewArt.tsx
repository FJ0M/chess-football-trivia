// Little pictures for the two Pass and Play views in Settings.

import type { PassAndPlayView } from "../settings/settings";

/** A tiny 4x4 board drawn at (x, y), `s` wide, rotated `turn` degrees around its centre. */
function MiniBoard({ x, y, s, turn = 0 }: { x: number; y: number; s: number; turn?: number }) {
  const c = s / 4;
  const cells = [];
  for (let r = 0; r < 4; r++) for (let f = 0; f < 4; f++) if ((r + f) % 2) cells.push(<rect key={`${r}${f}`} x={x + f * c} y={y + r * c} width={c} height={c} fill="#5b8a4a" />);
  return (
    <g transform={`rotate(${turn} ${x + s / 2} ${y + s / 2})`}>
      <rect x={x} y={y} width={s} height={s} fill="#e9f0d8" />
      {cells}
      {/* A white pawn near the bottom so you can see which way the board faces. */}
      <circle cx={x + c * 1.5} cy={y + c * 3.2} r={c * 0.32} fill="#fff" stroke="#18304a" strokeWidth="0.8" />
    </g>
  );
}

function Person({ x, y, flip = false, shirt }: { x: number; y: number; flip?: boolean; shirt: string }) {
  // Seen from above: shoulders and a head, facing the middle of the picture.
  return (
    <g transform={flip ? `rotate(180 ${x} ${y})` : undefined}>
      <ellipse cx={x} cy={y + 5} rx="14" ry="5" fill={shirt} />
      <circle cx={x} cy={y} r="6" fill="#f1c9a5" stroke="#18304a" strokeWidth="0.8" />
    </g>
  );
}

function FlatOnTable() {
  return (
    <svg viewBox="0 0 120 100" aria-hidden="true">
      <rect x="18" y="20" width="84" height="60" rx="10" fill="#c99a63" stroke="#8a6438" strokeWidth="1.5" />
      <Person x={60} y={12} flip shirt="#7a263a" />
      <Person x={60} y={88} shirt="#1f5fbf" />
      {/* The phone lies flat in the middle, its screen turned to face the player at the top. */}
      <rect x="44" y="33" width="32" height="34" rx="4" fill="#18304a" />
      <MiniBoard x={48} y={38} s={24} turn={180} />
      {/* Arrows going round: the whole screen turns to face whoever is up. */}
      <path d="M37 42 A 24 24 0 0 1 81 37" fill="none" stroke="#ffd23f" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M81 37 l-6 -1 m6 1 l-1 6" stroke="#ffd23f" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M83 58 A 24 24 0 0 1 39 63" fill="none" stroke="#ffd23f" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M39 63 l6 1 m-6 -1 l1 -6" stroke="#ffd23f" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function PassThePhone() {
  return (
    <svg viewBox="0 -5 120 100" aria-hidden="true">
      {/* Two players side by side on a sofa, seen from the front. */}
      <rect x="6" y="62" width="108" height="20" rx="8" fill="#9aa9b4" />
      <g>
        <circle cx="26" cy="34" r="9" fill="#f1c9a5" stroke="#18304a" strokeWidth="0.8" />
        <path d="M12 70 Q12 46 26 46 Q40 46 40 70 Z" fill="#1f5fbf" />
      </g>
      <g>
        <circle cx="94" cy="34" r="9" fill="#f1c9a5" stroke="#18304a" strokeWidth="0.8" />
        <path d="M80 70 Q80 46 94 46 Q108 46 108 70 Z" fill="#7a263a" />
      </g>
      {/* The phone, upright, in the middle with its board. */}
      <rect x="49" y="38" width="22" height="34" rx="3.5" fill="#18304a" />
      <MiniBoard x={52} y={44} s={16} />
      {/* Arrow over the top: hand it over. */}
      <path d="M36 26 Q60 4 84 26" fill="none" stroke="#ffd23f" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M84 26 l-7 -1 m7 1 l-2 -6" stroke="#ffd23f" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export const VIEW_INFO: Record<PassAndPlayView, { name: string; blurb: string }> = {
  flip: { name: "Flat on the table", blurb: "Lay the device flat between you. The whole screen turns round to face whoever is up." },
  "hand-over": { name: "Pass the phone", blurb: "Hand the device over each turn. Only the board flips, so your pieces are always at the bottom." },
};

export function ViewArt({ view }: { view: PassAndPlayView }) {
  return view === "flip" ? <FlatOnTable /> : <PassThePhone />;
}
