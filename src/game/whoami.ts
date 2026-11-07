// "Who am I?" clue sets for pawn promotion (data/whoami.json, built by tools/build_whoami.py).

import type { Rng } from "./rules";
import type { SeenStore } from "./trivia";

export interface WhoAmI {
  id: string;
  clues: string[];
  options: string[];
  answer: number;
  /** The player's name as shown (options[answer]). */
  name?: string;
  /** Other accepted answers (nicknames, spellings). */
  aliases?: string[];
  club: string | null;
  verified: boolean;
  source?: string;
}

/** Time before the next clue shows on its own (the chess clock is paused meanwhile). */
export const CLUE_MS = 12000;

const FOLD: Record<string, string> = { ø: "o", æ: "ae", œ: "oe", ß: "ss", đ: "d", ð: "d", ł: "l", þ: "th", ı: "i" };

/** Lower case, accents and punctuation stripped, spaces squashed: "Ødegaard" -> "odegaard", "N'Golo Kanté" -> "ngolo kante". */
export function normaliseName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[øæœßđðłþı]/g, (c) => FOLD[c])
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/['’`.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length];
}

/** Typos allowed for an answer of this length: none up to 3 letters, 1 up to 6, then 2. */
const typosAllowed = (len: number) => (len <= 3 ? 0 : len <= 6 ? 1 : 2);

/** Every accepted form of the answer: full name, surname (everything after the first name, and the last word), aliases. */
export function acceptedAnswers(set: WhoAmI): string[] {
  const name = set.name ?? set.options[set.answer];
  const words = normaliseName(name).split(" ");
  const out = new Set([words.join(" "), words.slice(1).join(" "), words[words.length - 1], ...(set.aliases ?? []).map(normaliseName)]);
  out.delete("");
  return [...out];
}

/**
 * Is a typed guess right? Ignores capitals, accents, spaces and hyphens, and allows a typo or two.
 * `otherPlayers` are names of other footballers (the decoys, other sets): typing one of those
 * exactly is wrong even if it's a typo away (so "Kane" doesn't pass for Kanté).
 */
export function isRightGuess(set: WhoAmI, typed: string, otherPlayers: string[] = []): boolean {
  const guess = normaliseName(typed).replace(/ /g, "");
  if (!guess) return false;
  const mine = acceptedAnswers(set).map((a) => a.replace(/ /g, ""));
  if (mine.includes(guess)) return true;
  const decoy = [...otherPlayers, ...set.options.filter((_, i) => i !== set.answer)]
    .flatMap((n) => acceptedAnswers({ ...set, name: n, aliases: [] }))
    .map((a) => a.replace(/ /g, ""));
  if (decoy.includes(guess)) return false;
  return mine.some((a) => {
    return editDistance(guess, a) <= typosAllowed(a.length);
  });
}

export class WhoAmIBank {
  constructor(private sets: WhoAmI[], private seen: SeenStore, private rng: Rng = Math.random) {
    this.sets = sets.filter((s) => s.verified && s.clues.length === 5);
  }

  /** Checks a typed guess against the set, treating every other player in the bank as a wrong answer. */
  check(set: WhoAmI, typed: string): boolean {
    const others = this.sets.filter((s) => s.id !== set.id).map((s) => s.name ?? s.options[s.answer]);
    return isRightGuess(set, typed, others);
  }

  /** Chance of a Club Bonus "Who am I?" (a set about your own club) when your club has any. Hot Spots never sit on the promotion ranks, so it can't hang off them. */
  static CLUB_CHANCE = 0.5;

  /** A club set (forced by `bonus`, otherwise half the time when the club has sets), else a general set. */
  draw(club: string | null, bonus = false): WhoAmI {
    const wantClub = bonus || this.rng() < WhoAmIBank.CLUB_CHANCE;
    const clubSets = wantClub && club ? this.sets.filter((s) => s.club === club) : [];
    const pool = clubSets.length ? clubSets : this.sets.filter((s) => !s.club || s.club === club);
    let fresh = pool.filter((s) => !this.seen.has(s.id));
    if (!fresh.length) { for (const s of pool) this.seen.delete(s.id); fresh = pool; }
    const s = fresh[Math.floor(this.rng() * fresh.length)];
    this.seen.add(s.id);
    return s;
  }
}
