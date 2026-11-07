// Pass and Play handicap: piece odds from the stronger player and a Form boost for the weaker one,
// with a suggestion from both players' chess ratings.

import { FORM_BOOSTS, ODDS, ODDS_NAME, describeHandicap, suggestHandicap, type FormBoost, type OddsPiece } from "../game/handicap";
import type { Color } from "../game/types";

export interface HandicapChoice {
  weaker: Color | "none";
  odds: OddsPiece;
  formBoost: FormBoost;
  ratings: [string, string];
}

export const NO_HANDICAP: HandicapChoice = { weaker: "none", odds: "none", formBoost: 1, ratings: ["", ""] };

export function sanitizeHandicap(raw: unknown): HandicapChoice {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<HandicapChoice>;
  return {
    weaker: r.weaker === "white" || r.weaker === "black" ? r.weaker : "none",
    odds: ODDS.includes(r.odds as OddsPiece) ? (r.odds as OddsPiece) : "none",
    formBoost: (FORM_BOOSTS as readonly number[]).includes(r.formBoost as number) ? (r.formBoost as FormBoost) : 1,
    ratings: Array.isArray(r.ratings) && r.ratings.length === 2 ? [String(r.ratings[0] ?? ""), String(r.ratings[1] ?? "")] : ["", ""],
  };
}

const rating = (s: string) => (/^\d{2,4}$/.test(s.trim()) ? Number(s) : NaN);

export function HandicapSetup({ value, onChange, names, trivia }: { value: HandicapChoice; onChange: (v: HandicapChoice) => void; names: [string, string]; trivia: boolean }) {
  const set = (patch: Partial<HandicapChoice>) => onChange({ ...value, ...patch });
  const nm: Record<Color, string> = { white: names[0].trim() || "White", black: names[1].trim() || "Black" };
  const [rw, rb] = [rating(value.ratings[0]), rating(value.ratings[1])];
  const haveRatings = Number.isFinite(rw) && Number.isFinite(rb);
  const suggestion = haveRatings ? suggestHandicap(rw, rb) : null;
  const weaker = value.weaker;
  const stronger: Color | null = weaker === "none" ? null : weaker === "white" ? "black" : "white";
  const summary = weaker !== "none" ? describeHandicap({ weaker, odds: value.odds, formBoost: trivia ? value.formBoost : 1 }, nm) : "";

  return (
    <div className="handicap">
      <div className="field">
        <span>Chess ratings (optional, for a suggestion)</span>
        <div className="ratings">
          {([0, 1] as const).map((i) => (
            <label key={i}>
              <small>{i === 0 ? nm.white : nm.black}</small>
              <input id={`rating-${i}`} inputMode="numeric" placeholder="e.g. 1200" maxLength={4} value={value.ratings[i]}
                onChange={(e) => set({ ratings: (i === 0 ? [e.target.value, value.ratings[1]] : [value.ratings[0], e.target.value]) as [string, string] })} />
            </label>
          ))}
        </div>
        {haveRatings && (
          <div className="suggest">
            {suggestion ? (
              <>
                <span>Suggested: {describeHandicap({ ...suggestion, formBoost: trivia ? suggestion.formBoost : 1 }, nm)}</span>
                <button type="button" className="ghost" onClick={() => set({ ...suggestion, formBoost: trivia ? suggestion.formBoost : 1 })}>Use this</button>
              </>
            ) : <span>You're evenly matched: no handicap needed.</span>}
          </div>
        )}
      </div>

      <div className="field">
        <span>Who gets the help?</span>
        <div className="seg small" role="radiogroup" aria-label="Who gets the help">
          {(["none", "white", "black"] as const).map((w) => (
            <button key={w} type="button" role="radio" aria-checked={weaker === w} className={weaker === w ? "on" : ""} onClick={() => set({ weaker: w })}>
              {w === "none" ? "Nobody" : nm[w]}
            </button>
          ))}
        </div>
      </div>

      {stronger && weaker !== "none" && (
        <>
          <div className="field">
            <span>{nm[stronger]} starts without</span>
            <div className="seg small" role="radiogroup" aria-label="Piece odds">
              {ODDS.map((o) => (
                <button key={o} type="button" role="radio" aria-checked={value.odds === o} className={value.odds === o ? "on" : ""} onClick={() => set({ odds: o })}>
                  {o === "none" ? "Nothing" : ODDS_NAME[o]}
                </button>
              ))}
            </div>
          </div>
          {trivia && (
            <div className="field">
              <span>{nm[weaker]}'s Form for right answers</span>
              <div className="seg small" role="radiogroup" aria-label="Form boost">
                {FORM_BOOSTS.map((b) => (
                  <button key={b} type="button" role="radio" aria-checked={value.formBoost === b} className={value.formBoost === b ? "on" : ""} onClick={() => set({ formBoost: b })}>
                    x{b}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="hc-summary">{summary || "No handicap yet: pick a piece or a Form boost."}</p>
        </>
      )}
    </div>
  );
}
