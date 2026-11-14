// The game: board, players, the question / Who am I? / result panel, and the power-up bar.
// Class names (.board, .sq, .pc, .quiz, .powers, .pw, .player) are the ones every
// style in themes.css dresses up.

import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { GameStyle } from "../theme/themes";
import type { SfxName } from "../audio/sfx";
import type { PassAndPlayView } from "../settings/settings";
import { useGame } from "../game/useGame";
import { cardLabel, clockOwner, savable, RESULT_MS, RESULT_MS_HUMAN, type Phase, type SetupChoice } from "../game/match";
import { FORM_CAP, POWER_UPS, POWER_UP_BY_ID, fergieMs, fmtSeconds, type PowerUpDef } from "../game/powerups";
import {
  SET_PIECE_EVERY, PROMO_ORDER, PUSKAS_MISS_FORM, REWARD, promotionChoices, promotionStalemates, comebackShift, destsFor, isPromotion, pieceAt, powerBlocked, powerCost, powerTargets, resolveMove, turnOf, WHO_AM_I_PIECES, ROLE_NAME,
} from "../game/rules";
import { clubShort } from "../game/clubs";
import { PowerIcon } from "./PowerIcons";
import { ODDS_NAME } from "../game/handicap";
import { useMatchStats } from "../game/useMatchStats";
import { DRAW_WORDS, type MatchStats } from "../game/history";
import { saveMatch, type SavedMatch } from "../game/savedMatch";
import { CLUE_MS } from "../game/whoami";
import { TIMER_MS } from "../game/trivia";
import type { Color, GameState, Outcome, PowerUpId } from "../game/types";
import { material, type BenchRole } from "../game/material";
import { useCommentary } from "../game/useCommentary";
import { BoardFx, EbkBadge, ScreenFx } from "./MatchFx";

const GLYPH: Record<string, string> = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
const FILES = "abcdefgh";

interface Props {
  style: GameStyle;
  play: (s: SfxName) => void;
  setup: SetupChoice;
  view: PassAndPlayView;
  /** Animations on (off with the Reduce motion setting or the phone's own setting). */
  motion?: boolean;
  /** The commentator's ticker under the board. */
  commentary?: boolean;
  paused: boolean;
  onPause: () => void;
  onExit: () => void;
  /** Label for the button on the full-time panel (default "New game"). */
  exitLabel?: string;
  onFinish: (game: GameState, stats: MatchStats) => void;
  /** A saved match to carry on with. */
  resume?: SavedMatch;
}

