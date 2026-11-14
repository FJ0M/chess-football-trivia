// The main menu, the high scores page and the in-game pause menu.

import { useState, type ReactNode } from "react";
import { loadScores, resetScores } from "../game/scores";
import { TRIVIA_WEIGHT, TRIVIA_BASE, loadTriviaRating, resetTriviaRating, triviaTitle } from "../game/triviaElo";
import { clearHistory, loadHistory, resultKind, resultText, type HistoryEntry } from "../game/history";
import type { Color } from "../game/types";
import { BOT_NAMES, LADDER_BOT_IDS } from "../game/bots";

const LEVEL = { low: "Easy", medium: "Medium", hard: "Hard" } as Record<string, string>;
const BOT = BOT_NAMES;
/** "· Hard" after a bot's name, or nothing for a ladder bot (one level only). */
const levelTag = (id: string | undefined, level: string | undefined) =>
  level && !(id && LADDER_BOT_IDS.includes(id)) ? ` · ${LEVEL[level] ?? level}` : "";

type IconName = "play" | "cup" | "cog" | "bot" | "pass" | "book" | "resume" | "restart" | "exit";
const ICONS: Record<IconName, string> = {
  play: "M8 5v14l11-7z",
  cup: "M7 4h10v5a5 5 0 0 1-10 0z M7 6H4v1a3 3 0 0 0 3 3 M17 6h3v1a3 3 0 0 1-3 3 M12 14v3 M8 20h8 M9.5 17h5",
  cog: "M12 8.8a3.2 3.2 0 1 0 0 6.4a3.2 3.2 0 1 0 0-6.4 M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8",
  bot: "M6 9h12v10H6z M9 13h.01 M15 13h.01 M10 16h4 M12 9V5 M10 5h4",
  pass: "M5 7h11l-3-3 M19 17H8l3 3",
  book: "M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z M5 17a3 3 0 0 1 3-3h9",
  resume: "M8 5v14l11-7z",
  restart: "M5 12a7 7 0 1 0 2-5 M5 4v4h4",
  exit: "M14 5h5v14h-5 M10 8l-4 4 4 4 M6 12h10",
};

/** A marker-drawn icon in a round magnet, as on the manager's whiteboard. */
export function Magnet({ icon }: { icon: IconName }) {
  return (
    <span className="mag" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d={ICONS[icon]} /></svg>
    </span>
  );
}

/** One whiteboard menu button: magnet, marker title and a short line under it. Primary gets a red magnet. */
export function MenuButton({ icon, title, sub, primary, onClick }: { icon: IconName; title: string; sub?: string; primary?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`menu-btn${primary ? " primary" : ""}`} onClick={onClick}>
      <Magnet icon={icon} />
      <span><b>{title}</b>{sub && <small>{sub}</small>}</span>
    </button>
  );
}

/** Faded marker drawings (arrows, crosses, magnets) behind the main menu. */
function Doodles() {
  return (
    <svg className="doodles" viewBox="0 0 300 600" preserveAspectRatio="xMidYMid slice" fill="none" strokeLinecap="round" strokeWidth="3" aria-hidden="true">
      <path d="M40 470 C 80 380, 150 400, 170 330" stroke="#1f5fbf" strokeDasharray="8 8" /><path d="M162 340 l9-12 4 15" stroke="#1f5fbf" />
      <path d="M250 520 C 230 450, 270 420, 240 360" stroke="#d1342f" /><path d="M234 372 l6-14 10 11" stroke="#d1342f" />
      <path d="M30 60 l14 14 M44 60 l-14 14 M250 90 l14 14 M264 90 l-14 14 M60 560 l14 14 M74 560 l-14 14" stroke="#d1342f" />
      <circle cx="240" cy="40" r="9" stroke="#1f5fbf" /><circle cx="40" cy="300" r="9" stroke="#1f5fbf" /><circle cx="270" cy="250" r="9" stroke="#1f5fbf" />
    </svg>
  );
}

export const GAME_NAME = "They Think It's Checkmate\u2026";

export function MainMenu({ onPlay, onAchievements, onSettings, resume }: {
  onPlay: () => void; onAchievements: () => void; onSettings: () => void;
  /** A match saved before the page reloaded. */
  resume?: { label: string; onResume: () => void };
}) {
  return (
    <nav className="menu main-menu" aria-label="Main menu">
      <Doodles />
      <div className="menu-title">
        <img className="menu-logo" src={`${import.meta.env.BASE_URL}icons/logo.svg`} alt="" width="104" height="104" />
        <h1>{GAME_NAME}</h1>
        <p>Chess, football trivia, and power-ups</p>
      </div>
      <div className="menu-btns">
        {resume && <MenuButton icon="resume" title="Resume match" sub={resume.label} primary onClick={resume.onResume} />}
        <MenuButton icon="play" title="Play" sub="vs bots or a mate" primary={!resume} onClick={onPlay} />
        <MenuButton icon="cup" title="Achievements" sub="Trophies, records, and history" onClick={onAchievements} />
        <MenuButton icon="cog" title="Settings" sub="Look, sound, and music" onClick={onSettings} />
      </div>
    </nav>
  );
}

