// How to play: short, picture-first rules on the whiteboard.

import { useState } from "react";
import { FORM_CAP, POWER_UPS } from "../game/powerups";
import { PowerIcon } from "./PowerIcons";
import { ScreenHead } from "./Menus";

/** A row of Form pips, filled up to n. */
function Pips({ n, of = 5, tone = "on" }: { n: number; of?: number; tone?: "on" | "bad" }) {
  return <span className="htp-pips" aria-label={`${n} Form`}>{Array.from({ length: of }, (_, i) => <i key={i} className={i < n ? tone : ""} />)}</span>;
}

const LEVELS: { name: string; form: number; risk: string; card?: "yellow" | "red"; tag: string }[] = [
  { name: "Tap-in", form: 1, risk: "No risk", tag: "Easy" },
  { name: "Highlight", form: 2, risk: "Opponent +2", tag: "Medium" },
  { name: "Screamer", form: 3, risk: "Piece booked", card: "yellow", tag: "Hard" },
  { name: "Puskás", form: 5, risk: "Sent off", card: "red", tag: "8 sec" },
];

const PROMO: [string, string, string][] = [["1–2", "♛", "Queen"], ["3", "♜", "Rook"], ["4", "♝", "Bishop"], ["5", "♞", "Knight"]];

export function RulesScreen({ onBack }: { onBack: () => void }) {
  const [pick, setPick] = useState<string | null>(null);
  const picked = POWER_UPS.find((p) => p.id === pick);
  return (
    <section className="setup rules htp" aria-labelledby="rules-title">
      <ScreenHead id="rules-title" title="How to play" onBack={onBack} />

      <ol className="htp-flow" aria-label="A turn">
        <li><span className="htp-big">♞</span><b>Move</b><small>Normal chess</small></li>
        <li><span className="htp-big htp-q">?</span><b>Answer</b><small>Some moves ask a question</small></li>
        <li><span className="htp-big"><PowerIcon id="golden-boot" className="htp-ic" /></span><b>Spend</b><small>Right answers earn Form</small></li>
      </ol>

      <h3>What asks a question</h3>
      <div className="htp-tiles three">
        <div className="htp-tile"><span className="htp-sq hot" aria-hidden="true"><i /></span><b>Hot Spot</b><small>Land on a circled square: pick one of 3 cards</small></div>
        <div className="htp-tile"><span className="htp-sq cap" aria-hidden="true">✕</span><b>Capture</b><small>Take a piece: pick one of 3 cards</small></div>
        <div className="htp-tile"><span className="htp-sq ko" aria-hidden="true">4</span><b>Kick-off</b><small>Every 4th quiet move</small></div>
      </div>

      <h3>Pick a card: harder pays more</h3>
      <div className="htp-levels">
        {LEVELS.map((l) => (
          <div key={l.name} className="htp-level">
            <div><b>{l.name}</b><small>{l.tag}</small></div>
            <Pips n={l.form} />
            <span className="htp-risk">{l.card && <i className={`htp-card ${l.card}`} aria-hidden="true" />}{l.risk}</span>
          </div>
        ))}
      </div>
      <p className="htp-note">Wrong on a Puskás: you miss a turn and they take a Free Kick.</p>

      <h3>Bonus Form</h3>
      <div className="htp-chips">
        <span><b>+1</b> hard answer in 5 sec</span>
        <span><b>+2</b> hat-trick: 3 right in a row</span>
        <span><b>+1</b> each right answer while behind</span>
        <span><b>{FORM_CAP}</b> Form max</span>
      </div>

      <h3>Power-ups</h3>
      <p className="htp-note">Spend Form before you move, one a turn. The green number is the cost. Each starts locked, then has a cooldown after use.</p>
      <div className="htp-powers">
        {POWER_UPS.map((p) => (
          <button key={p.id} type="button" className={`htp-power${pick === p.id ? " on" : ""}`} aria-expanded={pick === p.id} aria-controls="htp-power-detail" onClick={() => setPick(pick === p.id ? null : p.id)}>
            <PowerIcon id={p.id} className={`htp-ic${p.id === "red-card" ? " red" : ""}`} />
            <small>{p.name}</small>
            <em>{p.cost}</em>
          </button>
        ))}
      </div>
      {picked ? (
        <div className="htp-detail" id="htp-power-detail" role="status">
          <PowerIcon id={picked.id} className={`htp-ic big${picked.id === "red-card" ? " red" : ""}`} />
          <div>
            <b>{picked.name}</b>
            <p>{picked.effect}.</p>
            {picked.rule && <small>{picked.rule}.</small>}
            <span className="htp-facts"><span>{picked.cost} Form</span><span>Then rests for {picked.cooldown} of your moves</span>{picked.timedOnly && <span>Timed games only</span>}</span>
          </div>
          <button type="button" className="htp-close" aria-label="Close" onClick={() => setPick(null)}>×</button>
        </div>
      ) : <p className="htp-note htp-tap" id="htp-power-detail">Tap a power-up to see what it does.</p>}
      <h3>Promotion: Who am I?</h3>
      <p className="htp-note">Five clues about a footballer. Guess sooner, get a better piece.</p>
      <div className="htp-promo">
        {PROMO.map(([clue, piece, name]) => (
          <div key={name}><small>Clue {clue}</small><span className="htp-piece">{piece}</span><b>{name}</b></div>
        ))}
      </div>
      <p className="htp-note">Wrong guess: a knight, and your opponent gets +2.</p>

      <h3>Full time</h3>
      <div className="htp-tiles three">
        <div className="htp-tile"><span className="htp-big">♚</span><b>Checkmate</b><small>Wins the game</small></div>
        <div className="htp-tile"><span className="htp-big">⚽</span><b>Draw</b><small>Penalty shootout: 5 questions each</small></div>
        <div className="htp-tile"><span className="htp-big htp-clock">+3s</span><b>Timed</b><small>Clock runs during questions. +3s a move</small></div>
      </div>

      <button type="button" className="ghost" onClick={onBack}>Back to Play</button>
    </section>
  );
}
