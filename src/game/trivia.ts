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

/** Before each player had their own list, everyone on the device shared this one. */
const LEGACY_SEEN_KEY = "cft.seen.v1";
const SEEN_PREFIX = "cft.seen.v2.";

/** The storage key for a player's seen list: names match ignoring case and spaces. */
export function seenKey(player: string): string {
  return SEEN_PREFIX + (player.trim().toLowerCase().replace(/\s+/g, " ") || "player");
}

const stores = new Map<string, SeenStore>();

/**
 * Seen question ids for one player, kept in browser storage so their questions
 * don't repeat between games. Each player name has its own list. The first
 * player to play after the update takes over the old shared list.
 */
export function browserSeenStore(player = "Player 1", storage: Storage | undefined = globalThis.localStorage): SeenStore {
  const key = seenKey(player);
  const cached = stores.get(key);
  if (cached) return cached;
  let ids = new Set<string>();
  try {
    let raw = storage?.getItem(key) ?? null;
    if (raw === null) {
      raw = storage?.getItem(LEGACY_SEEN_KEY) ?? null;
      if (raw !== null) { storage?.setItem(key, raw); storage?.removeItem(LEGACY_SEEN_KEY); }
    }
    ids = new Set(JSON.parse(raw ?? "[]") as string[]);
  } catch { /* private browsing: forget between games */ }
  const save = () => { try { storage?.setItem(key, JSON.stringify([...ids])); } catch { /* ignore */ } };
  const store: SeenStore = {
    has: (id) => ids.has(id),
    add: (id) => { ids.add(id); save(); },
    delete: (id) => { ids.delete(id); save(); },
  };
  stores.set(key, store);
  return store;
}

export function memorySeenStore(): SeenStore {
  return new Set<string>();
}

function pick<T>(list: T[], rng: Rng): T {
  return list[Math.floor(rng() * list.length)];
}

/**
 * A copy of the question with its options in a fresh random order (Fisher-Yates)
 * and `answer` pointing at the right one's new place, so the right answer isn't
 * always the same letter for the same question. The bank itself is left untouched.
 */
export function shuffleOptions(q: Question, rng: Rng = Math.random): Question {
  const order = q.options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { ...q, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer) };
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
   * Three cards, one of each difficulty, from the whole bank; about one deal in three
   * swaps a card for a club card. Hot Spots deal the same way, so their questions come
   * from the full bank and can't be learned by heart.
   */
  deal(club: string | null): Card[] {
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

  /** Draws an unseen question for a card, options shuffled. When a pool runs out it starts again. */
  draw(card: Card): Question {
    const pool = this.poolFor(card);
    let fresh = pool.filter((q) => !this.seen.has(q.id));
    if (!fresh.length) {
      for (const q of pool) this.seen.delete(q.id);
      fresh = pool;
    }
    const q = pick(fresh, this.rng);
    this.seen.add(q.id);
    return shuffleOptions(q, this.rng);
  }

  /** A random general question of this difficulty (shootouts and promotion fallbacks). */
  any(difficulty: Difficulty): Question {
    return this.draw(this.generalCard(difficulty, []));
  }
}

export const TIMER_MS = { normal: 10_000, puskas: 8_000 };
