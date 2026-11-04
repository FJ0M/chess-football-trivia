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

  /** A club set when the promotion square was a Hot Spot and the club has one; otherwise a general set. */
  draw(club: string | null, bonus: boolean): WhoAmI {
    const clubSets = bonus && club ? this.sets.filter((s) => s.club === club) : [];
    const pool = clubSets.length ? clubSets : this.sets.filter((s) => !s.club || s.club === club);
    let fresh = pool.filter((s) => !this.seen.has(s.id));
    if (!fresh.length) { for (const s of pool) this.seen.delete(s.id); fresh = pool; }
    const s = fresh[Math.floor(this.rng() * fresh.length)];
    this.seen.add(s.id);
    return s;
  }
}
