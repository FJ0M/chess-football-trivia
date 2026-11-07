// "Who am I?" clue sets for pawn promotion (data/whoami.json, built by tools/build_whoami.py).

import type { Rng } from "./rules";
import type { SeenStore } from "./trivia";

export interface WhoAmI {
  id: string;
  clues: string[];
  options: string[];
  answer: number;
  club: string | null;
  verified: boolean;
  source?: string;
}

/** Seconds before the next clue shows on its own. */
export const CLUE_MS = 6000;

export class WhoAmIBank {
  constructor(private sets: WhoAmI[], private seen: SeenStore, private rng: Rng = Math.random) {
    this.sets = sets.filter((s) => s.verified && s.clues.length === 5);
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
