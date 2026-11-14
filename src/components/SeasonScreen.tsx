// League season: the table, your next match (league or Cup), and the end-of-season verdict.

import { useEffect, useState } from "react";
import { ScreenHead } from "./Menus";
import { ClubPicker } from "./ClubPicker";
import { BOT_NAMES, botList, loadBots, type BotMeta } from "../game/bots";
import { clubShort } from "../game/clubs";
import {
  CUP_ROUNDS, DIVISIONS, PROMOTED, RELEGATED, YOU, cupWon, divisionOf, loadSeason, matchKey, newSeason, nextMatch, nextSeason, ordinal, saveSeason, table,
  type Season,
} from "../game/season";
import { STANDARD_POSITION } from "../game/chess960";
import { DEFAULT_MINUTES } from "../game/powerups";
import type { SetupChoice } from "../game/match";

const name = (id: string) => (id === YOU ? "You" : BOT_NAMES[id] ?? id);

/** The game to start for the match that's due. Season games are trivia, untimed, standard chess. */
export function seasonSetup(s: Season, bots: BotMeta[]): SetupChoice | null {
  const m = nextMatch(s);
  if (!m) return null;
  const opp = m.kind === "cup" ? m.tie.opponent : m.opponent;
  const color = m.kind === "cup" ? m.tie.color : m.color;
  const bot = bots.find((b) => b.id === opp);
  if (!bot) return null;
  const me = { name: "You", kind: "human" as const, club: s.club || null };
  const them = { name: bot.name, kind: "bot" as const, botId: bot.id, club: bot.club };
  return {
    options: { mode: "bot", trivia: true, timed: false, minutes: DEFAULT_MINUTES, chess960: false, position: STANDARD_POSITION, handicap: null },
    players: color === "white" ? { white: me, black: them } : { white: them, black: me },
    botLevel: "medium",
    season: { key: matchKey(s, m), kind: m.kind },
  };
}

export function SeasonScreen({ onStart, onBack }: { onStart: (s: SetupChoice) => void; onBack: () => void }) {
  const [season, setSeason] = useState<Season | null>(loadSeason);
  const [club, setClub] = useState("west-ham");
  const [bots, setBots] = useState<BotMeta[]>([]);
  const [failed, setFailed] = useState(false);
  const fetchBots = () => { setFailed(false); loadBots().then((m) => setBots(botList(m)), () => setFailed(true)); };
  useEffect(fetchBots, []);
  const update = (s: Season | null) => { saveSeason(s); setSeason(s); };

  if (!season) {
    return (
      <section className="setup season" aria-labelledby="season-title">
        <ScreenHead id="season-title" title="Season" onBack={onBack} />
        <p>Start in League Two and climb to the Premier League. Each division is a league against the ladder bots, and three Cup ties run alongside.</p>
        <ul className="season-rules">
          <li>Win 3 points, draw 1. The score is a goal per piece taken.</li>
          <li>Top {PROMOTED} go up, bottom {RELEGATED} goes down.</li>
          <li>Cup ties need a winner: a draw is a defeat.</li>
          <li>Every match has trivia on, with no clock.</li>
        </ul>
        <div className="field"><span>Your club</span><ClubPicker value={club} label="Your club" onChange={setClub} /></div>
        <button type="button" className="kickoff" onClick={() => update(newSeason(DIVISIONS[0].id, 1, club))}>Start the season</button>
      </section>
    );
  }

  const div = divisionOf(season.division);
  const rows = table(season);
  const m = nextMatch(season);
  const setup = seasonSetup(season, bots);
  const mine = season.weeks.map((w) => w.find((f) => f.home === YOU || f.away === YOU)).filter((f) => f?.score);
  const done = season.finished;
  const nextRound = season.cup.find((t) => !t.result);

  return (
    <section className="setup season" aria-labelledby="season-title">
      <ScreenHead id="season-title" title={`Season ${season.number} · ${div.name}`} onBack={onBack} />
      {failed && <p className="why" role="alert">Couldn't download the bots. Check your connection. <button type="button" className="ghost" onClick={fetchBots}>Try again</button></p>}

      {done ? (
        <div className="season-verdict">
          <b>{done.champions ? `${div.name} champions!` : `You finished ${ordinal(done.position)}`}</b>
          <span>
            {done.move === "up" ? `Promoted to the ${DIVISIONS[DIVISIONS.findIndex((d) => d.id === div.id) + 1].name}.`
              : done.move === "down" ? `Relegated to ${DIVISIONS[DIVISIONS.findIndex((d) => d.id === div.id) - 1].name}.`
                : `You stay in the ${div.name}.`}
            {cupWon(season) ? " And you won the Cup!" : ""}
          </span>
          <button type="button" className="kickoff" onClick={() => update(nextSeason(season))}>Start season {season.number + 1}</button>
        </div>
      ) : m && (
        <div className="next-match">
          <small>{m.kind === "cup" ? `Cup ${CUP_ROUNDS[m.tie.round]}` : `Matchweek ${season.week + 1} of ${season.weeks.length}`}</small>
          <b>vs {name(m.kind === "cup" ? m.tie.opponent : m.opponent)}</b>
          <span>You play {(m.kind === "cup" ? m.tie.color : m.color) === "white" ? "White" : "Black"}{season.club ? ` · ${clubShort(season.club)}` : ""}</span>
          <button type="button" className="kickoff" disabled={!setup} onClick={() => setup && onStart(setup)}>{setup ? "Kick off" : "Loading the bots…"}</button>
        </div>
      )}

      <h3>Table</h3>
      <table className="league">
        <thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.team} className={[r.team === YOU ? "you" : "", i < PROMOTED && div.id !== "premier-league" ? "up" : "", i >= rows.length - RELEGATED && div.id !== "league-two" ? "down" : ""].filter(Boolean).join(" ")}>
              <td>{i + 1}</td><td>{name(r.team)}</td><td>{r.played}</td><td>{r.won}</td><td>{r.drawn}</td><td>{r.lost}</td><td>{r.gf - r.ga > 0 ? "+" : ""}{r.gf - r.ga}</td><td><b>{r.points}</b></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Cup</h3>
      <ol className="cup-run">
        {CUP_ROUNDS.map((round, i) => {
          const t = season.cup[i];
          const text = !t ? (season.cupOut ? "Out" : "To come")
            : t.result ? `${t.result === "won" ? "Won" : "Lost"} ${t.score?.[0]}-${t.score?.[1]} vs ${name(t.opponent)}`
              : `vs ${name(t.opponent)}${t === nextRound ? ` · before matchweek ${season.cupBefore[i] + 1}` : ""}`;
          return <li key={round} className={t?.result ?? ""}><b>{round}</b><span>{text}</span></li>;
        })}
      </ol>

      {mine.length > 0 && (
        <>
          <h3>Your results</h3>
          <ul className="season-results">
            {mine.map((f, i) => {
              const home = f!.home === YOU;
              const [a, b] = f!.score!;
              const [me, them] = home ? [a, b] : [b, a];
              return <li key={i} className={me > them ? "won" : me < them ? "lost" : "drawn"}>{me}-{them} vs {name(home ? f!.away : f!.home)}</li>;
            })}
          </ul>
        </>
      )}

      <button type="button" className="ghost season-quit" onClick={() => { if (window.confirm("Give up this season and start again from League Two?")) update(null); }}>Abandon the season</button>
    </section>
  );
}
