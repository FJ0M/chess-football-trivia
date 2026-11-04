// Pick a mode, opponent, clubs and the game toggles before kick-off.

import { useEffect, useState } from "react";
import { CLUBS, DIVISIONS } from "../game/clubs";
import { backRank, randomPosition, STANDARD_POSITION } from "../game/chess960";
import { botList, loadBots, type BotLevel, type BotMeta } from "../game/bots";
import type { SetupChoice } from "../game/useGame";
import type { Color } from "../game/types";

interface Saved {
  mode: "bot" | "local";
  botId: string;
  botLevel: BotLevel;
  side: Color | "random";
  names: [string, string];
  clubs: [string, string];
  trivia: boolean;
  timed: boolean;
  chess960: boolean;
}

const KEY = "cft.setup.v1";
const DEFAULTS: Saved = {
  mode: "bot", botId: "ryan", botLevel: "medium", side: "white", names: ["You", "Player 2"], clubs: ["west-ham", "brighton"],
  trivia: true, timed: false, chess960: false,
};

function loadSaved(): Saved {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return { ...DEFAULTS, ...(raw && typeof raw === "object" ? raw : {}) };
  } catch { return DEFAULTS; }
}

export function SetupScreen({ mode, onStart, onBack }: { mode: "bot" | "local"; onStart: (s: SetupChoice) => void; onBack: () => void }) {
  const [s, setS] = useState<Saved>(() => ({ ...loadSaved(), mode }));
  const [bots, setBots] = useState<BotMeta[]>([]);
  const [position, setPosition] = useState(() => randomPosition());
  const set = <K extends keyof Saved>(k: K, v: Saved[K]) => setS((o) => ({ ...o, [k]: v }));

  useEffect(() => { loadBots().then((m) => setBots(botList(m))); }, []);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } }, [s]);

  const bot = bots.find((b) => b.id === s.botId) ?? bots[0];

  function start() {
    const side: Color = s.side === "random" ? (Math.random() < 0.5 ? "white" : "black") : s.side;
    const options = { mode: s.mode, trivia: s.trivia, timed: s.timed, chess960: s.chess960, position: s.chess960 ? position : STANDARD_POSITION };
    const human = (i: 0 | 1) => ({ name: s.names[i].trim() || `Player ${i + 1}`, kind: "human" as const, club: s.clubs[i] || null });
    let players: SetupChoice["players"];
    if (s.mode === "bot" && bot) {
      const b = { name: bot.name, kind: "bot" as const, botId: bot.id, club: bot.club };
      players = side === "white" ? { white: human(0), black: b } : { white: b, black: human(0) };
    } else {
      players = { white: human(0), black: human(1) };
    }
    onStart({ options, players, botLevel: s.botLevel });
  }

  const clubSelect = (i: 0 | 1) => (
    <select value={s.clubs[i]} onChange={(e) => set("clubs", (i === 0 ? [e.target.value, s.clubs[1]] : [s.clubs[0], e.target.value]) as [string, string])} aria-label={`${s.names[i] || "Player"}'s club`}>
      <option value="">No club (general questions only)</option>
      {DIVISIONS.map((d) => (
        <optgroup key={d} label={d}>
          {CLUBS.filter((c) => c.division === d).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </optgroup>
      ))}
    </select>
  );

  return (
    <section className="setup" aria-labelledby="setup-title">
      <div className="setup-head"><button type="button" className="ghost" onClick={onBack}>Back</button><h1 id="setup-title">{s.mode === "bot" ? "Play a bot" : "Pass and Play"}</h1></div>

      <div className="seg" role="radiogroup" aria-label="Mode">
        <button type="button" role="radio" aria-checked={s.mode === "bot"} className={s.mode === "bot" ? "on" : ""} onClick={() => set("mode", "bot")}>vs Bot</button>
        <button type="button" role="radio" aria-checked={s.mode === "local"} className={s.mode === "local" ? "on" : ""} onClick={() => set("mode", "local")}>Pass and Play</button>
      </div>

      {s.mode === "bot" ? (
        <>
          <h3>Opponent</h3>
          <div className="bot-list" role="radiogroup" aria-label="Opponent">
            {bots.map((b) => (
              <button key={b.id} type="button" role="radio" aria-checked={s.botId === b.id} className={`bot-card${s.botId === b.id ? " on" : ""}`} onClick={() => set("botId", b.id)}>
                <span className="badge">{b.name[0]}</span>
                <strong>{b.name}</strong>
                <small>{b.blurb}</small>
              </button>
            ))}
          </div>
          <div className="seg small" role="radiogroup" aria-label="Bot level">
            {(["low", "medium", "hard"] as BotLevel[]).map((l) => (
              <button key={l} type="button" role="radio" aria-checked={s.botLevel === l} className={s.botLevel === l ? "on" : ""} onClick={() => set("botLevel", l)}>
                {l === "low" ? "Easy" : l === "medium" ? "Medium" : "Hard"}
              </button>
            ))}
          </div>
          <h3>You</h3>
          <label className="field"><span>Your club</span>{clubSelect(0)}</label>
          <div className="seg small" role="radiogroup" aria-label="Your colour">
            {(["white", "black", "random"] as const).map((c) => (
              <button key={c} type="button" role="radio" aria-checked={s.side === c} className={s.side === c ? "on" : ""} onClick={() => set("side", c)}>
                {c === "white" ? "White" : c === "black" ? "Black" : "Random"}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          {([0, 1] as const).map((i) => (
            <div key={i} className="player-setup">
              <h3>{i === 0 ? "White" : "Black"}</h3>
              <label className="field"><span>Name</span>
                <input value={s.names[i]} maxLength={16} onChange={(e) => set("names", (i === 0 ? [e.target.value, s.names[1]] : [s.names[0], e.target.value]) as [string, string])} />
              </label>
              <label className="field"><span>Club</span>{clubSelect(i)}</label>
            </div>
          ))}
        </>
      )}

      <h3>Rules</h3>
      <label className="switch"><input type="checkbox" checked={s.trivia} onChange={(e) => set("trivia", e.target.checked)} /><span>Football trivia <small>Off = plain chess</small></span></label>
      <label className="switch"><input type="checkbox" checked={s.timed} onChange={(e) => set("timed", e.target.checked)} /><span>Timed <small>10 minutes each</small></span></label>
      <label className="switch"><input type="checkbox" checked={s.chess960} onChange={(e) => set("chess960", e.target.checked)} /><span>Chess960 <small>Random back rank</small></span></label>
      {s.chess960 && (
        <div className="c960">
          <span>Position {position}: <b>{backRank(position).split("").join(" ")}</b></span>
          <button type="button" className="ghost" onClick={() => setPosition(randomPosition())}>Reroll</button>
        </div>
      )}

      <button type="button" className="kickoff" onClick={start} disabled={s.mode === "bot" && !bot}>Kick off</button>
    </section>
  );
}
