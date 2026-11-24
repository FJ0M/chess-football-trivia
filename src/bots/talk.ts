// Trash talk. Edit freely; each moment needs at least one line.
// `{club}` is swapped for the bot's club name.

import type { Rng } from "./movePicker";
import type { BotId, TalkMoment } from "./types";

export const TALK: Record<BotId, Record<TalkMoment, string[]>> = {
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
  lenny: {
    start: ["Right. Get it in the mixer.", "No fancy stuff. Up and at 'em.", "Wet Tuesday at the Britannia. My kind of game."],
    capture: ["Won the header.", "Route one. Works every time.", "Knock-down, knock-out."],
    lostPiece: ["Lost the second ball.", "He's gone over the top of me.", "Get rid! GET RID!"],
    oppWrong: ["Should've just hoofed it.", "Overthinking it, son.", "That's what passing gets you."],
    ownRight: ["Back of the net.", "Simple game, football.", "Never in doubt."],
    ownWrong: ["Skied it.", "Into Row Z, that one.", "Wind took it."],
    powerUp: ["Long throw coming.", "Towel's out.", "Everyone in the box."],
    hotSpot: ["Hot Spot! Get the big lads forward.", "Stoke questions. Bring the rain.", "Set piece. My time."],
    win: ["Didn't need a passing game, did I?", "Ugly win. Best kind.", "Three points, no nonsense."],
    loss: ["Too much tippy-tappy for me.", "Should've gone longer.", "We go again Saturday."],
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
  sal: {
    start: ["Gloves on. Nothing's going past me.", "Clean sheet's the only target.", "I'll be on my line if you need me."],
    capture: ["Claimed it.", "Mine. Keeper's ball.", "Read that cross a mile off."],
    lostPiece: ["Who's marking? Talk to me!", "Wall wasn't set.", "Unsaveable, that."],
    oppWrong: ["Straight at the keeper.", "Tipped over the bar.", "Saved. Next."],
    ownRight: ["Safe hands.", "Held on to it.", "Comfortable save."],
    ownWrong: ["Through my legs.", "Spilled it.", "Got a glove to it, not enough."],
    powerUp: ["Organising the back line.", "Time to waste some time.", "Check the replay, ref."],
    hotSpot: ["Hot Spot. Up the Albion!", "Seagulls question. Easy catch.", "Amex on a Saturday. Bring it."],
    win: ["Clean sheet. Job done.", "Nothing got through.", "Keepers win games too."],
    loss: ["Left exposed again.", "Back four went missing.", "Not my fault. Mostly."],
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
  barry: {
    start: ["I'm forever blowing bubbles...", "Come on you Irons!", "Upton Park, '96 to now. I've seen it all, mate."],
    capture: ["GET IN THERE!", "Pretty bubbles in the air!", "Off the bar and in, that's West Ham."],
    lostPiece: ["Typical West Ham.", "Oh, here we go again.", "That's the Hammers, that."],
    oppWrong: ["Even my nan knew that one.", "You're not singing anymore!", "Have a word with yourself."],
    ownRight: ["Proper ball knowledge.", "Season ticket, innit.", "Twenty-odd years in the stands, that is."],
    ownWrong: ["My memory's gone, all the singing.", "That's the pint talking.", "Fortune's always hiding."],
    powerUp: ["Bubble machine on!", "Everyone forward, never mind the back.", "Irons in the fire."],
    hotSpot: ["Hot Spot! Ask me about West Ham, go on.", "Claret and blue questions. My manor.", "Prague, 2023. I was there."],
    win: ["We won! Get the kettle on!", "Bubbles in the air, mate.", "Proper Hammers performance."],
    loss: ["Classic West Ham. We go again.", "They fade and die, don't they.", "Still love 'em."],
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
