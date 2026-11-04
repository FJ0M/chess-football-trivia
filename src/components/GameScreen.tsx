// The game: board, players, the question / Who am I? / result panel, and the power-up bar.
// Class names (.board, .sq, .pc, .quiz, .powers, .pw, .player) are the ones every
// style in themes.css dresses up.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { GameStyle } from "../theme/themes";
import type { SfxName } from "../audio/sfx";
import type { PassAndPlayView } from "../settings/settings";
import { useGame, cardLabel, type Phase, type SetupChoice } from "../game/useGame";
import { POWER_UPS, POWER_UP_BY_ID, TRIVIA_HINTS } from "../game/powerups";
import { destsFor, isPromotion, pieceAt, powerBlocked, powerCost, powerTargets, turnOf, WHO_AM_I_PIECES, ROLE_NAME } from "../game/rules";
import { clubShort } from "../game/clubs";
import { CLUE_MS } from "../game/whoami";
import type { Color, GameState, Outcome } from "../game/types";

const GLYPH: Record<string, string> = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
const FILES = "abcdefgh";

interface Props {
  style: GameStyle;
  play: (s: SfxName) => void;
  setup: SetupChoice;
  view: PassAndPlayView;
  paused: boolean;
  onPause: () => void;
  onExit: () => void;
  onFinish: (game: GameState) => void;
}

