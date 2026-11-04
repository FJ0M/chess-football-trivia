// Trash talk. PLACEHOLDER LINES: the real Freddie, Ryan and Ollie will replace
// these with their own catchphrases. Edit freely; each moment needs at least one line.
// `{club}` is swapped for the bot's club name.

import type { Rng } from "./movePicker";
import type { BotId, TalkMoment } from "./types";

export const TALK: Record<BotId, Record<TalkMoment, string[]>> = {
  ollie: {
    start: [
      "Chess is just the bit between the questions.",
      "Ask me anything. Except how the horse moves.",
      "I've revised. Not the chess bit, obviously.",
    ],
    capture: [
      "Is the horse allowed to do that? Too late now.",
      "Mine now. No VAR on this one.",
      "Didn't see that coming, did you. Neither did I.",
    ],
    lostPiece: ["I was going to lose that anyway.", "Tactical sacrifice. Look it up.", "That's fine. I'll win it back in the quiz."],
    oppWrong: [
      "Genuinely, how did you not know that?",
      "That's a pub quiz warm-up question, mate.",
      "Wow. Do you even watch football?",
    ],
    ownRight: ["Too easy.", "Next.", "Could do these in my sleep.", "Ask me a hard one."],
    ownWrong: ["That was a trick question, I'm appealing.", "The question's wrong, not me.", "Fine. One off the bar."],
    powerUp: ["Bailout time.", "Nothing in the rules against it.", "Spent wisely. Probably."],
    hotSpot: ["{club} round? Easiest Form of my life.", "Bonus round. Fill your boots, Ollie."],
    win: ["Brains over board, every time.", "Quiz wins games.", "Don't know how, don't care."],
    loss: ["I won the quiz though.", "Rematch. Fewer pieces this time, more questions.", "Chess is a silly game anyway."],
  },
  ryan: {
    start: ["Come on you Irons. Let's have it.", "Right then. Board and brains, let's go.", "Hope you've done your homework."],
    capture: ["Bowen, Prague, 2023. Same energy.", "Have that.", "Nice of you to leave that there."],
    lostPiece: ["Fair enough.", "Just a flesh wound.", "Taking one for the team."],
    oppWrong: ["Even Freddie knew that one.", "Oof. Not your round.", "Should've gone easy."],
    ownRight: ["Get in.", "Lovely stuff.", "Bread and butter."],
    ownWrong: ["Wasn't a {club} question, was it.", "That one's on the ref.", "Knew it, honestly. Misclicked."],
    powerUp: ["Bit of gamesmanship never hurt.", "Professional foul. Worth it.", "Off you go."],
    hotSpot: ["Bubbles are flying!", "{club} round. My house.", "Irons time."],
    win: ["Forever blowing bubbles, mate.", "Back of the net.", "Comfortable in the end."],
    loss: ["You got lucky with the questions.", "Fair play. Rematch?", "Typical {club}, honestly."],
  },
  freddie: {
    start: ["You can have the quiz. I'll have the board.", "Questions are optional. Checkmate isn't.", "Let's keep it simple."],
    capture: ["Thanks for that. Didn't even need a hint.", "Free piece. Cheers.", "That was hanging for a while."],
    lostPiece: ["Calculated.", "I'll take the endgame.", "Hm. Noted."],
    oppWrong: ["Finally, someone worse at this than me.", "See? Nobody knows these.", "Welcome to my world."],
    ownRight: ["Wait, really? Nice.", "Even a stopped clock.", "I'll take it."],
    ownWrong: ["Football's a distraction. Mate in four, anyway.", "Who even remembers that.", "Doesn't matter. Look at the board."],
    powerUp: ["Been saving that.", "Patience pays.", "Here's what the Form was for."],
    hotSpot: ["Oh no. Not the bonus round.", "Can we skip this bit?", "Do they ever ask about {club}?"],
    win: ["Should have spent less time on the questions.", "Good game. The board doesn't lie.", "Endgames win games."],
    loss: ["Lost it in the quiz.", "Good game. I'm blaming the questions.", "Rematch. No trivia this time."],
  },
};

/** Says something now and then: at most once every `gapMoves` bot moves, and big moments always get a line. */
export class Talker {
  private lastSaidAt = -Infinity;
  private moves = 0;
  private recent: string[] = [];

  constructor(
    private bot: BotId,
    private clubName: string,
    private rng: Rng,
    private gapMoves = 2,
  ) {}

  /** Call once per bot move so the rate limit can count moves. */
  tickMove(): void {
    this.moves++;
  }

  say(moment: TalkMoment): string | null {
    const always = moment === "start" || moment === "win" || moment === "loss" || moment === "hotSpot";
    if (!always && this.moves - this.lastSaidAt < this.gapMoves) return null;
    if (!always && this.rng() < 0.35) return null; // not every moment needs a word
    const lines = TALK[this.bot][moment];
    const fresh = lines.filter((l) => !this.recent.includes(l));
    const pool = fresh.length ? fresh : lines;
    const line = pool[Math.floor(this.rng() * pool.length)];
    this.recent = [line, ...this.recent].slice(0, 6);
    this.lastSaidAt = this.moves;
    return line.split("{club}").join(this.clubName);
  }
}
