// Trash talk. Ollie, Ryan and Freddie's lines are PLACEHOLDERS: the real three will replace
// them with their own catchphrases. Edit freely; each moment needs at least one line.
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
    hotSpot: ["Hot Spot? Easiest Form of my life.", "Question time. Fill your boots, Ollie."],
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
    hotSpot: ["Bubbles are flying!", "Hot Spot. My house.", "Irons time."],
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
    hotSpot: ["Oh no. Not a Hot Spot.", "Can we skip this bit?", "Another question? Fine."],
    win: ["Should have spent less time on the questions.", "Good game. The board doesn't lie.", "Endgames win games."],
    loss: ["Lost it in the quiz.", "Good game. I'm blaming the questions.", "Rematch. No trivia this time."],
  },
  // The Elo ladder. Made-up characters, so these lines are theirs to keep.
  pawny: {
    start: ["Shinpads on. Which way are we kicking?", "My mum's watching, go easy.", "I've had a Capri Sun. I'm ready."],
    capture: ["GOT ONE! Is that allowed?", "Mine! Like a loose ball in the box.", "Tackle of the season, that."],
    lostPiece: ["Where's he gone?", "Oi, ref!", "I didn't even see him there."],
    oppWrong: ["Even I knew that one. I think.", "Ha! Wait, what was the answer?", "Unlucky, mate."],
    ownRight: ["Get IN!", "Did I get it? I got it!", "Straight in the top bin."],
    ownWrong: ["I was thinking of a different player.", "My dad said that one.", "Can I have another go?"],
    powerUp: ["Pressed a button. Hope it's a good one.", "Ooh, shiny.", "Magic boots, activate!"],
    hotSpot: ["Is this the bit where I score?", "Hot Spot! Is that like extra time?", "Ooh, a question! I know this one. Probably."],
    win: ["I WON? Someone film this!", "Dad! DAD! I won!", "Sunday league to the big time."],
    loss: ["Still had fun.", "Orange slices at half time though.", "Next week. Definitely next week."],
  },
  eezy: {
    start: ["Easy, easy. Let's dance.", "Hope your full-back's had a nap.", "Flair over fear, always."],
    capture: ["Nutmeg. Easy peasy.", "Skipped past that one.", "That's going on my highlight reel."],
    lostPiece: ["Tracking back's not my job.", "The gaffer will sort the defence.", "Worth it for the skill."],
    oppWrong: ["Easy peasy, you said? Not that easy.", "Come on, that was a tap-in.", "Never mind, you've still got the board."],
    ownRight: ["Easy peasy.", "Too smooth.", "Like a stroll in the park."],
    ownWrong: ["Showboated that one.", "Overcooked it.", "Bit too much flair."],
    powerUp: ["Trick in the locker.", "Watch this one.", "Rainbow flick incoming."],
    hotSpot: ["Hot Spot! Selhurst's rocking.", "Home crowd, big questions.", "This is my stage."],
    win: ["Easy peasy, lemon squeezy.", "Flair wins games.", "Told you I'd dance through."],
    loss: ["Still the best-looking moves out there.", "Got carried away going forward.", "Defending's overrated. Mostly."],
  },
  chillwall: {
    start: ["Keep it tight. Nil-nil is a good result.", "No one gets past me today.", "Sit deep, stay calm."],
    capture: ["Read it all the way.", "Interception. Easy.", "Shouldn't have come down my side."],
    lostPiece: ["That's a foul, surely.", "Hm. Need to drop deeper.", "I'll get the bus out."],
    oppWrong: ["Patience pays.", "Another clean sheet in the quiz.", "That's what pressure does."],
    ownRight: ["Solid.", "Job done.", "Nothing flashy, just right."],
    ownWrong: ["Got caught upfield.", "Should've stayed in my lane.", "Even the best walls crack."],
    powerUp: ["Bus parked.", "Time to frustrate you.", "Shutting up shop."],
    hotSpot: ["Hot Spot. Stamford Bridge, chill vibes.", "Home comforts.", "A rare venture forward."],
    win: ["One-nil to the wall.", "Defence wins titles.", "Chilled the whole way."],
    loss: ["Breached. It happens.", "Too many came forward.", "Back to the training ground."],
  },
  "gambit-gary": {
    start: ["Lovely evening for it. Let's see what you've got.", "I've seen every game since '92. Every one.", "Take the pawn. Go on. I insist."],
    capture: ["Textbook. Shows you at the coaching badge.", "That's what we call a mistake, folks.", "Schoolboy defending."],
    lostPiece: ["All part of the gambit.", "Classic sacrifice, the sort you see on a wet night in Stoke.", "I meant that. Mostly."],
    oppWrong: ["Oh dear. Should've done your homework.", "That's a stat I'd expect any fan to know.", "Ooh, I'm surprised at you."],
    ownRight: ["Elementary.", "Did I mention I've seen every game?", "Pundit's privilege."],
    ownWrong: ["They've changed the records since I checked.", "I'll have to look at the replay on that.", "Even I miss one a season."],
    powerUp: ["Tactical tweak at the break.", "That's the experience talking.", "You won't have seen this one."],
    hotSpot: ["Hot Spot! 5000-to-1, I was there.", "Ask me anything. Go on.", "My specialist subject."],
    win: ["Experience. You can't coach it.", "Gambit accepted, game over.", "Back to the studio."],
    loss: ["Good game. I'll say so on the show.", "You've done your research, credit to you.", "Bit of a shock, that."],
  },
  "mo-mate": {
    start: ["Salam. Let's play.", "Cut inside, curl it in. Simple.", "The king of the right side."],
    capture: ["Cut in and finished.", "Too quick for you.", "One more for the record books."],
    lostPiece: ["Calm. I will come back.", "No problem, next chance.", "A small setback."],
    oppWrong: ["Close one. Keep going.", "Hard luck, my friend.", "It happens."],
    ownRight: ["Easy finish.", "Smile and celebrate.", "In off the post."],
    ownWrong: ["The keeper got a hand to it.", "Next one goes in.", "Unlucky."],
    powerUp: ["Time for some magic.", "A little skill now.", "Watch the run."],
    hotSpot: ["Hot Spot. You'll never walk alone.", "Anfield is singing.", "My kind of question."],
    win: ["Checkmate. The king has spoken.", "Thank you. Good game.", "Another trophy for the cabinet."],
    loss: ["Good game, my friend.", "You played well. Rematch soon.", "We go again."],
  },
  knightingale: {
    start: ["Steady pulse, steady hands. Let's begin.", "I'll take care of this.", "Small edges, long games."],
    capture: ["A clean operation.", "That needed removing.", "Neat and tidy."],
    lostPiece: ["A flesh wound.", "I'll patch that up.", "Recovery is part of the job."],
    oppWrong: ["Don't worry, it's treatable.", "Take a deep breath.", "We'll get there."],
    ownRight: ["Diagnosis: correct.", "Calm and correct.", "Exactly as expected."],
    ownWrong: ["Second opinion, please.", "Hm. Misread the chart.", "I'll note that one."],
    powerUp: ["Prescribed.", "Just what the doctor ordered.", "Precise intervention."],
    hotSpot: ["Hot Spot. The Toffees need me.", "Grand Old Team, big old questions.", "A home visit."],
    win: ["The patient did not survive.", "Patience is a virtue.", "Small edges add up."],
    loss: ["Lost the patient. It happens.", "Well played. I'll recover.", "A long night on the ward."],
  },
  rookland: {
    start: ["I score. You lose. Simple.", "Ready. Hungry.", "Nothing to say. Only goals."],
    capture: ["Goal.", "Another one.", "Hungry."],
    lostPiece: ["Doesn't matter. Next chance.", "Hm.", "I'll score more."],
    oppWrong: ["Quiz not important. Board important.", "Ok.", "Next."],
    ownRight: ["Yes!", "Lucky. I'll take it.", "Even a robot gets one."],
    ownWrong: ["Football is for playing, not remembering.", "I don't watch. I score.", "Don't care. Look at the board."],
    powerUp: ["Power.", "Machine mode.", "Now I go."],
    hotSpot: ["Hot Spot? I just got here.", "Questions again. Ugh.", "I'll guess."],
    win: ["Goal machine.", "Easy. Next.", "Hat-trick of wins."],
    loss: ["Hm. Not good enough.", "I train more.", "Next time I score more."],
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
