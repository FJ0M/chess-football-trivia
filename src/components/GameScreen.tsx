// A style preview of the game screen: board, trivia card and power-up bar.
// Pieces can be moved freely (no chess rules yet) so every style and sound can be
// tried. The real game logic replaces the board state in milestone 1.

import { useState, type ReactNode } from "react";
import type { GameStyle } from "../theme/themes";
import type { SfxName } from "../audio/sfx";
import { PREVIEW_QUESTIONS } from "./previewQuestions";

const START = ["r..q.rk.", "pp..bppp", "..np.n..", "..p.p...", "..B.P...", "..NP.N..", "PPP..PPP", "R.BQ.RK."];
const GLYPH: Record<string, string> = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
const SPOT = "d5";

const POWERS = [
  { id: "var", name: "VAR Review", cost: 3, icon: <><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M8 20h8M12 16v4M10 8l4 2-4 2z" /></> },
  { id: "foul", name: "Tactical Foul", cost: 3, icon: <><rect x="7" y="3" width="10" height="15" rx="1.5" transform="rotate(12 12 10.5)" /><path d="M5 21h7" /></> },
  { id: "sub", name: "Super-Sub", cost: 6, icon: <path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5" /> },
  { id: "bus", name: "Park the Bus", cost: 3, icon: <><rect x="3" y="5" width="18" height="11" rx="2" /><path d="M3 10.5h18M8 5v5.5M16 5v5.5" /><circle cx="7.5" cy="18.5" r="1.5" /><circle cx="16.5" cy="18.5" r="1.5" /></> },
];

const STRIPS: Record<string, string[]> = {
  tactics: ["Training ground · set piece #3", "Mon"],
  floodlit: ["Matchday · 19:45 KO", "Live"],
  programme: ["Matchday Programme · No. 14", "50p"],
  sticker: ["Season 25/26", "Sticker 214 of 640"],
  tabletop: ["Table football edition", "Wooden board"],
  fanzine: ["Issue 3 · One pound", "Not official"],
  broadcast: ["Live", "Ryan 1 – 0 Ollie", "62'"],
  teletext: ["P302", "FOOTBALL"],
  shirt: ["Home shirt", "25/26"],
  pundit: ["Match 014 · Ryan v Ollie", "Move 11"],
};

const name = (r: number, c: number) => "abcdefgh"[c] + (8 - r);
const isWhite = (ch: string) => ch !== "." && ch === ch.toUpperCase();

interface Props {
  style: GameStyle;
  play: (s: SfxName) => void;
}

export function GameScreen({ style, play }: Props) {
  const [board, setBoard] = useState(() => START.map((r) => r.split("")));
  const [sel, setSel] = useState<[number, number] | null>(null);
  const [last, setLast] = useState<[string, string]>(["d7", "d6"]);
  const [form, setForm] = useState(5);
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [note, setNote] = useState("Tap a white piece, then a square");

  const q = PREVIEW_QUESTIONS[qi % PREVIEW_QUESTIONS.length];

  function tapSquare(r: number, c: number) {
    const ch = board[r][c];
    if (!sel) {
      if (isWhite(ch)) { setSel([r, c]); play("select"); }
      return;
    }
    const [sr, sc] = sel;
    if (sr === r && sc === c) { setSel(null); return; }
    if (isWhite(ch)) { setSel([r, c]); play("select"); return; }
    const next = board.map((row) => [...row]);
    next[r][c] = next[sr][sc];
    next[sr][sc] = ".";
    setBoard(next);
    setSel(null);
    setLast([name(sr, sc), name(r, c)]);
    const target = name(r, c);
    if (ch.toLowerCase() === "k") { play("fulltime"); setNote("Full time! (no rules yet, so kings can be taken)"); }
    else if (ch !== ".") { play("capture"); setNote("Capture"); }
    else if (target === SPOT) { play("kickoff"); setNote("Penalty spot: new question"); nextQuestion(); }
    else play("move");
  }

  function nextQuestion() {
    setQi((i) => i + 1);
    setPicked(null);
  }

  function answer(k: number) {
    if (picked !== null) { nextQuestion(); return; }
    setPicked(k);
    if (k === q.answer) {
      play("correct");
      setTimeout(() => play("form"), 320);
      setTimeout(() => play("cheer"), 500);
      setForm((f) => Math.min(12, f + q.reward));
      setNote(`Right! +${q.reward} Form. Tap any answer for the next question`);
    } else {
      play("wrong");
      setTimeout(() => play("groan"), 400);
      setForm((f) => Math.max(0, f - q.penalty));
      setNote(`Wrong, it was ${q.options[q.answer]}. Tap any answer for the next question`);
    }
  }

  function usePower(cost: number, label: string) {
    if (cost > form) { play("locked"); setNote(`${label} needs ${cost} Form`); return; }
    setForm((f) => f - cost);
    play("powerup");
    setNote(`${label} used`);
  }

  const strip = STRIPS[style.id] ?? [];
  const lastFrom = last[0], lastTo = last[1];

  return (
    <div className={`screen style-${style.id}`}>
      <div className="strip">{strip.map((t) => <span key={t}>{t}</span>)}</div>
      {style.id === "teletext" && <div className="banner">FOOTBALL  QUIZ</div>}
      <Player badge="O" who="Ollie" tag="Bot · trivia whizz" form={2} />
      <div className="board" role="grid" aria-label="Chess board">
        {board.map((row, r) => row.map((ch, c) => {
          const n = name(r, c);
          const cls = ["sq", (r + c) % 2 === 0 ? "l" : "", n === lastFrom || n === lastTo ? "last" : "", sel && sel[0] === r && sel[1] === c ? "sel" : "", n === SPOT ? "spot" : ""].join(" ");
          return (
            <button key={n} type="button" className={cls} onClick={() => tapSquare(r, c)} aria-label={`${n}${ch !== "." ? " " + ch : ""}`}>
              {ch !== "." && <span className={`pc ${isWhite(ch) ? "w" : "b"}`}>{GLYPH[ch.toLowerCase()]}{"︎"}</span>}
            </button>
          );
        }))}
        {style.id === "tactics" && <MarkerArrow from={lastFrom} to={lastTo} />}
      </div>
      <Player badge="R" who="Ryan" tag="You" form={form} />
      <div className="quiz">
        <div className="meta"><span>{q.topic} · {q.difficulty}</span><span>+{q.reward} Form / −{q.penalty}</span></div>
        <p className="q">{q.question}</p>
        <div className="timer" key={qi} />
        <div className="answers">
          {q.options.map((o, k) => (
            <button key={o} type="button" onClick={() => answer(k)} className={picked === null ? "" : k === q.answer ? "right" : k === picked ? "wrong" : "dim"}>
              <b>{"ABCD"[k]}</b><span>{o}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="powers">
        {POWERS.map((p) => (
          <button key={p.id} type="button" className={`pw${p.cost > form ? " locked" : ""}`} onClick={() => usePower(p.cost, p.name)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">{p.icon}</svg>
            <span>{p.name}</span>
            <span className="cost">{p.cost} Form</span>
          </button>
        ))}
      </div>
      {style.id === "broadcast" && <div className="ticker"><b>LIVE</b> · {note}</div>}
      {style.id !== "broadcast" && <p className="hint" aria-live="polite">{note}</p>}
    </div>
  );
}

function Player({ badge, who, tag, form }: { badge: string; who: string; tag: string; form: number }): ReactNode {
  return (
    <div className="player">
      <div className="who"><span className="badge">{badge}</span><span>{who} <span className="tag">{tag}</span></span></div>
      <span className="form">Form {form}</span>
    </div>
  );
}

function MarkerArrow({ from, to }: { from: string; to: string }) {
  const xy = (sq: string) => ["abcdefgh".indexOf(sq[0]) + 0.5, 8 - Number(sq[1]) + 0.5];
  const [x1, y1] = xy(from);
  const [x2, y2] = xy(to);
  // Stop short of the target square's centre and bow the line like a hand-drawn arrow.
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ex = x2 - ((x2 - x1) / len) * 0.3, ey = y2 - ((y2 - y1) / len) * 0.3;
  const mx = (x1 + ex) / 2 + ((ey - y1) / len) * 0.4, my = (y1 + ey) / 2 - ((ex - x1) / len) * 0.4;
  return (
    <svg className="arrow" viewBox="0 0 8 8" aria-hidden="true">
      <defs>
        <marker id="ah" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto">
          <path d="M0 0L10 5L0 10z" fill="#fff7a8" />
        </marker>
      </defs>
      <path d={`M${x1} ${y1} Q ${mx} ${my} ${ex} ${ey}`} fill="none" stroke="#fff7a8" strokeWidth=".12" strokeLinecap="round" strokeDasharray=".25 .14" markerEnd="url(#ah)" />
    </svg>
  );
}