/** Heading row used by every menu screen: Back, then the marker title. */
export function ScreenHead({ id, title, onBack }: { id: string; title: string; onBack: () => void }) {
  return <div className="setup-head"><button type="button" className="ghost back" onClick={onBack}>Back</button><h1 id={id}>{title}</h1></div>;
}

export function PlayMenu({ onPick, onRules, onBack }: { onPick: (mode: "bot" | "local") => void; onRules: () => void; onBack: () => void }) {
  return (
    <nav className="setup play-menu" aria-labelledby="play-title">
      <ScreenHead id="play-title" title="Play" onBack={onBack} />
      <div className="menu-btns">
        <MenuButton icon="bot" title="Play a bot" sub="Seven bots, from 400 to 1600 Elo" primary onClick={() => onPick("bot")} />
        <MenuButton icon="pass" title="Pass and Play" sub="Two players, one device" onClick={() => onPick("local")} />
        <MenuButton icon="book" title="How to play" sub="Triggers, Form, and power-ups" onClick={onRules} />
      </div>
    </nav>
  );
}

export type AchievementsTab = "cabinet" | "scores" | "history";
const TABS: [AchievementsTab, string][] = [["cabinet", "Trophies"], ["scores", "High scores"], ["history", "History"]];

/** Heading for the Achievements screens: Back, title and the three tabs. */
export function AchievementsHead({ tab, onTab, onBack }: { tab: AchievementsTab; onTab: (t: AchievementsTab) => void; onBack: () => void }) {
  return (
    <>
      <ScreenHead id="achievements-title" title="Achievements" onBack={onBack} />
      <div className="seg tabs" role="tablist" aria-label="Achievements">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => onTab(id)}>{label}</button>
        ))}
      </div>
    </>
  );
}

export function ScoresScreen({ onBack, head }: { onBack: () => void; head?: ReactNode }) {
  const [scores, setScores] = useState(loadScores);
  const [trivia, setTrivia] = useState(loadTriviaRating);
  const bots = Object.entries(scores.bots).sort(([a], [b]) => a.localeCompare(b));
  const best = scores.best;
  const local = Object.entries(scores.local).sort(([, a], [, b]) => b - a);
  return (
    <section className="setup scores" aria-labelledby={head ? "achievements-title" : "scores-title"}>
      {head ?? <ScreenHead id="scores-title" title="High scores" onBack={onBack} />}
      <div className="score-cards">
        <div className="score-card">
          <small>Best win</small>
          {best ? (
            <>
              <b>{best.match}</b>
              <span>{BOT[best.botId] ?? best.botId}{levelTag(best.botId, best.level)}</span>
              <small>Chess {best.chess} · Trivia {best.triviaElo}</small>
              {best.assisted && <small className="assisted" title="You used Manager's Tip or VAR Review in this win">Assisted</small>}
            </>
          ) : <span>Beat a bot to set one</span>}
        </div>
        <div className="score-card">
          <small>Your trivia Elo</small>
          <b>{trivia.rating}</b>
          <span>{trivia.answers ? triviaTitle(trivia.rating) : "Answer questions against a bot"}</span>
          <small>{trivia.answers} question{trivia.answers === 1 ? "" : "s"} answered</small>
        </div>
      </div>
      <p className="muted">The high score is the highest combined rating you've beaten: the bot's chess Elo, plus {TRIVIA_WEIGHT} × how far its trivia Elo is above or below an average quizzer ({TRIVIA_BASE}). Chess counts for more because it decides more games.</p>
      <h3>vs bots</h3>
      {bots.length ? (
        <table>
          <thead><tr><th>Bot</th><th>P</th><th>W</th><th>D</th><th>L</th><th>Best run</th></tr></thead>
          <tbody>
            {bots.map(([k, r]) => {
              const [id, level] = k.split(":");
              return <tr key={k}><td>{BOT[id] ?? id}{levelTag(id, level)}</td><td>{r.played}</td><td>{r.won}</td><td>{r.drawn}</td><td>{r.lost}</td><td>{r.best}</td></tr>;
            })}
          </tbody>
        </table>
      ) : <p className="muted">No games against the bots yet.</p>}
      <h3>Pass and Play wins</h3>
      {local.length ? <ol>{local.map(([n, w]) => <li key={n}>{n}: {w}</li>)}</ol> : <p className="muted">No Pass and Play games yet.</p>}
      <div className="row-btns">
        <button type="button" className="ghost" onClick={() => { resetScores(); resetTriviaRating(); setScores(loadScores()); setTrivia(loadTriviaRating()); }}>Reset</button>
      </div>
    </section>
  );
}