export function GameScreen({ style, play, setup, view, motion = true, commentary = true, paused, onPause, onExit, exitLabel, onFinish, resume }: Props) {
  const g = useGame(setup, play, paused, resume?.game);
  const { game, phase } = g;
  // The clocks change the game state 5 times a second. Everything that only depends on the
  // position (legal moves, power-up targets, prices) works from this copy, which only changes
  // when something other than a clock does.
  const board0 = useStableGame(game);
  const stats = useMatchStats(board0, phase, resume?.stats);
  const latest = useRef({ game, phase });
  latest.current = { game, phase };
  // Save the match after every finished turn, so a reload doesn't lose it.
  useEffect(() => {
    const save = savable({ game, phase });
    if (save) saveMatch(setup, save, stats.current);
  }, [game.fen, game.step, game.outcome, phase.kind]); // eslint-disable-line react-hooks/exhaustive-deps
  // Leaving the app (a call, a text, the home screen) pauses the match, clocks and bots included.
  useEffect(() => {
    const hide = () => {
      if (!document.hidden) return;
      onPause();
      // Save the clocks as they are now too, not just as they were at the start of the turn.
      const save = savable(latest.current, true);
      if (save) saveMatch(setup, save, stats.current);
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", hide);
    return () => { document.removeEventListener("visibilitychange", hide); window.removeEventListener("pagehide", hide); };
  }, [onPause]);
  const [sel, setSel] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"resign" | "draw" | null>(null);

  const turn = turnOf(game);
  const active: Color = "color" in phase ? phase.color : phase.kind === "shootout" ? phase.taker : turn;
  const humans = (["white", "black"] as Color[]).filter((c) => game.players[c].kind === "human");
  const local = game.options.mode === "local";
  // "Flat on the table" turns the whole card round for Black, so the board inside is drawn from Black's side:
  // after the 180° turn the pieces stay where they sit on the table and only the screen faces the other way.
  // "Pass the phone" just draws the board from the side of whoever is up.
  const orientation: Color = local ? active : humans[0] ?? "white";
  /** "Flat on the table": the whole game turns 180 degrees for Black, so the board and every card face them. */
  const flipAll = local && view === "flip" && active === "black";
  const humanToAct = game.players[active].kind === "human";
  // In "Flat on the table" the layout is symmetric about the board (app.css, .flip-mode): equal space on
  // each side, each scrolling on its own. Turning the screen 180 degrees then leaves the board exactly
  // where it was, so it never jumps between turns and the page scroll never has to change.

  const dests = useMemo(() => (phase.kind === "move" && humanToAct ? destsFor(board0) : new Map<string, string[]>()), [board0, phase.kind, humanToAct]);
  const targets = useMemo(() => {
    if (phase.kind !== "target") return new Set<string>();
    return new Set(powerTargets(board0, phase.power, phase.first));
  }, [board0, phase]);

  function tap(sq: string) {
    if (phase.kind === "target") { g.tapTarget(sq); return; }
    if (phase.kind !== "move" || !humanToAct) return;
    const piece = pieceAt(game.fen, sq);
    if (sel && dests.get(sel)?.includes(sq)) {
      // The "Who am I?" decides the real piece, so any promotion the rules allow will do
      // (during Extra Time or a Free Kick a queen might give check where a knight doesn't).
      const uci = isPromotion(game, sel, sq) ? (["q", "r", "b", "n"].map((r) => sel + sq + r).find((u) => resolveMove(game, u)) ?? sel + sq + "q") : sel + sq;
      setSel(null);
      g.move(uci);
      return;
    }
    if (piece && piece.color === turn && dests.has(sq)) { setSel(sq); play("select"); return; }
    if (piece && piece.color === turn) {
      const frozen = game.frozen.some((f) => f.square === sq);
      play("locked");
      if (frozen) setSelNote("That piece is frozen this turn");
    }
    setSel(null);
  }
  const [selNote, setSelNote] = useState<string | null>(null);
  useEffect(() => { setSelNote(null); }, [game, phase]);
  useEffect(() => { if (game.outcome) onFinish(game, stats.current); }, [game.outcome]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = orientation === "white" ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const cols = orientation === "white" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const board = boardArray(game.fen);
  const last = game.lastMove;
  const top: Color = orientation === "white" ? "black" : "white";
  const bottom: Color = orientation;
  const mat = material(game.captured);
  const names = { white: callName(game, "white"), black: callName(game, "black") };
  const line = useCommentary(board0, g.events, commentary && phase.kind !== "whoami", names, g.evaluate);
  const osReduce = usePrefersReducedMotion();
  const fx = motion && !osReduce;
  // The piece that just moved slides in from where it came from (squares across and down, as drawn).
  const slide = useMemo(() => {
    if (!fx || !game.lastMove) return null;
    const [from, to] = game.lastMove;
    const sign = orientation === "white" ? 1 : -1;
    const dx = (FILES.indexOf(from[0]) - FILES.indexOf(to[0])) * sign;
    const dy = (Number(to[1]) - Number(from[1])) * sign;
    return dx || dy ? ({ "--dx": dx, "--dy": dy } as CSSProperties) : null;
  }, [game.lastMove, orientation, fx]);
  const flipMode = local && view === "flip";
  // The screen never scrolls, so where there's only one column (phones and tablets held upright, and
  // "Flat on the table") questions, cards and results sit over the board instead of pushing it off the
  // screen (it isn't playable then anyway). With a second column beside the board they go there.
  const twoColumns = useMedia(TWO_COLUMNS);
  const [peek, setPeek] = useState(false);
  useEffect(() => { setPeek(false); }, [phase.kind]);
  const panelOnBoard = (flipMode || !twoColumns) && (phase.kind === "cards" || phase.kind === "question" || phase.kind === "result" || phase.kind === "shootout");
  const commentaryLine = line && <p className="commentary" aria-live="polite"><Mic /><span key={line.id}>{line.text}</span></p>;

  return (
    <div className={`screen style-${style.id}${flipMode ? " flip-mode" : ""}${flipAll ? " flip-all" : ""}`}>
      {/* The two sides of the board. They only become boxes of their own in "Flat on the table";
          everywhere else they're display: contents, so the layout is the same as without them. */}
      <div className="side far">
        <div className="strip">
          <span>{game.options.chess960 ? `Chess960 · No. ${game.options.position}` : game.options.trivia ? <><em className="wide-only">Football </em>trivia</> : "Plain chess"}</span>
          <Scoreline game={game} score={mat.goals} />
          <span>Move {Math.ceil((game.history.length + 1) / 2)}</span>
        </div>
        {/* Flat on the table: the commentary sits on the far side, where there's room, facing the player who's waiting. */}
        {flipMode && commentaryLine}
        <PlayerBar game={game} color={top} active={active} ticking={clockOwner(game, phase)} bubble={g.bubble} bench={mat.bench[top]} lead={mat.score[top] - mat.score[bottom]} ebk={g.ebk[top]} />
      </div>
      {/* The board takes whatever height is left; .board-wrap is a size container, so the board is the
          largest square that fits in it. Questions and the "Who am I?" are drawn in the same space. */}
      <div className="board-wrap">
        {/* During a "Who am I?" the board is hidden (and the clocks stop): it's just the footballer. */}
        {phase.kind === "whoami" && <div className="whoami-stage"><Panel g={g} phase={phase} game={game} humanToAct={humanToAct} onExit={onExit} exitLabel={exitLabel} /></div>}
        <div className="board" role="grid" aria-label="Chess board" hidden={phase.kind === "whoami"}>
          {rows.map((r) => cols.map((c) => {
            const sq = FILES[c] + (r + 1);
            const p = board[r][c];
            const cls = [
              "sq", (r + c) % 2 === 1 ? "l" : "",
              last && (last[0] === sq || last[1] === sq) ? "last" : "",
              sel === sq ? "sel" : "",
              game.hotSpots.includes(sq) ? "hot" : "",
              game.frozen.some((f) => f.square === sq) ? "frozen" : "",
              targets.has(sq) ? "target" : "",
              phase.kind === "target" && phase.first === sq ? "sel" : "",
              g.overlay.attacked?.includes(sq) ? "flagged" : "",
              g.overlay.scout === sq ? "scout" : "",
            ].join(" ");
            const isDest = !!sel && !!dests.get(sel)?.includes(sq);
            // Coordinates sit inside the edge squares: files along the bottom row, ranks up the left column.
            const fileMark = r === rows[7] ? FILES[c] : null;
            const rankMark = c === cols[0] ? String(r + 1) : null;
            return (
              <button key={sq} type="button" className={cls} onClick={() => tap(sq)} aria-label={`${sq}${p ? ` ${p.color} ${ROLE_NAME[p.role]}` : ""}`}>
                {game.hotSpots.includes(sq) && <HotSpotIcon />}
                {p && <span className={`pc ${p.color === "white" ? "w" : "b"}${slide && last && last[1] === sq ? " slide" : ""}`} style={slide && last && last[1] === sq ? slide : undefined}>{GLYPH[p.role]}{"︎"}</span>}
                {isDest && <span className={p ? "dot cap" : "dot"} />}
                {rankMark && <span className="coord rank" aria-hidden="true">{rankMark}</span>}
                {fileMark && <span className="coord file" aria-hidden="true">{fileMark}</span>}
                {g.overlay.scout === sq && <span className="scout-tag" aria-hidden="true"><ScoutEye /></span>}
              </button>
            );
          }))}
          {/* No last-move arrow while a Scout Report is showing, so the only marking is the scouted piece. */}
          {style.id === "tactics" && last && !g.overlay.scout && <MarkerArrow from={last[0]} to={last[1]} orientation={orientation} color="#fff7a8" id="ah" />}
          {g.overlay.tip && <MarkerArrow from={g.overlay.tip[0]} to={g.overlay.tip[1]} orientation={orientation} color="#ff2d95" id="tip" outline />}
          {fx && <BoardFx events={g.events} now={g.now} orientation={orientation} />}
        </div>
        {/* After a Hot Spot the cards wait a moment, so the Scorched Turf animation shows before they cover the board. */}
        {panelOnBoard && (
          <div className={`board-cover${fx && phase.kind === "cards" && phase.bonus ? " late" : ""}${peek ? " peek" : ""}`}>
            {!peek && <Panel g={g} phase={phase} game={game} humanToAct={humanToAct} onExit={onExit} exitLabel={exitLabel} />}
            {/* The card choice depends on the position (a wrong Screamer freezes the piece you moved), so you can look first. */}
            {phase.kind === "cards" && humanToAct && (
              <button type="button" className="peek-btn" aria-pressed={peek} onClick={() => setPeek((v) => !v)}>
                {peek ? "Back to the cards" : "See the board"}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="side near">
        <PlayerBar game={game} color={bottom} active={active} ticking={clockOwner(game, phase)} bubble={g.bubble} bench={mat.bench[bottom]} lead={mat.score[bottom] - mat.score[top]} ebk={g.ebk[bottom]} />

        <div className="controls">
          {!flipMode && commentaryLine}
          {phase.kind !== "whoami" && !panelOnBoard && <Panel g={g} phase={phase} game={game} humanToAct={humanToAct} onExit={onExit} exitLabel={exitLabel} />}
          {game.options.trivia && phase.kind !== "over" && phase.kind !== "shootout" && phase.kind !== "whoami" && (
            <PowerBar game={board0} phase={phase} color={local ? active : humans[0] ?? turn} enabled={humanToAct && phase.kind === "move"} onPick={g.choosePower} play={play} />
          )}
          {style.id === "broadcast" ? <div className="ticker"><b>LIVE</b> · {selNote ?? g.note}</div> : <p className="hint" aria-live="polite">{selNote ?? g.note}</p>}
          {phase.kind !== "over" && (
            <div className="game-actions">
              {confirm ? (
                <>
                  <span>{confirm === "resign" ? "Resign this game?" : "Both agree a draw?"}</span>
                  <button type="button" onClick={() => { if (confirm === "resign") g.resign(humans.length === 1 ? humans[0] : turn); else g.agreeDraw(); setConfirm(null); }}>Yes</button>
                  <button type="button" onClick={() => setConfirm(null)}>No</button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => setConfirm("resign")}>Resign</button>
                  {local && <button type="button" onClick={() => setConfirm("draw")}>Offer draw</button>}
                  <button type="button" onClick={onPause}>Menu</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      {fx && <ScreenFx events={g.events} now={g.now} names={names} />}
    </div>
  );
}

function boardArray(fen: string): Array<Array<{ role: string; color: Color } | null>> {
  const rows = fen.split(" ")[0].split("/");
  const out: Array<Array<{ role: string; color: Color } | null>> = [];
  for (let i = 0; i < 8; i++) {
    const row: Array<{ role: string; color: Color } | null> = [];
    for (const ch of rows[7 - i]) {
      if (/\d/.test(ch)) for (let k = 0; k < Number(ch); k++) row.push(null);
      else row.push({ role: ch.toLowerCase(), color: ch === ch.toUpperCase() ? "white" : "black" });
    }
    out.push(row);
  }
  return out;
}

/** Pass and Play handicap, shown on each player's bar: "Gave a knight" / "x1.5 Form". */
function handicapTag(game: GameState, color: Color): string {
  const h = game.options.mode === "local" ? game.options.handicap : null;
  if (!h) return "";
  if (h.weaker === color) return h.formBoost !== 1 && game.options.trivia ? `x${h.formBoost} Form` : "";
  return h.odds !== "none" ? `Gave ${h.odds === "p" ? "a pawn" : `a ${ODDS_NAME[h.odds].toLowerCase()}`}` : "";
}

function PlayerBar({ game, color, active, ticking, bubble, bench, lead, ebk }: {
  game: GameState; color: Color; active: Color; ticking: Color | null; bubble: { color: Color; text: string } | null; bench: BenchRole[]; lead: number; ebk: boolean;
}): ReactNode {
  const p = game.players[color];
  const status = [
    p.wrongStreak >= 2 ? "Yellow card" : "",
    p.goldenBootMoves > 0 ? `Golden Boot (${p.goldenBootMoves})` : "",
    handicapTag(game, color),
  ].filter(Boolean);
  return (
    <div className={`player${active === color ? " up" : ""}`}>
      <div className="who">
        <span className="badge">{p.name[0]?.toUpperCase()}</span>
        <span className="who-text">
          <span>{p.name}{ebk && <EbkBadge className="ebk-mini" />} <span className="tag">{color === "white" ? "White" : "Black"} · {clubShort(p.club)}{p.kind === "bot" ? " · Bot" : ""}{status.length ? ` · ${status.join(", ")}` : ""}</span></span>
          {/* The bench: the opponent's pieces this player has taken (they're the other colour). */}
          <span className="bench" aria-label={bench.length ? `Taken: ${bench.map((r) => ROLE_NAME[r]).join(", ")}` : "Nothing taken yet"}>
            {bench.map((r, i) => <span key={i} className={`bp ${color === "white" ? "b" : "w"}`}>{GLYPH[r]}{"︎"}</span>)}
            {lead > 0 && <b className="lead">+{lead}</b>}
          </span>
        </span>
      </div>
      {bubble?.color === color && <span className="bubble" role="status">{bubble.text}</span>}
      <span className="form">
        {game.options.trivia && <>Form {p.form}</>}
        {p.clockMs !== null && <StadiumClock ms={p.clockMs} running={ticking === color && !game.outcome} />}
      </span>
    </div>
  );
}

/** "3-1" in the strip: the points of the pieces each side has taken, White (home) first. */
function Scoreline({ game, score }: { game: GameState; score: Record<Color, number> }) {
  const w = abbr(game.players.white.name), b0 = abbr(game.players.black.name);
  const b = b0 === w ? abbr(game.players.black.name, true) : b0;
  return (
    <span className="scoreline" aria-label={`Score (a goal per piece taken): ${game.players.white.name} ${score.white}, ${game.players.black.name} ${score.black}`}>
      <span>{w}</span><b>{score.white}-{score.black}</b><span>{b}</span>
    </span>
  );
}

/** A TV-style three-letter name: "Ryan" is RYA. Two players with the same start get initials and digits ("Player 1" is P1). */
function abbr(name: string, alt = false): string {
  const clean = name.trim() || "?";
  if (alt || /\d$/.test(clean)) return (clean[0] + (clean.match(/\d+$/)?.[0] ?? clean.slice(-1))).toUpperCase();
  return clean.replace(/\s+/g, "").slice(0, 3).toUpperCase();
}

/** The name the commentator uses: "You" reads oddly in third person, so it's your club instead. */
function callName(game: GameState, c: Color): string {
  const p = game.players[c];
  if (p.name.trim().toLowerCase() !== "you") return p.name;
  return p.club ? clubShort(p.club) : c === "white" ? "White" : "Black";
}

/** Wide enough for a second column beside the board (matches the landscape layout in app.css). */
const TWO_COLUMNS = "(orientation: landscape) and (min-width: 560px)";

function useMedia(query: string): boolean {
  const media = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query) : null);
  const [on, setOn] = useState(() => !!media()?.matches);
  useEffect(() => {
    const q = media();
    if (!q) return;
    const change = () => setOn(q.matches);
    change();
    q.addEventListener?.("change", change);
    return () => q.removeEventListener?.("change", change);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps
  return on;
}

function usePrefersReducedMotion(): boolean {
  const media = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null);
  const [reduce, setReduce] = useState(() => !!media()?.matches);
  useEffect(() => {
    const q = media();
    if (!q) return;
    const on = () => setReduce(q.matches);
    q.addEventListener?.("change", on);
    return () => q.removeEventListener?.("change", on);
  }, []);
  return reduce;
}

function Mic() {
  return (
    <svg className="mic" viewBox="0 0 24 24" aria-label="Commentator" role="img">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4M8.5 21h7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function Bolt() {
  return <svg className="pw-icon bolt" viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg>;
}

function ScoutEye() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12z" fill="#fff" stroke="#14532d" strokeWidth="2" />
      <circle cx="12" cy="12" r="3.2" fill="#14532d" />
    </svg>
  );
}

type G = ReturnType<typeof useGame>;

function Panel({ g, phase, game, humanToAct, onExit, exitLabel }: { g: G; phase: Phase; game: GameState; humanToAct: boolean; onExit: () => void; exitLabel?: string }): ReactNode {
  const timerStyle = (startedAt: number, limit: number) => ({ "--left": `${Math.max(0, 1 - (g.now - startedAt) / limit) * 100}%` }) as React.CSSProperties;

  if (!g.ready && game.options.trivia) return <div className="quiz"><p className="q">Warming up the question bank…</p></div>;

  if (phase.kind === "cards") {
    const name = game.players[phase.color].name;
    return (
      <div className="quiz">
        <div className="meta"><span>{phase.label}</span><span>{name === "You" ? "You pick" : `${name} picks`}</span></div>
        <div className="cards">
          {phase.cards.map((c, i) => (
            <button key={i} type="button" className={`qcard d-${c.difficulty}`} disabled={!humanToAct} onClick={() => g.pickCard(i, false)}>
              <b>{c.topic}</b>
              <span>{cardLabel(c).split(" · ")[1]}</span>
              <small>+{REWARD[c.difficulty]} Form · {({ easy: "no risk", medium: "wrong: opponent +2", hard: "wrong: piece booked" } as const)[c.difficulty]}</small>
            </button>
          ))}
        </div>
        {humanToAct && (
          <button type="button" className={`cta${phase.bonus ? " free-puskas" : ""}`} onClick={() => g.pickCard(phase.cards.findIndex((c) => c.difficulty === "hard"), true)}>
            {phase.bonus
              ? <>Free Puskás from the Hot Spot: +{REWARD.puskas} Form, 8 seconds. Wrong costs nothing</>
              : <>Go for a Puskás: turn the Screamer into the goal of the season. +{REWARD.puskas} Form, 8 seconds. Wrong: booked and -{PUSKAS_MISS_FORM} Form</>}
          </button>
        )}
      </div>
    );
  }

  if (phase.kind === "question") {
    const name = game.players[phase.color].name;
    const left = Math.max(0, Math.ceil((phase.limitMs - (g.now - phase.startedAt)) / 1000));
    return (
      <div className="quiz">
        <div className="meta"><span>{phase.label}</span><span>{name} · {left}s</span></div>
        <p className="q">{phase.q.question}</p>
        <div className="timer live" style={timerStyle(phase.startedAt, phase.limitMs)} />
        <div className="answers">
          {phase.q.options.map((o, k) => (
            <button key={k} type="button" disabled={!humanToAct} onClick={() => g.answer(k)}>
              <b>{"ABCD"[k]}</b><span>{o}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (phase.kind === "whoami") {
    return <WhoAmIPanel g={g} phase={phase} game={game} humanToAct={humanToAct} timerStyle={timerStyle} />;
  }

  if (phase.kind === "promote") {
    const name = game.players[phase.color].name;
    const choices = promotionChoices(phase.earned);
    return (
      <div className="quiz promote good">
        <div className="meta"><span>Right on clue {phase.clues}: it was {phase.set.name ?? phase.set.options[phase.set.answer]}</span><span>{name} picks a piece</span></div>
        <p className="fine">You earned a {ROLE_NAME[phase.earned]}. Take it, or any lower piece.</p>
        <div className="promo-picks">
          {PROMO_ORDER.map((r) => {
            const ok = choices.includes(r);
            const stale = ok && promotionStalemates(game, phase.square, r);
            return (
              <button key={r} type="button" disabled={!ok || !humanToAct} className={stale ? "warn" : ""} onClick={() => g.promote(r)}>
                <span className="glyph" aria-hidden="true">{(phase.color === "white" ? PROMO_GLYPH_W : PROMO_GLYPH_B)[r]}</span>
                <b>{ROLE_NAME[r][0].toUpperCase() + ROLE_NAME[r].slice(1)}</b>
                {stale && <small>Stalemate!</small>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (phase.kind === "result") {
    return (
      <div className={`quiz result ${phase.correct ? "good" : "bad"}`}>
        <div className="meta"><span>{phase.title}</span></div>
        <div className="answers">
          {phase.options.map((o, k) => (
            <button key={k} type="button" disabled className={k === phase.answer ? "right" : k === phase.choice ? "wrong" : "dim"}><b>{"ABCD"[k]}</b><span>{o}</span></button>
          ))}
        </div>
        <ul className="lines">{phase.lines.map((l) => <li key={l}>{l}</li>)}</ul>
        {phase.explanation && <p className="explain">{phase.explanation}</p>}
        <div className="timer live" style={timerStyle(phase.shownAt, phase.auto ? RESULT_MS : RESULT_MS_HUMAN)} />
        {!phase.auto && <button type="button" className="cta" onClick={g.continueOn}>Play on</button>}
      </div>
    );
  }

  if (phase.kind === "shootout") {
    const taker = game.players[phase.taker];
    const tally = (c: Color) => phase.kicks.filter((k) => k.color === c).map((k) => (k.scored ? "●" : "○")).join(" ");
    const takerHuman = taker.kind === "human";
    return (
      <div className="quiz">
        <div className="meta"><span>Penalty Shootout · {taker.name} to take</span><span>{game.players.white.name} {tally("white") || "–"} | {game.players.black.name} {tally("black") || "–"}</span></div>
        <p className="q">{phase.q.question}</p>
        <div className="timer live" style={timerStyle(phase.startedAt, TIMER_MS.normal)} />
        <div className="answers">
          {phase.q.options.map((o, k) => (
            <button key={k} type="button" disabled={!takerHuman || phase.choice !== null} className={phase.choice === null ? "" : k === phase.q.answer ? "right" : k === phase.choice ? "wrong" : "dim"} onClick={() => g.kick(k)}>
              <b>{"ABCD"[k]}</b><span>{o}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (phase.kind === "over" && game.outcome) {
    return (
      <div className="quiz result">
        <div className="meta"><span>Full time</span></div>
        <p className="q">{outcomeText(game, game.outcome)}</p>
        <button type="button" className="cta" onClick={onExit}>{exitLabel ?? "New game"}</button>
      </div>
    );
  }

  if (phase.kind === "thinking") {
    return (
      <div className="quiz idle">
        <div className="meta"><span>{POWER_UP_BY_ID[phase.power].name}</span><span>{game.players[turnOf(game)].name}</span></div>
        <p className="q small">The engine is reading the game…</p>
      </div>
    );
  }

  // Waiting for a move.
  const mover = game.players[turnOf(game)];
  return (
    <div className="quiz idle">
      <div className="meta">
        <span>{game.step === "free-kick" ? "Free Kick" : game.step === "extra-time" ? "Extra Time" : phase.kind === "target" ? POWER_UP_BY_ID[phase.power].name : "Open play"}</span>
        <span>{mover.name} to move</span>
      </div>
      <p className={`q small${phase.kind === "move" && mover.kind === "human" && game.step === "normal" ? " explainer" : ""}`}>{phase.kind === "target" ? `Pick a target to finish ${POWER_UP_BY_ID[phase.power].name}.` : mover.kind === "bot" ? `${mover.name} is thinking…` : game.step === "extra-time" ? "Second move: no captures or checks. You can skip it if it would hurt you." : game.options.trivia ? `Questions come on captures, every ${SET_PIECE_EVERY}th quiet move and on Hot Spots (circled squares, from move 4).` : "Plain chess: no trivia this game."}</p>
      {game.step === "extra-time" && humanToAct && phase.kind === "move" && <button type="button" className="cta" onClick={g.skipExtra}>Skip the second move</button>}
    </div>
  );
}

const PROMO_GLYPH_W: Record<string, string> = { q: "♕", r: "♖", b: "♗", n: "♘" };
const PROMO_GLYPH_B: Record<string, string> = { q: "♛", r: "♜", b: "♝", n: "♞" };

function WhoAmIPanel({ g, phase, game, humanToAct, timerStyle }: {
  g: G; phase: Extract<Phase, { kind: "whoami" }>; game: GameState; humanToAct: boolean; timerStyle: (startedAt: number, limit: number) => React.CSSProperties;
}): ReactNode {
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (humanToAct) input.current?.focus(); }, [humanToAct]);
  const name = game.players[phase.color].name;
  const piece = WHO_AM_I_PIECES[phase.clues - 1];
  const next = Math.max(0, Math.ceil((CLUE_MS - (g.now - phase.clueAt)) / 1000));
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (text.trim()) g.guess(text); };
  return (
    <div className="quiz whoami">
      <div className="meta"><span>Promotion · Who am I?{phase.bonus ? ` · ${clubShort(game.players[phase.color].club)}` : ""}</span><span>{name} · guess now for a {ROLE_NAME[piece]}</span></div>
      <p className="fine">The clock is paused and the board is hidden. Type the footballer's name.</p>
      <ol className="clues">
        {phase.set.clues.slice(0, phase.clues).map((c, i) => <li key={i}>{c}</li>)}
      </ol>
      <div className="timer live" style={timerStyle(phase.clueAt, CLUE_MS)} />
      {humanToAct ? (
        <form className="guess" onSubmit={submit}>
          <input
            ref={input} type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Who am I?"
            aria-label="Your answer" autoComplete="off" autoCorrect="off" autoCapitalize="words" spellCheck={false} enterKeyHint="go"
          />
          <button type="submit" className="go" disabled={!text.trim()}>Guess</button>
        </form>
      ) : (
        <p className="q small">{name} is thinking…</p>
      )}
      {humanToAct && (
        <button type="button" className="cta" onClick={g.nextClue}>
          {phase.clues < 5 ? `Next clue (${next}s): drops to a ${ROLE_NAME[WHO_AM_I_PIECES[phase.clues]]}` : `Last clue: ${next}s to guess`}
        </button>
      )}
      <small className="fine">One guess. Capitals and accents don't matter, the surname is enough, and a small typo is fine. Right: that piece or any lower one. Wrong or out of time: a knight, and your opponent gets +2 Form.</small>
    </div>
  );
}

function outcomeText(game: GameState, o: Outcome): string {
  const n = (c: Color) => game.players[c].name;
  switch (o.kind) {
    case "checkmate": return `Checkmate! ${n(o.winner)} wins.`;
    case "resign": return `${n(o.winner)} wins by resignation.`;
    case "timeout": return `${n(o.winner)} wins on time.`;
    case "shootout": return `${n(o.winner)} wins the Penalty Shootout ${o.score[o.winner]}-${o.score[o.winner === "white" ? "black" : "white"]}.`;
    case "draw": return `It's a draw (${DRAW_WORDS[o.reason] ?? o.reason}).`;
  }
}

function powerEffect(game: GameState, p: PowerUpDef): string {
  return p.id === "fergie-time" ? `+${fmtSeconds(fergieMs(game.options.minutes))} on your clock` : p.effect;
}

/** Can this power-up be finished once confirmed? Targeted ones need at least one valid target. */
/**
 * The game state with clock-only changes ignored: returns the previous object when nothing but
 * a player's clock has changed, so memos keyed on it don't rerun on every clock tick.
 */
export function useStableGame(game: GameState): GameState {
  const last = useRef(game);
  if (last.current !== game && !sameApartFromClocks(last.current, game)) last.current = game;
  return last.current;
}

export function sameApartFromClocks(a: GameState, b: GameState): boolean {
  for (const k of Object.keys(b) as (keyof GameState)[]) {
    if (k === "players") continue;
    if (a[k] !== b[k]) return false;
  }
  for (const c of ["white", "black"] as Color[]) {
    const pa = a.players[c], pb = b.players[c];
    if (pa === pb) continue;
    for (const k of Object.keys(pb) as (keyof typeof pb)[]) if (k !== "clockMs" && pa[k] !== pb[k]) return false;
  }
  return true;
}

function hasTargets(game: GameState, id: PowerUpId): boolean {
  const def = POWER_UP_BY_ID[id];
  if (def.target === "none") return true;
  const firsts = powerTargets(game, id);
  if (def.target !== "two-own-pieces") return firsts.length > 0;
  return firsts.some((f) => powerTargets(game, id, f).length > 0);
}

/**
 * The Form meter is a button: tapping it opens the power-ups in a drawer over the screen (from the
 * bottom on phones, from the side in landscape), so they never push the board off the screen.
 */
const PowerBar = memo(function PowerBar({ game, phase, color, enabled, onPick, play }: { game: GameState; phase: Phase; color: Color; enabled: boolean; onPick: (id: PowerUpId) => void; play: (s: SfxName) => void }): ReactNode {
  const me = game.players[color];
  // "+3" floats up from the meter whenever this player's Form goes up.
  const [pop, setPop] = useState<{ n: number; id: number } | null>(null);
  const lastForm = useRef({ color, form: me.form });
  useEffect(() => {
    const prev = lastForm.current;
    lastForm.current = { color, form: me.form };
    if (prev.color === color && me.form > prev.form) setPop({ n: me.form - prev.form, id: Date.now() });
  }, [me.form, color]);
  useEffect(() => {
    if (!pop) return;
    const t = setTimeout(() => setPop(null), 1400);
    return () => clearTimeout(t);
  }, [pop]);
  const myTurn = turnOf(game) === color;
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<PowerUpId | null>(null);
  useEffect(() => { if (!enabled) setPending(null); }, [enabled]);
  // A question, a target to pick or the other player's turn: the drawer gets out of the way.
  useEffect(() => { setOpen(false); setPending(null); }, [phase.kind, color]);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setPending(null); } };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);
  const list = POWER_UPS.filter((p) => !p.timedOnly || game.options.timed);
  const def = pending ? POWER_UP_BY_ID[pending] : null;
  const pendingCost = pending ? powerCost(game, color, pending) : 0;
  const pendingBlocked = useMemo(() => (pending ? powerBlocked(game, pending) ?? (hasTargets(game, pending) ? null : "No valid target right now") : null), [game, pending]);
  const ready = enabled ? list.filter((p) => !powerBlocked(game, p.id) && !(me.cooldowns[p.id] > 0) && me.form >= powerCost(game, color, p.id)).length : 0;
  const label = (me.kind === "human" && game.options.mode === "bot") || me.name.toLowerCase() === "you" ? "Your Form" : `${me.name}'s Form`;
  const close = () => { setOpen(false); setPending(null); };
  const meter = (
    <>
      <span className="label">{label}</span>
      <span className="pips" aria-hidden="true">{Array.from({ length: FORM_CAP }, (_, i) => <i key={i} className={i < me.form ? "on" : ""} />)}</span>
      <b className="num">{me.form}<small>/{FORM_CAP}</small>{pop && <span key={pop.id} className="form-pop" aria-hidden="true">+{pop.n}</span>}</b>
    </>
  );

  return (
    <div className="powerbox">
      <button type="button" className={`form-meter power-toggle${ready ? " ready" : ""}`} aria-expanded={open} aria-haspopup="dialog"
        aria-label={`Power-ups: ${me.name} has ${me.form} Form to spend${ready ? `, ${ready} ready to use` : ""}`}
        onClick={() => { play("select"); if (open) close(); else setOpen(true); }}>
        {meter}
        <span className="open-tag"><Bolt />Power-ups{ready ? <em>{ready}</em> : null}</span>
      </button>
      {open && (
        <>
          <div className="drawer-backdrop" onClick={close} />
          <div className="power-drawer" role="dialog" aria-label="Power-ups">
            <div className="drawer-head">
              <div className="form-meter">{meter}</div>
              <button type="button" className="drawer-close" aria-label="Close power-ups" onClick={close}>×</button>
            </div>
            {comebackShift(game, color) < 0 && <p className="fine drawer-note comeback">Comeback: you're 3+ points down, so power-ups cost 1 less.</p>}
            {!enabled && <p className="fine drawer-note">{myTurn ? "Power-ups are used before you move." : "You can use power-ups on your turn."}</p>}
            <div className="powers" aria-label="Power-ups">
              {list.map((p) => {
                const blocked = myTurn ? powerBlocked(game, p.id) : "Not your turn";
                const cd = me.cooldowns[p.id];
                const cost = powerCost(game, color, p.id);
                const on = (phase.kind === "target" || phase.kind === "thinking") && phase.power === p.id;
                // Faded: you can't afford it or it's cooling down. Other reasons show when you tap it.
                const faded = cd > 0 || me.form < cost;
                const tap = () => {
                  if (!enabled) return;
                  play("select");
                  setPending((cur) => (cur === p.id ? null : p.id));
                };
                return (
                  <button key={p.id} type="button" title={`${powerEffect(game, p)}${p.rule ? `. ${p.rule}` : ""}`} className={`pw${faded ? " faded" : ""}${blocked || !enabled ? " locked" : ""}${on || pending === p.id ? " on" : ""}${me.form >= cost ? " afford" : ""}`} onClick={tap}>
                    <PowerIcon id={p.id} className="pw-icon" />
                    <span>{p.name}</span>
                    <Stars n={p.stars} />
                    <span className="cost">{cost} Form{cd > 0 ? ` · ${cd} to go` : ""}</span>
                  </button>
                );
              })}
            </div>
            {def && (
              <div className="confirm" role="dialog" aria-label={`Use ${def.name}?`}>
                <div className="confirm-head"><PowerIcon id={def.id} className="pw-icon big" /><b>{def.name}</b><Stars n={def.stars} /><span className="cost">{pendingCost} Form</span></div>
                <p>{powerEffect(game, def)}{def.rule ? `. ${def.rule}.` : "."}</p>
                {pendingBlocked ? <p className="why">{pendingBlocked}</p> : <p className="fine">Once you confirm it can't be cancelled{def.target !== "none" ? ": you'll have to pick a target" : ""}.</p>}
                <div className="row-btns">
                  <button type="button" className="go" disabled={!!pendingBlocked} onClick={() => { const id = pending!; close(); onPick(id); }}>Confirm</button>
                  <button type="button" onClick={() => setPending(null)}>Not now</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
});

/** Power-up value, 1 to 5 stars: roughly how much it swings the board. */
function Stars({ n }: { n: number }) {
  return (
    <span className="stars" role="img" aria-label={`Value ${n} out of 5`} title={`Value: ${n} out of 5 stars`}>
      {"★".repeat(n)}<span className="off">{"★".repeat(5 - n)}</span>
    </span>
  );
}

function StadiumClock({ ms, running }: { ms: number; running: boolean }) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return (
    <span className={`clock stadium${running ? " running" : ""}${s <= 30 ? " low" : ""}`} role="timer" aria-label={`${Math.floor(s / 60)} minutes ${s % 60} seconds left`}>
      <span className="digits" data-ghost="88:88">{mm}<span className="colon">:</span>{ss}</span>
    </span>
  );
}

/** A marker-pen arrow between two squares. `n` is the board size (8, or 4 for the Settings preview). */
export function MarkerArrow({ from, to, orientation, color, id, outline, n = 8 }: { from: string; to: string; orientation: Color; color: string; id: string; outline?: boolean; n?: number }) {
  const xy = (sq: string) => {
    const f = FILES.indexOf(sq[0]), r = Number(sq[1]) - 1;
    return orientation === "white" ? [f + 0.5, n - 1 - r + 0.5] : [n - 1 - f + 0.5, r + 0.5];
  };
  const [x1, y1] = xy(from);
  const [x2, y2] = xy(to);
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ex = x2 - ((x2 - x1) / len) * 0.3, ey = y2 - ((y2 - y1) / len) * 0.3;
  const mx = (x1 + ex) / 2 + ((ey - y1) / len) * 0.4, my = (y1 + ey) / 2 - ((ex - x1) / len) * 0.4;
  return (
    <svg className="arrow" viewBox={`0 0 ${n} ${n}`} aria-hidden="true">
      <defs>
        <marker id={id} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto">
          <path d="M0 0L10 5L0 10z" fill={color} stroke={outline ? "#fff" : "none"} strokeWidth="1.2" />
        </marker>
      </defs>
      {outline && <path d={`M${x1} ${y1} Q ${mx} ${my} ${ex} ${ey}`} fill="none" stroke="#fff" strokeWidth=".26" strokeLinecap="round" opacity=".9" />}
      <path d={`M${x1} ${y1} Q ${mx} ${my} ${ex} ${ey}`} fill="none" stroke={color} strokeWidth={outline ? ".14" : ".12"} strokeLinecap="round" strokeDasharray={outline ? undefined : ".25 .14"} markerEnd={`url(#${id})`} />
    </svg>
  );
}

function HotSpotIcon() {
  return (
    <svg className="hs" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#fff" stroke="#111" strokeWidth="1.5" />
      <path d="M12 7l4 3-1.5 4.5h-5L8 10z" fill="#111" />
      <path d="M12 7V2.5M16 10l4-1.5M14.5 14.5l2.5 4M9.5 14.5L7 18.5M8 10L4 8.5" stroke="#111" strokeWidth="1.3" fill="none" />
    </svg>
  );
}
