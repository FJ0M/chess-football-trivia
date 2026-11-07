// How a bot picks a question card and "answers" it.

import type { Rng } from "./movePicker";
import type { AnswerRequest, AnswerResult, BotProfile, CardChoice, CardRequest, TriviaSkill } from "./types";


function weightedIndex(weights: number[], rng: Rng): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

export function chooseCard(profile: BotProfile, skill: TriviaSkill, req: CardRequest, rng: Rng): CardChoice {
  const { cards } = req;
  if (cards.length === 0) return { index: 0, puskas: false };

  // Ryan: always goes Hard on a card about his own club (doc: "always Hard on a West Ham card").
  if (profile.id === "ryan") {
    const own = cards.findIndex((c) => c.club === profile.club && c.difficulty === "hard");
    if (own >= 0) return { index: own, puskas: req.puskasAllowed && rng() < skill.puskasRate * 2 };
  }

  const weights = cards.map((c) => {
    let w = skill.cardWeights[c.difficulty];
    // Everyone fancies a question on their own club a bit more.
    if (c.club === profile.club) w *= 1.5;
    // Well ahead on the board: no need to risk a freeze or a lost turn.
    if ((req.evalCp ?? 0) > 400 && c.difficulty === "hard") w *= 0.4;
    return w;
  });
  const index = weightedIndex(weights, rng);
  const pick = cards[index];
  const puskas = req.puskasAllowed && pick.difficulty === "hard" && rng() < skill.puskasRate;
  return { index, puskas };
}

export function answerChance(profile: BotProfile, skill: TriviaSkill, req: AnswerRequest): number {
  const q = req.question;
  const base = req.puskas ? skill.accuracy.puskas : skill.accuracy[q.difficulty];
  if (q.club && q.club === profile.club) return Math.max(base, skill.ownClubAccuracy - (req.puskas ? 0.1 : 0));
  return base;
}

export function answerQuestion(profile: BotProfile, skill: TriviaSkill, req: AnswerRequest, rng: Rng): AnswerResult {
  const q = req.question;
  const removed = new Set(req.removed ?? []);
  const open = q.options.map((_, i) => i).filter((i) => !removed.has(i));
  const right = rng() < answerChance(profile, skill, req);
  let choice = q.answer;
  if (!right) {
    // After a 50:50 the bot guesses between what's left; otherwise it's just wrong.
    const pool = removed.size > 0 ? open : open.filter((i) => i !== q.answer);
    if (pool.length) choice = pool[Math.floor(rng() * pool.length)];
  }
  const [lo, hi] = skill.answerMs;
  // Harder questions take a bit longer; Puskás goals have 8 s so the bot hurries.
  const scale = req.puskas ? 0.55 : q.difficulty === "hard" ? 1.1 : q.difficulty === "easy" ? 0.85 : 1;
  const delayMs = Math.round((lo + rng() * (hi - lo)) * scale);
  return { choice, delayMs };
}