const BADGE = { won: "W", lost: "L", drawn: "D", decided: "FT" } as const;
const pct = (r: number, a: number) => (a ? ` (${Math.round((100 * r) / a)}%)` : "");

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" })}, ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
}

function HistoryRow({ e }: { e: HistoryEntry }) {
  const kind = resultKind(e);
  const them: Color | undefined = e.you ? (e.you === "white" ? "black" : "white") : undefined;
  const title = e.you && them ? `vs ${e.names[them]}${levelTag(e.botId, e.botLevel)}` : `${e.names.white} v ${e.names.black}`;
  const facts = [resultText(e), `${e.moves} move${e.moves === 1 ? "" : "s"}`, e.you ? `played ${e.you === "white" ? "White" : "Black"}` : "", e.chess960 ? "Chess960" : "", e.assisted ? "assisted (Manager's Tip or VAR)" : ""].filter(Boolean);
  const tally = (c: Color) => `${e.quiz[c].right}/${e.quiz[c].asked}`;
  let numbers: string;
  if (!e.trivia) numbers = "Plain chess, no trivia";
  else if (e.you) numbers = `Form earned +${e.formEarned[e.you]} · Trivia ${tally(e.you)}${pct(e.quiz[e.you].right, e.quiz[e.you].asked)}`;
  else numbers = `Form earned ${e.names.white} +${e.formEarned.white}, ${e.names.black} +${e.formEarned.black} · Trivia ${e.names.white} ${tally("white")}, ${e.names.black} ${tally("black")}`;
  return (
    <li className={`hist hist-${kind}`}>
      <span className="hist-badge" aria-hidden="true">{BADGE[kind]}</span>
      <div className="hist-body">
        <div className="hist-top"><b>{title}</b><time dateTime={e.at}>{when(e.at)}</time></div>
        <span>{facts.join(" · ")}</span>
        <small>{numbers}</small>
      </div>
    </li>
  );
}

export function HistoryScreen({ onBack, head }: { onBack: () => void; head?: ReactNode }) {
  const [list, setList] = useState(loadHistory);
  const [confirm, setConfirm] = useState(false);
  const bot = list.filter((e) => e.you);
  const record = { won: bot.filter((e) => resultKind(e) === "won").length, drawn: bot.filter((e) => resultKind(e) === "drawn").length, lost: bot.filter((e) => resultKind(e) === "lost").length };
  return (
    <section className="setup history" aria-labelledby={head ? "achievements-title" : "history-title"}>
      {head ?? <ScreenHead id="history-title" title="Game history" onBack={onBack} />}
      {list.length ? (
        <>
          <p className="muted">{list.length} game{list.length === 1 ? "" : "s"}{bot.length ? ` · vs bots: won ${record.won}, drawn ${record.drawn}, lost ${record.lost}` : ""}</p>
          <ol className="hist-list">{list.map((e, i) => <HistoryRow key={`${e.at}-${i}`} e={e} />)}</ol>
        </>
      ) : <p className="muted">No finished games yet. Play one and it shows up here.</p>}
      <div className="row-btns">
        {list.length > 0 && (confirm ? (
          <>
            <span className="muted">Clear all {list.length}?</span>
            <button type="button" className="ghost" onClick={() => { clearHistory(); setList([]); setConfirm(false); }}>Yes, clear</button>
            <button type="button" className="ghost" onClick={() => setConfirm(false)}>No</button>
          </>
        ) : <button type="button" className="ghost" onClick={() => setConfirm(true)}>Clear history</button>)}
      </div>
    </section>
  );
}

export function PauseMenu({ onResume, onRestart, onSettings, onQuit }: { onResume: () => void; onRestart: () => void; onSettings: () => void; onQuit: () => void }) {
  return (
    <div className="sheet-backdrop" onClick={onResume}>
      <section className="sheet pause" role="dialog" aria-modal="true" aria-labelledby="pause-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="pause-title">Paused</h2>
        <MenuButton icon="resume" title="Resume" primary onClick={onResume} />
        <MenuButton icon="restart" title="Restart" sub="Same opponent and rules" onClick={onRestart} />
        <MenuButton icon="cog" title="Settings" onClick={onSettings} />
        <MenuButton icon="exit" title="Quit to menu" onClick={onQuit} />
      </section>
    </div>
  );
}