export function GameScreen({ style, play, setup, view, paused, onPause, onExit, onFinish }: Props) {
  const g = useGame(setup, play, paused);
  const { game, phase } = g;
  const [sel, setSel] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"resign" | "draw" | null>(null);

  const turn = turnOf(game);
  const active: Color = "color" in phase ? phase.color : phase.kind === "shootout" ? phase.taker : turn;
  const humans = (["white", "black"] as Color[]).filter((c) => game.players[c].kind === "human");
  const local = game.options.mode === "local";
  const orientation: Color = local ? (view === "hand-over" ? active : "white") : humans[0] ?? "white";
  const turned = local && view === "face-to-face" && active === "black";
  const humanToAct = game.players[active].kind === "human";

  const dests = useMemo(() => (phase.kind === "move" && humanToAct ? destsFor(game) : new Map<string, string[]>()), [game, phase.kind, humanToAct]);
  const targets = useMemo(() => {
    if (phase.kind !== "target") return new Set<string>();
    return new Set(powerTargets(game, phase.power, phase.first));
  }, [game, phase]);

  function tap(sq: string) {
    if (phase.kind === "target") { g.tapTarget(sq); return; }
    if (phase.kind !== "move" || !humanToAct) return;
    const piece = pieceAt(game.fen, sq);
    if (sel && dests.get(sel)?.includes(sq)) {
      const uci = sel + sq + (isPromotion(game, sel, sq) ? "q" : "");
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
  useEffect(() => { if (game.outcome) onFinish(game); }, [game.outcome]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = orientation === "white" ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const cols = orientation === "white" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const board = boardArray(game.fen);
  const last = game.lastMove;
  const top: Color = orientation === "white" ? "black" : "white";
  const bottom: Color = orientation;

  return (
    <div className={`screen style-${style.id}${turned ? " f2f-black" : ""}`}>
      <div className="strip">
        <span>{game.options.chess960 ? `Chess960 · No. ${game.options.position}` : game.options.trivia ? "Chess Football Trivia" : "Plain chess"}</span>
        <span>Move {Math.ceil((game.history.length + 1) / 2)}</span>
      </div>
      <PlayerBar game={game} color={top} active={active} bubble={g.bubble} flipped={local && view === "face-to-face" && top === "black"} />
      <div className="board" role="grid" aria-label="Chess board">
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
          return (
            <button key={sq} type="button" className={cls} onClick={() => tap(sq)} aria-label={`${sq}${p ? ` ${p.color} ${ROLE_NAME[p.role]}` : ""}`}>
              {game.hotSpots.includes(sq) && <HotSpotIcon />}
              {p && <span className={`pc ${p.color === "white" ? "w" : "b"}`}>{GLYPH[p.role]}{"︎"}</span>}
              {isDest && <span className={p ? "dot cap" : "dot"} />}
            </button>
          );
        }))}
        {style.id === "tactics" && last && <MarkerArrow from={last[0]} to={last[1]} orientation={orientation} color="#fff7a8" id="ah" />}
        {g.overlay.tip && <MarkerArrow from={g.overlay.tip[0]} to={g.overlay.tip[1]} orientation={orientation} color="#2e9d4f" id="tip" />}
      </div>
      <PlayerBar game={game} color={bottom} active={active} bubble={g.bubble} />

      <div className={`controls${turned ? " turned" : ""}`}>
        <Panel g={g} phase={phase} game={game} humanToAct={humanToAct} onExit={onExit} />
        {game.options.trivia && phase.kind !== "over" && phase.kind !== "shootout" && (
          <PowerBar game={game} phase={phase} enabled={humanToAct && (phase.kind === "move" || phase.kind === "target")} onPick={g.choosePower} />
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

function fmtClock(ms: number | null): string {
  if (ms === null) return "";
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function PlayerBar({ game, color, active, bubble, flipped }: { game: GameState; color: Color; active: Color; bubble: { color: Color; text: string } | null; flipped?: boolean }): ReactNode {
  const p = game.players[color];
  const status = [p.sentOff ? "Sent off" : "", p.doubleNextPower ? "Red card" : "", p.goldenBoot ? "Golden Boot" : "", p.wrongStreak >= 2 ? "Booked" : ""].filter(Boolean);
  return (
    <div className={`player${active === color ? " up" : ""}${flipped ? " turned" : ""}`}>
      <div className="who">
        <span className="badge">{p.name[0]?.toUpperCase()}</span>
        <span>{p.name} <span className="tag">{color === "white" ? "White" : "Black"} · {clubShort(p.club)}{p.kind === "bot" ? " · Bot" : ""}{status.length ? ` · ${status.join(", ")}` : ""}</span></span>
      </div>
      {bubble?.color === color && <span className="bubble" role="status">{bubble.text}</span>}
      <span className="form">
        {game.options.trivia && <>Form {p.form}</>}
        {p.clockMs !== null && <span className="clock"> {fmtClock(p.clockMs)}</span>}
      </span>
    </div>
  );
}

type G = ReturnType<typeof useGame>;

function Panel({ g, phase, game, humanToAct, onExit }: { g: G; phase: Phase; game: GameState; humanToAct: boolean; onExit: () => void }): ReactNode {
  const timerStyle = (startedAt: number, limit: number) => ({ "--left": `${Math.max(0, 1 - (g.now - startedAt) / limit) * 100}%` }) as React.CSSProperties;

  if (!g.ready && game.options.trivia) return <div className="quiz"><p className="q">Warming up the question bank…</p></div>;

  if (phase.kind === "cards") {
    const name = game.players[phase.color].name;
    return (
      <div className="quiz">
        <div className="meta"><span>{phase.label}</span><span>{name} picks</span></div>
        <div className="cards">
          {phase.cards.map((c, i) => (
            <button key={i} type="button" className={`qcard d-${c.difficulty}`} disabled={!humanToAct} onClick={() => g.pickCard(i, false)}>
              <b>{c.topic}</b>
              <span>{cardLabel(c).split(" · ")[1]}</span>
              <small>+{({ easy: 1, medium: 2, hard: 4 } as const)[c.difficulty] * (phase.bonus ? 2 : 1)} Form · {({ easy: "no risk", medium: "wrong: opponent +2", hard: "wrong: piece booked" } as const)[c.difficulty]}</small>
            </button>
          ))}
        </div>
        {humanToAct && (
          <button type="button" className="worldie" onClick={() => g.pickCard(phase.cards.findIndex((c) => c.difficulty === "hard"), true)}>
            Go for a Worldie: +{6 * (phase.bonus ? 2 : 1)} Form, 8 seconds, no hints. Wrong and you're sent off
          </button>
        )}
      </div>
    );
  }

  if (phase.kind === "question") {
    const name = game.players[phase.color].name;
    const form = game.players[phase.color].form;
    const left = Math.max(0, Math.ceil((phase.limitMs - (g.now - phase.startedAt)) / 1000));
    const friend = game.options.mode === "bot" && Object.values(game.players).some((p) => p.botId === "ollie") ? "Phone Ryan" : "Phone Ollie";
    return (
      <div className="quiz">
        <div className="meta"><span>{phase.label}</span><span>{name} · {left}s</span></div>
        <p className="q">{phase.q.question}</p>
        <div className="timer live" style={timerStyle(phase.startedAt, phase.limitMs)} />
        <div className="answers">
          {phase.q.options.map((o, k) => (
            <button key={k} type="button" disabled={!humanToAct || phase.hidden.includes(k)} className={phase.hidden.includes(k) ? "dim" : phase.friend === k ? "suggested" : ""} onClick={() => g.answer(k)}>
              <b>{"ABCD"[k]}</b><span>{phase.hidden.includes(k) ? "" : o}{phase.crowd ? <em className="crowd"> {phase.crowd[k]}%</em> : null}</span>
            </button>
          ))}
        </div>
        {humanToAct && !phase.worldie && (
          <div className="thints">
            {TRIVIA_HINTS.map((h) => (
              <button key={h.id} type="button" disabled={form < h.cost} onClick={() => g.useHint(h.id)}>
                {h.id === "phone-a-friend" ? friend : h.name} <small>{h.cost} Form</small>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (phase.kind === "whoami") {
    const name = game.players[phase.color].name;
    const piece = WHO_AM_I_PIECES[phase.clues - 1];
    const next = phase.clues < 5 ? Math.max(0, Math.ceil((CLUE_MS - (g.now - phase.clueAt)) / 1000)) : Math.max(0, Math.ceil((CLUE_MS - (g.now - phase.clueAt)) / 1000));
    return (
      <div className="quiz whoami">
        <div className="meta"><span>Promotion · Who am I?{phase.bonus ? ` · ${clubShort(game.players[phase.color].club)}` : ""}</span><span>{name} · guess now for a {ROLE_NAME[piece]}</span></div>
        <ol className="clues">
          {phase.set.clues.slice(0, phase.clues).map((c, i) => <li key={i}>{c}</li>)}
        </ol>
        <div className="timer live" style={timerStyle(phase.clueAt, CLUE_MS)} />
        <div className="answers">
          {phase.set.options.map((o, k) => (
            <button key={k} type="button" disabled={!humanToAct} onClick={() => g.guess(k)}><b>{"ABCD"[k]}</b><span>{o}</span></button>
          ))}
        </div>
        {humanToAct && (
          <button type="button" className="worldie" onClick={g.nextClue}>
            {phase.clues < 5 ? `Next clue (${next}s): drops to a ${ROLE_NAME[WHO_AM_I_PIECES[phase.clues]]}` : `Last clue: ${next}s to guess`}
          </button>
        )}
        <small className="fine">One guess only. Wrong or out of time: a knight, and your opponent gets +2 Form.</small>
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
        {!phase.auto && <button type="button" className="worldie" onClick={g.continueOn}>Play on</button>}
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
        <div className="timer live" style={timerStyle(phase.startedAt, 15000)} />
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
        <button type="button" className="worldie" onClick={onExit}>New game</button>
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
      <p className="q small">{mover.kind === "bot" ? `${mover.name} is thinking…` : game.options.trivia ? "Questions come on captures, every 3rd move and on Hot Spots (circled squares)." : "Plain chess: no trivia this game."}</p>
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
    case "draw": return `It's a draw (${o.reason}).`;
  }
}

function PowerBar({ game, phase, enabled, onPick }: { game: GameState; phase: Phase; enabled: boolean; onPick: (id: never) => void }): ReactNode {
  const color = turnOf(game);
  const me = game.players[color];
  const list = POWER_UPS.filter((p) => !p.timedOnly || game.options.timed);
  return (
    <div className="powers scroll" aria-label="Power-ups">
      {list.map((p) => {
        const blocked = powerBlocked(game, p.id);
        const cd = me.cooldowns[p.id];
        const on = phase.kind === "target" && phase.power === p.id;
        return (
          <button key={p.id} type="button" title={`${p.effect}${p.rule ? `. ${p.rule}` : ""}`} className={`pw${blocked || !enabled ? " locked" : ""}${on ? " on" : ""}`} onClick={() => enabled && onPick(p.id as never)}>
            <span>{p.name}</span>
            <span className="cost">{powerCost(game, color, p.id)} Form{cd > 0 ? ` · ready in ${cd}` : ""}</span>
          </button>
        );
      })}
    </div>
  );
}

function MarkerArrow({ from, to, orientation, color, id }: { from: string; to: string; orientation: Color; color: string; id: string }) {
  const xy = (sq: string) => {
    const f = FILES.indexOf(sq[0]), r = Number(sq[1]) - 1;
    return orientation === "white" ? [f + 0.5, 7 - r + 0.5] : [7 - f + 0.5, r + 0.5];
  };
  const [x1, y1] = xy(from);
  const [x2, y2] = xy(to);
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ex = x2 - ((x2 - x1) / len) * 0.3, ey = y2 - ((y2 - y1) / len) * 0.3;
  const mx = (x1 + ex) / 2 + ((ey - y1) / len) * 0.4, my = (y1 + ey) / 2 - ((ex - x1) / len) * 0.4;
  return (
    <svg className="arrow" viewBox="0 0 8 8" aria-hidden="true">
      <defs>
        <marker id={id} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto">
          <path d="M0 0L10 5L0 10z" fill={color} />
        </marker>
      </defs>
      <path d={`M${x1} ${y1} Q ${mx} ${my} ${ex} ${ey}`} fill="none" stroke={color} strokeWidth=".12" strokeLinecap="round" strokeDasharray=".25 .14" markerEnd={`url(#${id})`} />
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
