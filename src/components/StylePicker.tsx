// The Look setting: a small preview drawn in the chosen style (board, capture highlight and question text), with arrows to step through all ten styles.

import type { KeyboardEvent } from "react";
import { STYLES, type GameStyle, type StyleId } from "../theme/themes";
import { MarkerArrow } from "./GameScreen";

// A capture has just happened: the white knight took a pawn, b1 to c3.
const SCENE: Array<Array<[string, "w" | "b"] | null>> = [
  [["♜", "b"], null, null, ["♚", "b"]],
  [null, ["♟", "b"], ["♞", "w"], null],
  [null, null, null, null],
  [["♙", "w"], ["♘", "w"], null, ["♔", "w"]],
];
const FILES = "abcd";
const LAST = ["b1", "c3"];
const SAMPLE_Q = "Who scored West Ham's winner in the 2023 Conference League final?";

/**
 * A tiny game screen in the style itself: a 4x4 corner of the board with the capture just played
 * (last-move squares, plus the marker arrow on Tactics Board, the only style that draws one) and a sample question.
 * It uses the real style CSS, so fonts, pieces and highlights match the game. Every square is a fixed square.
 */
function StylePreview({ style }: { style: GameStyle }) {
  return (
    <div className={`screen style-${style.id} style-preview`} aria-hidden="true">
      <div className="board">
        {SCENE.map((row, r) => row.map((p, f) => {
          const sq = FILES[f] + (4 - r);
          // Same colouring as the real board: a1 is dark.
          const light = (r + f) % 2 === 0;
          return (
            <span key={sq} className={`sq${light ? " l" : ""}${LAST.includes(sq) ? " last" : ""}`}>
              {p && <span className={`pc ${p[1]}`}>{p[0]}{"\uFE0E"}</span>}
            </span>
          );
        }))}
        {style.id === "tactics" && <MarkerArrow from={LAST[0]} to={LAST[1]} orientation="white" color="#fff7a8" id="preview-ah" n={4} />}
      </div>
      <div className="quiz">
        <div className="meta"><span>Capture · Highlight</span></div>
        <p className="q">{SAMPLE_Q}</p>
      </div>
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
        <StylePreview style={s} />
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
