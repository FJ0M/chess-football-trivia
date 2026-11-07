// The main menu, the high scores page and the in-game pause menu.

import { useState } from "react";
import { loadScores, resetScores } from "../game/scores";

const LEVEL = { low: "Easy", medium: "Medium", hard: "Hard" } as Record<string, string>;
const BOT = { ollie: "Ollie", ryan: "Ryan", freddie: "Freddie" } as Record<string, string>;

export function MainMenu({ onPlay, onSettings, onScores, onRules }: { onPlay: (mode: "bot" | "local") => void; onSettings: () => void; onScores: () => void; onRules: () => void }) {
  return (
    <nav className="menu" aria-label="Main menu">
      <div className="menu-title">
        <img className="menu-logo" src={`${import.meta.env.BASE_URL}icons/logo.svg`} alt="" width="72" height="72" />
        <span className="kicker">The manager's whiteboard</span>
        <h1>Chess Football Trivia</h1>
        <p>Play chess, answer football questions, spend your Form on power-ups.</p>
      </div>
      <button type="button" className="menu-btn primary" onClick={() => onPlay("bot")}><b>Play a bot</b><small>Freddie, Ryan or Ollie</small></button>
      <button type="button" className="menu-btn" onClick={() => onPlay("local")}><b>Pass and Play</b><small>Two players, one device</small></button>
      <button type="button" className="menu-btn" onClick={onScores}><b>High scores</b><small>Your record against each bot</small></button>
      <button type="button" className="menu-btn" onClick={onRules}><b>How to play</b><small>Triggers, Form and power-ups</small></button>
      <button type="button" className="menu-btn" onClick={onSettings}><b>Settings</b><small>Style, sound and music</small></button>
    </nav>
  );
}

export function ScoresScreen({ onBack }: { onBack: () => void }) {
  const [scores, setScores] = useState(loadScores);
  const bots = Object.entries(scores.bots).sort(([a], [b]) => a.localeCompare(b));
  const local = Object.entries(scores.local).sort(([, a], [, b]) => b - a);
  return (
    <section className="setup scores" aria-labelledby="scores-title">
      <h1 id="scores-title">High scores</h1>
      <h3>vs bots</h3>
      {bots.length ? (
        <table>
          <thead><tr><th>Bot</th><th>P</th><th>W</th><th>D</th><th>L</th><th>Best run</th></tr></thead>
          <tbody>
            {bots.map(([k, r]) => {
              const [id, level] = k.split(":");
              return <tr key={k}><td>{BOT[id] ?? id} · {LEVEL[level] ?? level}</td><td>{r.played}</td><td>{r.won}</td><td>{r.drawn}</td><td>{r.lost}</td><td>{r.best}</td></tr>;
            })}
          </tbody>
        </table>
      ) : <p className="muted">No games against the bots yet.</p>}
      <h3>Pass and Play wins</h3>
      {local.length ? <ol>{local.map(([n, w]) => <li key={n}>{n}: {w}</li>)}</ol> : <p className="muted">No Pass and Play games yet.</p>}
      <div className="row-btns">
        <button type="button" className="ghost" onClick={onBack}>Back</button>
        <button type="button" className="ghost" onClick={() => { resetScores(); setScores(loadScores()); }}>Reset</button>
      </div>
    </section>
  );
}

export function RulesScreen({ onBack }: { onBack: () => void }) {
  return (
    <section className="setup rules" aria-labelledby="rules-title">
      <h1 id="rules-title">How to play</h1>
      <p>It's chess, and your moves are always free. Some moves bring up a football question for the player who made them:</p>
      <ul>
        <li><b>Hot Spot</b> (circled square): a Club Bonus Round on your club, double Form. After you claim one, Hot Spots rest for 4 of your moves.</li>
        <li><b>Capture</b>: pick one of three cards.</li>
        <li><b>Kick-off</b>: every 4th move with no other question.</li>
      </ul>
      <p>Each card shows a topic and a difficulty. Harder pays more, but costs more if you're wrong:</p>
      <ul>
        <li>Tap-in (easy): +1 Form, no risk.</li>
        <li>Highlight (medium): +2 Form. Wrong and your opponent gets +2.</li>
        <li>Screamer (hard): +3 Form. Wrong and the piece you moved is booked (frozen) next turn.</li>
        <li>Puskás (a Screamer you upgrade): +5 Form in 8 seconds, no hints. Wrong and you're sent off: you miss a turn and your opponent takes a Free Kick.</li>
      </ul>
      <p>Answer a Screamer or Puskás within 5 seconds for +1, and get three in a row for a hat-trick (+2). If you're behind on material, every right answer earns +1 more. Form is capped at 12.</p>
      <p><b>Power-ups</b> cost Form, one per turn before you move. Each has a cooldown and starts the game locked, and its stars show roughly how much it can swing the board. <b>Hints</b> during a question: 50:50, Ask the Crowd, Phone a friend.</p>
      <p><b>Promotion</b> is a "Who am I?": five clues about a footballer, one guess. Right on clue 1 earns a queen, clue 2 a rook, clue 3 a bishop, later a knight. Wrong: a knight, and your opponent gets +2 Form.</p>
      <p>Checkmate wins. Any draw goes to a Penalty Shootout of five questions each.</p>
      <button type="button" className="ghost" onClick={onBack}>Back</button>
    </section>
  );
}

export function PauseMenu({ onResume, onRestart, onSettings, onQuit }: { onResume: () => void; onRestart: () => void; onSettings: () => void; onQuit: () => void }) {
  return (
    <div className="sheet-backdrop" onClick={onResume}>
      <section className="sheet pause" role="dialog" aria-modal="true" aria-labelledby="pause-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="pause-title">Paused</h2>
        <button type="button" className="menu-btn primary" onClick={onResume}><b>Resume</b></button>
        <button type="button" className="menu-btn" onClick={onRestart}><b>Restart</b><small>Same opponent and rules</small></button>
        <button type="button" className="menu-btn" onClick={onSettings}><b>Settings</b></button>
        <button type="button" className="menu-btn" onClick={onQuit}><b>Quit to menu</b></button>
      </section>
    </div>
  );
}
