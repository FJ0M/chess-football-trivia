// The question bank: dealing the three cards, drawing questions that haven't been
// seen yet, and the trivia hints.

import { clubShort } from "./clubs";
import type { Difficulty, Question } from "./types";
import type { Rng } from "./rules";

export interface Card {
  topic: string;
  difficulty: Difficulty;
  /** Set for a card about a club. */
  club: string | null;
}

/** A club needs this many verified questions at a difficulty before its cards are used. */
export const THIN_CLUB = 10;
const DIFFS: Difficulty[] = ["easy", "medium", "hard"];

export interface SeenStore {
  has(id: string): boolean;
  add(id: string): void;
  delete(id: string): void;
}

const SEEN_KEY = "cft.seen.v1";

/** Seen question ids, kept in browser storage so questions don't repeat between games. */
export function browserSeenStore(): SeenStore {
  let ids = new Set<string>();
  try {
    ids = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[]);
  } catch { /* private browsing: forget between games */ }
  const save = () => { try { localStorage.setItem(SEEN_KEY, JSON.stringify([...ids])); } catch { /* ignore */ } };
  return {
    has: (id) => ids.has(id),
    add: (id) => { ids.add(id); save(); },
    delete: (id) => { ids.delete(id); save(); },
  };
}

export function memorySeenStore(): SeenStore {
  return new Set<string>();
}

function pick<T>(list: T[], rng: Rng): T {
  return list[Math.floor(rng() * list.length)];
}

export class QuestionBank {
  private general = new Map<Difficulty, Map<string, Question[]>>();
  private clubs = new Map<string, Map<Difficulty, Question[]>>();

  constructor(questions: Question[], private seen: SeenStore = memorySeenStore(), private rng: Rng = Math.random) {
    for (const d of DIFFS) this.general.set(d, new Map());
    for (const q of questions) {
      if (!q.verified) continue;
      if (q.club) {
        const byDiff = this.clubs.get(q.club) ?? new Map<Difficulty, Question[]>();
        byDiff.set(q.difficulty, [...(byDiff.get(q.difficulty) ?? []), q]);
        this.clubs.set(q.club, byDiff);
      } else {
        const byTopic = this.general.get(q.difficulty)!;
        byTopic.set(q.topic, [...(byTopic.get(q.topic) ?? []), q]);
      }
    }
  }

  /** True when the club has enough questions at this difficulty for its own cards. */
  hasClub(club: string | null, difficulty: Difficulty): boolean {
    return !!club && (this.clubs.get(club)?.get(difficulty)?.length ?? 0) >= THIN_CLUB;
  }

  /** True when a general topic still has a question this player hasn't seen. */
  private topicHasFresh(difficulty: Difficulty, topic: string): boolean {
    return (this.general.get(difficulty)!.get(topic) ?? []).some((q) => !this.seen.has(q.id));
  }

  /**
   * A general card. Topics are weighted by how many unseen questions they have
   * left, so small topics don't come round again and again with the same question.
   */
  private generalCard(difficulty: Difficulty, avoid: string[]): Card {
    const byTopic = this.general.get(difficulty)!;
    const all = [...byTopic.keys()];
    const fresh = (ts: string[]) => ts.filter((t) => this.topicHasFresh(difficulty, t));
    let topics = fresh(all.filter((t) => !avoid.includes(t)));
    if (!topics.length) topics = fresh(all);
    if (!topics.length) {
      // Every question at this difficulty has been seen: start the whole difficulty again.
      for (const q of [...byTopic.values()].flat()) this.seen.delete(q.id);
      topics = all.filter((t) => !avoid.includes(t));
      if (!topics.length) topics = all;
    }
    const weights = topics.map((t) => byTopic.get(t)!.filter((q) => !this.seen.has(q.id)).length);
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.rng() * total;
    for (let i = 0; i < topics.length; i++) {
      r -= weights[i];
      if (r < 0 && weights[i] > 0) return { topic: topics[i], difficulty, club: null };
    }
    return { topic: pick(topics, this.rng), difficulty, club: null };
  }

  private clubCard(club: string, difficulty: Difficulty): Card {
    return { topic: clubShort(club), difficulty, club };
  }

  /**
   * Three cards, one of each difficulty. A bonus round makes all three about the
   * player's club; otherwise about one deal in three swaps a card for a club card.
   */
  deal(club: string | null, bonus: boolean): Card[] {
    if (bonus) {
      return DIFFS.map((d) => (this.hasClub(club, d) ? this.clubCard(club!, d) : this.generalCard(d, [])));
    }
    const cards: Card[] = [];
    for (const d of DIFFS) cards.push(this.generalCard(d, cards.map((c) => c.topic)));
    if (club && this.rng() < 1 / 3) {
      const i = Math.floor(this.rng() * 3);
      if (this.hasClub(club, cards[i].difficulty)) cards[i] = this.clubCard(club, cards[i].difficulty);
    }
    return cards;
  }

  private poolFor(card: Card): Question[] {
    if (card.club && this.hasClub(card.club, card.difficulty)) return this.clubs.get(card.club)!.get(card.difficulty)!;
    const byTopic = this.general.get(card.difficulty)!;
    return byTopic.get(card.topic) ?? [...byTopic.values()].flat();
  }

  /** Draws an unseen question for a card. When a pool runs out it starts again. */
  draw(card: Card): Question {
    const pool = this.poolFor(card);
    let fresh = pool.filter((q) => !this.seen.has(q.id));
    if (!fresh.length) {
      for (const q of pool) this.seen.delete(q.id);
      fresh = pool;
    }
    const q = pick(fresh, this.rng);
    this.seen.add(q.id);
    return q;
  }

  /** A random general question of this difficulty (shootouts and promotion fallbacks). */
  any(difficulty: Difficulty): Question {
    return this.draw(this.generalCard(difficulty, []));
  }
}

// ---------------------------------------------------------------- trivia hints

/** 50:50: the two wrong options to hide. */
export function fiftyFifty(q: Question, rng: Rng = Math.random): number[] {
  const wrong = q.options.map((_, i) => i).filter((i) => i !== q.answer);
  const keep = pick(wrong, rng);
  return wrong.filter((i) => i !== keep);
}

/** Ask the Crowd: vote percentages; the crowd's favourite is right about 65% of the time. */
export function askTheCrowd(q: Question, rng: Rng = Math.random, hidden: number[] = []): number[] {
  const live = q.options.map((_, i) => i).filter((i) => !hidden.includes(i));
  const favourite = rng() < 0.65 ? q.answer : pick(live.filter((i) => i !== q.answer), rng) ?? q.answer;
  const weights = q.options.map((_, i) => (hidden.includes(i) ? 0 : i === favourite ? 45 + rng() * 25 : 5 + rng() * 15));
  const total = weights.reduce((a, b) => a + b, 0);
  const pct = weights.map((w) => Math.round((w / total) * 100));
  // Make it add up to 100.
  pct[favourite] += 100 - pct.reduce((a, b) => a + b, 0);
  return pct;
}

/** Phone a friend: the option they suggest, right about 80% of the time. */
export function phoneAFriend(q: Question, rng: Rng = Math.random, hidden: number[] = []): number {
  if (rng() < 0.8) return q.answer;
  const wrong = q.options.map((_, i) => i).filter((i) => i !== q.answer && !hidden.includes(i));
  return wrong.length ? pick(wrong, rng) : q.answer;
}

/** Question timers. The chess clock keeps running during questions, so these are short. */
export const TIMER_MS = { normal: 10_000, puskas: 8_000 };
