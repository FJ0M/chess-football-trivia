// The trophy cabinet: wooden shelves with a cup for each bot you've beaten and pin badges
// for special feats. Badges you haven't won show greyed out, with what they need and how close
// you are (audit, 2026-11-22: hidden "?" badges gave nothing to aim at).

import { useState, type ReactNode } from "react";
import { ScreenHead } from "./Menus";
import { BADGES, BADGE_BY_ID, badgeProgress, cups, loadCabinet, tierFor, TIERS, type BadgeDef, type BadgeGroup, type Cup, type Earned, type NewBadge, type Tier } from "../game/badges";
import { loadScores } from "../game/scores";
import { honourText, loadHonours } from "../game/season";
import { EbkBadge } from "./MatchFx";

const METAL: Record<Tier, { fill: string; dark: string; light: string }> = {
  bronze: { fill: "#c27c3e", dark: "#7a4719", light: "#f0b77e" },
  silver: { fill: "#b9c2c9", dark: "#6c767e", light: "#f4f7f9" },
  gold: { fill: "#f2c230", dark: "#a5780a", light: "#fff2a8" },
};
const ENAMEL: Record<BadgeGroup, string> = { trivia: "#1f5fbf", chess: "#18304a", career: "#d1342f", season: "#7a263a" };
const GROUP_NAME: Record<BadgeGroup, string> = { trivia: "Trivia", chess: "Chess", career: "Power-ups and career", season: "Season" };
const TIER_NAME: Record<Tier, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold" };
const LEVEL_NAME: Record<string, string> = { low: "Easy", medium: "Medium", hard: "Hard" };

const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const badgeName = (b: BadgeDef, e?: Earned) => (b.id === "club-legend" && e?.label ? e.label : b.name);

function CupArt({ tier, won }: { tier: Tier; won: boolean }) {
  const m = METAL[tier];
  return (
    <svg className={`cup${won ? "" : " empty"}`} viewBox="0 0 48 60" aria-hidden="true">
      <path d="M12 6h24v10c0 10-5 17-12 17S12 26 12 16z" fill={won ? m.fill : "none"} stroke={won ? m.dark : "currentColor"} strokeWidth="2" />
      <path d="M12 10H5c0 8 3 12 8 13M36 10h7c0 8-3 12-8 13" fill="none" stroke={won ? m.dark : "currentColor"} strokeWidth="2.5" strokeLinecap="round" />
      {won && <path d="M17 9v8c0 5 2 9 5 11" fill="none" stroke={m.light} strokeWidth="2.5" strokeLinecap="round" />}
      <path d="M21 33h6v8h-6z" fill={won ? m.dark : "none"} stroke={won ? m.dark : "currentColor"} strokeWidth="2" />
      <path d="M14 41h20v6H14zM10 47h28v8H10z" fill={won ? "#3a2412" : "none"} stroke={won ? "#1e1209" : "currentColor"} strokeWidth="2" />
      {won && <path d="M17 50h14" stroke={m.fill} strokeWidth="2" />}
    </svg>
  );
}

export function BadgePin({ def, tier, small }: { def: BadgeDef; tier?: Tier; small?: boolean }) {
  if (def.id === "ebk") return <EbkBadge className={`pin-art${small ? " small" : ""}`} />;
  const m = METAL[tier ?? "gold"];
  const size = def.glyph.length >= 4 ? 9 : def.glyph.length === 3 ? 11 : def.glyph.length === 2 ? 14 : 18;
  return (
    <svg className={`pin-art${small ? " small" : ""}`} viewBox="0 0 40 40" role="img" aria-label={def.name}>
      <circle cx="20" cy="20" r="18" fill={m.fill} stroke={m.dark} strokeWidth="2" />
      <circle cx="20" cy="20" r="13.5" fill={ENAMEL[def.group]} stroke={m.dark} strokeWidth="1" />
      <path d="M9 13a13 13 0 0 1 9-7" fill="none" stroke={m.light} strokeWidth="2" strokeLinecap="round" />
      <text x="20" y="20.5" textAnchor="middle" dominantBaseline="central" fontSize={size} fontWeight="800" fill="#fff" fontFamily="system-ui, sans-serif">{def.glyph}</text>
    </svg>
  );
}

