# Chess Football Trivia: Game Design

Nov 4, 2026 · Freddie Martin

> Living version: [Claude Doc](https://claude.ai/artifact/241R9Ua8TD4wYkUo9GEswQ). This file is a snapshot of it.

## Summary

Chess is played normally, and football questions pop up along the way. A right answer earns **Form**, which you spend on power-ups and hints. A wrong answer can cost you, and how much depends on the question you picked: easy questions are safe, hard ones pay more but can freeze a piece or cost a turn.

This builds on the [research doc](https://claude.ai/artifact/288D72mj429RgxhCALFLa8) and Freddie's answers to the planning questions:

| Decision | Choice |
| --- | --- |
| When trivia comes up | A mix: a regular cadence, captures, and special squares |
| Wrong answers | Penalty scales with the difficulty you chose |
| Modes | vs bots, and two players on one device |
| Questions | Whole Premier League from 2000/01, with West Ham bonus rounds |
| Power-ups | Chess-style and football-themed |
| Bots | Freddie, Ryan and Ollie, each with a strength, a style and trash talk |
| Tech | Installable web app (PWA), one link for phone, tablet and computer |

All numbers below (Form costs, timers, bot accuracy) are first guesses to tune in playtesting.

## Modes and winning

There are two ways to play, and both use the same rules.

- **vs Bot.** Pick Freddie, Ryan or Ollie. You answer questions yourself; the bot "answers" using its trivia profile and talks trash throughout.
- **Pass and Play.** Two people on one device. Whoever triggered the question answers it, and the other player hands over the device without peeking (honour system, as at the pub).

Each game also has a **Plain Chess** toggle (no trivia) and a **Timed** toggle (10 minutes each), so it works for a quick game or a serious one.

**Winning.** Checkmate wins, as normal. Resigning is allowed. A draw of any kind (stalemate, repetition, 50 moves, agreement) goes to a **Penalty Shootout**: five questions each, alternating, best score wins, sudden death if level. Rules that only exist because of power-ups are listed with each power-up below; nothing can capture or remove a king or queen directly.

## When trivia comes up

A question appears straight after a move that triggers one, and the player who made that move answers it. There is at most one question per move, which works out to roughly one every two or three of your moves.

| Trigger | Fires when | Question type |
| --- | --- | --- |
| Hot Spot | You land on one of 4 marked squares (a football icon) | **West Ham Bonus Round**: West Ham questions, double Form |
| Capture | You take a piece | Normal pick of three cards |
| Kick-off | Every 3rd move you make with no other question | Normal pick of three cards |

If a move hits two triggers, the higher one in the table wins. The Kick-off counter resets whenever you get a question, so captures don't stack extra questions on top.

**Hot Spots.** Four squares on ranks 3 to 6 are picked at random each game, two on each half of the board. Once a Hot Spot is used it moves to a new random empty square, so nobody can camp on one. Ryan gets his West Ham edge here, and so does anyone brave enough to take him on at it.

**A turn, step by step:**

1. Optionally spend Form on one power-up.
2. Make your chess move.
3. If the move triggers a question, pick a card and answer it (15 second timer).
4. Form is added, or the penalty is applied, and play passes to the opponent.

## Choosing a question: risk and reward

You pick your own question, and the harder it is, the more you win and the more you risk. Each trigger deals three face-down cards showing only a topic and a difficulty, for example "Managers · Easy", "Transfers · Medium", "West Ham · Hard". One card of each difficulty is dealt, with random topics. A **Go for a Worldie** button turns the Hard card into a Worldie.

| Difficulty | Timer | Right answer | Wrong answer or time out |
| --- | --- | --- | --- |
| Sunday League (easy) | 15 s | +1 Form | Nothing, you just miss out |
| Championship (medium) | 15 s | +2 Form | Opponent gets +2 Form ("scored on the break") |
| Premier League (hard) | 15 s | +4 Form | **Booked**: the piece you just moved is frozen for your next turn |
| Worldie (hard, no hints) | 8 s | +6 Form | **Sent off**: you lose your next turn, and the opponent gets a Free Kick |

**Extras on top:**

- **Quick answer:** +1 Form if you answer correctly in under 5 seconds.
- **Hat-trick:** three right in a row earns +3 Form and a commentary line.
- **Yellow card:** two wrong in a row is a yellow (banter only). Four wrong in a row is a red, and your next power-up costs double.
- **West Ham Bonus Round** (Hot Spots): every card is a West Ham question and Form rewards are doubled. Penalties stay the same.

**Penalty safety rules,** so trivia never decides a game on its own:

- A frozen piece is unfrozen if you are in check and it is needed to get out, or if freezing it leaves you no legal move.
- A Free Kick is an extra move for the opponent that cannot capture or give check. It is cancelled if you are in check.
- Form is capped at 12, so nobody can hoard a game-winning stack.

## Form, power-ups and hints

Form is spent on one power-up per turn, before you move, plus any number of hints during a question. At about one question every two or three moves, a player earns around 1 Form per move, so cheap items come often and big ones a few times a game.

**Power-ups** (one per turn, used before your move):

| Power-up | Style | Cost | Effect | Limit and balance rule |
| --- | --- | --- | --- | --- |
| Tactical Foul | Football | 3 | Freeze one enemy piece (not the king) for their next turn | Not a piece that is giving check |
| Park the Bus | Football | 3 | Your pieces on your own back two ranks can't be captured next turn | Not while in check |
| VAR Review | Chess | 3 | Undo your last move and the opponent's reply | Twice per game |
| Counter-Attack | Chess | 4 | One pawn moves two squares from anywhere | Path must be clear; can't promote with it |
| Substitution | Chess | 4 | Bring one captured pawn back on your second rank | Once per game |
| Golden Boot | Football | 5 | Your next capture earns +3 Form | Stacks with streaks |
| Formation Change | Chess | 5 | Swap two of your own pieces (not the king) | Can't give check or leave you in check |
| Super-Sub | Football | 6 | Upgrade a pawn to a knight | Once per game |
| Red Card | Football | 7 | Send off one enemy pawn (removed) | Once per game; not a pawn on its 6th or 7th rank |
| Extra Time | Chess | 8 | Make two moves this turn | Once per game; second move can't capture or check |
| Fergie Time | Football | 2 | +30 seconds on your clock | Timed games only, twice per game |

**Chess hints** (count as your power-up for the turn):

| Hint | Cost | Effect |
| --- | --- | --- |
| Assistant's Flag | 1 | Highlights every square the opponent attacks |
| Scout Report | 2 | Shows the piece the opponent will most likely move next |
| Manager's Tip | 2 | Shows the engine's best move (twice per game) |

**Trivia hints** (during a question, not allowed on a Worldie):

| Hint | Cost | Effect |
| --- | --- | --- |
| 50:50 | 1 | Removes two wrong answers |
| Ask the Crowd | 1 | A crowd vote that leans towards the right answer (right about 65% of the time) |
| Phone Ollie | 2 | Ollie suggests an answer, right about 80% of the time. Becomes "Phone Ryan" when you're playing Ollie |

## Bots: Freddie, Ryan and Ollie

The three bots are mirror images, so each one beats you a different way: Ollie out-quizzes you, Freddie out-plays you, and Ryan does a bit of both. Each runs on Stockfish with its strength capped, then picks among the engine's top moves with its own style and mistake rate.

| | Ollie | Ryan | Freddie |
| --- | --- | --- | --- |
| Chess strength | Weak, about 700 | Middle, about 1200 | Strong, about 1800 |
| Engine setup | Skill Level 0, picks from top 5 moves, blunders often | Skill Level 6, picks from top 3, blunders sometimes | UCI_Elo 1800, top move nearly always |
| Chess style | Chaotic: early queen raids, grabs every capture | Balanced, turns aggressive when ahead | Solid and positional, trades into endgames |
| Trivia accuracy | 85% overall | 70% overall, 92% on West Ham | 45% overall |
| Answer speed | Fast, 2 to 5 s | Medium, 4 to 9 s | Slow, 7 to 13 s |
| Question picks | Hard or Worldie most of the time | Medium, but always Hard on a West Ham card | Easy most of the time |
| Spends Form on | VAR Review and Manager's Tip, to bail out his chess | Tactical Foul and Red Card | Saves up for Extra Time and Super-Sub |

The strength numbers are rough chess ratings. Stockfish's own Elo setting doesn't go below about 1320, so Ollie and Ryan are weakened with its Skill Level and by picking worse moves on purpose. If the real Freddie, Ryan and Ollie share their chess.com or Lichess usernames, the bots can use their real openings and ratings.

**Trash talk.** Each bot has 3 to 5 lines for each of these moments: game start, capture, losing a piece, opponent's wrong answer, own right answer, own wrong answer, power-up used, Hot Spot, win and loss. A line shows in a speech bubble for 3 seconds, at most once every two moves. Starter lines, for the real three to rewrite:

| Moment | Ollie | Ryan | Freddie |
| --- | --- | --- | --- |
| Game start | "Chess is just the bit between the questions." | "Come on you Irons. Let's have it." | "You can have the quiz. I'll have the board." |
| Opponent's wrong answer | "Genuinely, how did you not know that?" | "Even Freddie knew that one." | "Finally, someone worse at this than me." |
| Own wrong answer | "That was a trick question, I'm appealing." | "Wasn't a West Ham question, was it." | "Football's a distraction. Mate in four, anyway." |
| Captures a piece | "Is the horse allowed to do that? Too late now." | "Bowen, Prague, 2023. Same energy." | "Thanks for that. Didn't even need a hint." |
| Hot Spot | "West Ham round? I know more about them than Ryan." | "Bubbles are flying!" | "Oh no. Not the West Ham round." |
| Wins | "Brains over board, every time." | "Forever blowing bubbles, mate." | "Should have spent less time on the questions." |

## Tech stack and deployment

The game is a static web app with no server: everything, including the bots, runs on the player's device, and it works offline once installed. That makes it free to host and as easy as possible to deploy.

| Part | Choice | Why |
| --- | --- | --- |
| App framework | Vite + React + TypeScript | Fast to build, easy to deploy as static files |
| Chess rules | chess.js | Standard move validation, check, mate and draws |
| Board | react-chessboard | Drag or tap to move, works on touch screens |
| Power-up rules | Our own layer on top of chess.js | Filters legal moves (frozen pieces), edits the board (Red Card, Super-Sub), flips turns (Extra Time, Free Kick) |
| Engine | Stockfish single-threaded WebAssembly in a Web Worker | Runs the bots and the chess hints on the device; the single-threaded build needs no special server headers |
| Install and offline | vite-plugin-pwa (manifest, icons, service worker) | "Add to Home Screen" on iPhone, an install button on Android and computers |
| Questions | JSON file bundled with the app | Works offline; the question bank thread fills it |
| Saved data | Browser storage | Settings, seen questions (so they don't repeat) and stats; no accounts |
| Tests | Vitest | Mostly for the power-up rules, which are the easiest part to break |
| Hosting | GitHub Pages with a GitHub Action | Free and deploys on every push. Needs a public repo; for a private one, Netlify or Cloudflare Pages are free alternatives |

**Question format** the game expects, one entry per question:

```json
{
  "id": "whu-0042",
  "question": "Who scored West Ham's winner in the 2023 Europa Conference League final?",
  "options": ["Jarrod Bowen", "Michail Antonio", "Said Benrahma", "Lucas Paquetá"],
  "answer": 0,
  "difficulty": "easy",
  "topic": "West Ham moments",
  "westHam": true,
  "verified": true
}
```

`difficulty` is easy, medium or hard (Worldies reuse hard questions). `topic` drives the card labels, and `westHam` decides what can appear in a Bonus Round. Only `verified` questions are shown in the game.

## Build order and open questions

Each step ends with something playable on a phone, so the game can be tested with mates from the first milestone.

1. **Playable chess.** Board, rules, Pass and Play, installable and hosted.
2. **Trivia and Form.** Triggers, the three-card pick, rewards, penalties and Hot Spots, using the question bank.
3. **Power-ups and hints.** The tables above, with tests for every rule.
4. **Bots.** Stockfish in the browser, then the three personalities and their trash talk.
5. **Theme and polish.** Claret-and-blue board, commentary, sounds, Penalty Shootout.

**Open questions for Freddie, Ryan and Ollie:**

- [ ] chess.com or Lichess usernames, so the bots can copy real openings and ratings
- [ ] Real catchphrases and in-jokes to replace the starter trash talk
- [ ] Is a 15 second question timer about right, or should it be shorter?
- [ ] Should the Hot Spot bonus round always be West Ham, or each player's own club?
