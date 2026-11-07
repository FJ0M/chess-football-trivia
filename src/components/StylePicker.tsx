// The Look setting: a small board drawn in the chosen style's colours, with arrows to step through all ten styles.

import type { KeyboardEvent } from "react";
import { STYLES, type GameStyle, type StyleId } from "../theme/themes";

const PIECES: Record<number, string> = { 0: "♜", 3: "♚", 12: "♙", 15: "♔" };

/** A 4x4 corner of a board in the style's swatch colours. Every square is a true square. */
function MiniBoard({ style }: { style: GameStyle }) {
  const [light, a, b, c, d] = style.swatches;
  const dark = a === light ? b : a;
  return (
    <div className="mini-board" style={{ borderColor: c }} aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => {
        const r = Math.floor(i / 4), f = i % 4;
        return <i key={i} style={{ background: (r + f) % 2 ? dark : light, color: i < 8 ? c : d }}>{PIECES[i] ?? ""}</i>;
      })}
    </div>
  );
}

export function StylePicker({ value, defaultId, onChange }: { value: StyleId; defaultId: StyleId; onChange: (id: StyleId) => void }) {
  const idx = Math.max(0, STYLES.findIndex((s) => s.id === value));
  const s = STYLES[idx];
  const step = (d: number) => onChange(STYLES[(idx + d + STYLES.length) % STYLES.length].id);
  const keys = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
  };
  return (
    <div className="style-step" role="group" aria-label="Game style" onKeyDown={keys}>
      <button type="button" className="step-arrow" aria-label="Previous style" onClick={() => step(-1)}>‹</button>
      <div className="mid" aria-live="polite">
        <MiniBoard style={s} />
        <strong>{s.name}{s.id === defaultId && <em> Default</em>}</strong>
        <small>{s.blurb}</small>
        <div className="dots">
          {STYLES.map((t, i) => (
            <button key={t.id} type="button" className={i === idx ? "on" : ""} aria-label={t.name} aria-current={i === idx} onClick={() => onChange(t.id)} />
          ))}
        </div>
      </div>
      <button type="button" className="step-arrow" aria-label="Next style" onClick={() => step(1)}>›</button>
    </div>
  );
}