type Pick = { kind: "badge"; def: BadgeDef; e?: Earned } | { kind: "cup"; cup: Cup };

function Progress({ n, need }: { n: number; need: number }) {
  return (
    <span className="badge-progress" role="img" aria-label={`${n} of ${need}`}>
      <i style={{ width: `${Math.min(100, (n / need) * 100)}%` }} /><small>{n}/{need}</small>
    </span>
  );
}

export function CabinetScreen({ onBack, head }: { onBack: () => void; head?: ReactNode }) {
  const [cab] = useState(loadCabinet);
  const [scores] = useState(loadScores);
  const [pick, setPick] = useState<Pick | null>(null);
  const all = cups(scores);
  const ladder = all.filter((c) => !c.level);
  const originals = all.filter((c) => c.level);
  const cupsWon = all.filter((c) => c.won > 0).length;
  const found = BADGES.filter((b) => cab.earned[b.id]).length;
  const groups: BadgeGroup[] = ["trivia", "chess", "career", "season"];
  const [honours] = useState(loadHonours);
  const titles = honours.filter((h) => h.champions).length;
  const cupsSeason = honours.filter((h) => h.cup).length;
  const ups = honours.filter((h) => h.move === "up").length;

  return (
    <section className="setup cabinet-screen" aria-labelledby={head ? "achievements-title" : "cabinet-title"}>
      {head ?? <ScreenHead id="cabinet-title" title="Trophy cabinet" onBack={onBack} />}
      <p className="cab-count">{cupsWon} of {all.length} cups · {found} of {BADGES.length} badges found</p>
      <div className="cabinet">
        <div className="shelf-label">The ladder</div>
        <div className="shelf cups">
          {ladder.map((c) => (
            <button key={c.botId} type="button" className="cup-slot" onClick={() => setPick({ kind: "cup", cup: c })} aria-label={`${c.name}: ${c.won ? `won ${c.won}` : "not won yet"}`}>
              <CupArt tier={c.tier} won={c.won > 0} />
              <span className="plaque">{c.who}</span>
            </button>
          ))}
        </div>
        {originals.length > 0 && <div className="shelf-label">The originals</div>}
        {originals.length > 0 && <div className="shelf cups originals">
          {originals.map((c) => (
            <button key={`${c.botId}:${c.level}`} type="button" className="cup-slot" onClick={() => setPick({ kind: "cup", cup: c })} aria-label={`${c.name}, ${LEVEL_NAME[c.level ?? ""]}: ${c.won ? `won ${c.won}` : "not won yet"}`}>
              <CupArt tier={c.tier} won={c.won > 0} />
              <span className="plaque">{c.who} · {LEVEL_NAME[c.level ?? ""]}</span>
            </button>
          ))}
        </div>}
        <div className="shelf-label">Season honours <span>{honours.length ? `${titles} title${titles === 1 ? "" : "s"} · ${cupsSeason} Cup${cupsSeason === 1 ? "" : "s"} · ${ups} promotion${ups === 1 ? "" : "s"}` : ""}</span></div>
        <div className="shelf honours">
          {honours.length ? (
            <ol className="honours-list">
              {[...honours].reverse().map((h) => (
                <li key={h.season} className={h.champions || h.cup ? "won" : ""}><b>Season {h.season}</b> {honourText(h)}</li>
              ))}
            </ol>
          ) : <p className="muted">Finish a Season and it goes on the honours board.</p>}
        </div>
        {groups.map((g) => {
          const list = BADGES.filter((b) => b.group === g);
          const got = list.filter((b) => cab.earned[b.id]);
          // Won first, then the ones still to win, greyed out.
          const order = [...got, ...list.filter((b) => !cab.earned[b.id])];
          return (
            <div key={g}>
              <div className="shelf-label">{GROUP_NAME[g]} badges <span>{got.length}/{list.length}</span></div>
              <div className="shelf pins">
                {order.map((b) => {
                  const e = cab.earned[b.id];
                  const prog = badgeProgress(b, cab.career);
                  return (
                    <button key={b.id} type="button" className={`pin-slot${e ? "" : " todo"}`} onClick={() => setPick({ kind: "badge", def: b, e })}
                      aria-label={`${badgeName(b, e)}${e ? "" : `, not won yet: ${b.how}`}${prog ? `, ${prog.n} of ${prog.need}` : ""}`}>
                      <BadgePin def={b} tier={e?.tier} />
                      <span className="plaque">{badgeName(b, e)}</span>
                      {prog && <Progress n={prog.n} need={prog.need} />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="muted">Only games against a bot count. Cups and badges live on this device.</p>
      {pick && <Detail pick={pick} cab={cab} onClose={() => setPick(null)} />}
    </section>
  );
}

function Detail({ pick, cab, onClose }: { pick: Pick; cab: ReturnType<typeof loadCabinet>; onClose: () => void }) {
  let body;
  if (pick.kind === "cup") {
    const c = pick.cup;
    body = (
      <>
        <CupArt tier={c.tier} won={c.won > 0} />
        <h2>{c.name}{c.level ? ` (${LEVEL_NAME[c.level]})` : ""}</h2>
        <p>{c.won ? `Beaten ${c.who} ${c.won === 1 ? "once" : `${c.won} times`}.` : `Beat ${c.who}${c.level ? ` on ${LEVEL_NAME[c.level]}` : ""} to put this cup in the cabinet.`}</p>
      </>
    );
  } else {
    const { def, e } = pick;
    const n = def.id === "club-legend" ? cab.career.clubRight : def.id === "groundhopper" ? cab.career.clubs.length : 0;
    const t = def.tiers ? tierFor(def, n) : null;
    const nextI = t ? TIERS.indexOf(t) + 1 : 0;
    const prog = badgeProgress(def, cab.career);
    body = (
      <>
        <span className={e ? "" : "todo"}><BadgePin def={def} tier={e?.tier} /></span>
        <h2>{badgeName(def, e)}{e?.tier ? ` · ${TIER_NAME[e.tier]}` : ""}</h2>
        <p>{def.how}{def.tiers ? `: ${n} so far.` : "."}</p>
        {prog && <Progress n={prog.n} need={prog.need} />}
        {def.tiers && nextI < 3 && <p className="muted">{TIER_NAME[TIERS[nextI]]} at {def.tiers[nextI]}.</p>}
        {e ? <p className="muted">First won {date(e.first)}{e.count > 1 ? ` · won ${e.count} times, last on ${date(e.last)}` : ""}</p> : <p className="muted">Not won yet.</p>}
      </>
    );
  }
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet cab-detail" role="dialog" aria-modal="true" onClick={(ev) => ev.stopPropagation()}>
        {body}
        <button type="button" className="menu-btn primary" onClick={onClose}><b>Close</b></button>
      </section>
    </div>
  );
}

/** "New in the cabinet" at full time. */
export function BadgeToast({ badges, onOpen, onClose }: { badges: NewBadge[]; onOpen: () => void; onClose: () => void }) {
  return (
    <aside className="badge-toast" role="status">
      <div className="bt-pins">{badges.slice(0, 4).map((b) => <BadgePin key={b.id} def={BADGE_BY_ID[b.id]} tier={b.tier} small />)}</div>
      <div className="bt-text">
        <b>{badges.length === 1 ? "New badge!" : `${badges.length} new badges!`}</b>
        <span>{badges.map((b) => `${badgeName(BADGE_BY_ID[b.id], { label: b.label } as Earned)}${b.tier ? ` (${TIER_NAME[b.tier]})` : ""}${b.again ? " again" : ""}`).join(", ")}</span>
      </div>
      <div className="bt-actions">
        <button type="button" className="menu-btn primary" onClick={onOpen}><b>See it</b></button>
        <button type="button" className="ghost" onClick={onClose} aria-label="Dismiss">✕</button>
      </div>
    </aside>
  );
}
