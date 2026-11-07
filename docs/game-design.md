# They Think It's Checkmate: Game Design

Nov 4, 2026 · Freddie Martin

> Living version: [Claude Doc](https://claude.ai/artifact/241R9Ua8TD4wYkUo9GEswQ). This file is a snapshot of it.

## Summary

Chess is played normally, and football questions pop up along the way. A right answer earns **Form**, which you spend on power-ups and hints. A wrong answer can cost you, and how much depends on the question you picked: easy questions are safe, hard ones pay more but can freeze a piece or cost a turn.

This builds on the [research doc](https://claude.ai/artifact/288D72mj429RgxhCALFLa8) and Freddie's answers to the planning questions:

| Decision | Choice |
| --- | --- |
| When trivia comes up | A mix: a regular cadence, captures, and special squares |
| Wrong answers | Penalty scales with the difficulty you chose |
| Modes | vs bots, and two players on one device, each with an optional Chess960 start |
| Questions | Premier League from 2000/01, plus questions on the club you pick (all 92 league clubs) |
| Power-ups | Chess-style and football-themed |
| Bots | Freddie, Ryan and Ollie, each with a strength, a style and trash talk |
| Tech | Installable web app (PWA), one link for phone, tablet and computer |

All numbers below (Form costs, timers, bot accuracy) are first guesses to tune in playtesting.

## Modes and winning

There are two ways to play, and both use the same rules.

- **vs Bot.** Pick Freddie, Ryan or Ollie. You answer questions yourself; the bot "answers" using its trivia profile and talks trash throughout.
- **Pass and Play.** Two people on one device. Whoever triggered the question answers it, and the other player hands over the device without peeking (honour system, as at the pub). The screen faces whoever is up. Settings has two views, each with a picture. **Flat on the table** (the default, on phones, tablets and computers) turns the whole game round 180 degrees on Black's turn, so the board, question card and power-ups all face them with the device flat on the table. **Pass the phone** flips only the board, for handing the device across. (The old Face to face and Off views were removed in playtest round 3; saved settings move to Flat on the table and Pass the phone.)

Each game also has a **Plain Chess** toggle (no trivia) and a **Timed** toggle (3, 5, 10, 15 or 30 minutes each, shown on stadium-style scoreboard clocks), so it works for a quick game or a serious one.

**Winning.** Checkmate wins, as normal. Resigning is allowed. A draw of any kind (stalemate, repetition, 50 moves, agreement) goes to a **Penalty Shootout**: five questions each, alternating, best score wins, sudden death if level. Rules that only exist because of power-ups are listed with each power-up below; nothing can capture or remove a king or queen directly.

## Pawn promotion: "Who am I?"

When a pawn reaches the last rank, you earn your new piece with a **"Who am I?"** about a footballer (Freddie, Nov 4, 2026). Five clues appear one at a time, hardest first, and you get **one guess** from four names. Clues show every 6 seconds, or you can tap Next clue.

| Guess right after | Piece |
| --- | --- |
| Clue 1 | Queen |
| Clue 2 | Rook |
| Clue 3 | Bishop |
| Clue 4 or 5 | Knight |

A wrong guess, or no guess by 6 seconds after the fifth clue, gives you a knight **and your opponent +2 Form**. That way a blind early guess is a real gamble. The question replaces any other trigger on that move. If the promotion square is a Hot Spot, the player is a club player for your club where there is one.

Clue sets live in `data/whoami.json`, built by `tools/build_whoami.py`: 30 Premier League players from 2000 onwards, 10 West Ham and 8 Brighton. Every clue was checked against the player's Wikipedia page on 2026-11-04. Bots aim for a piece (Ollie a queen, Ryan a rook, Freddie a knight) and guess with their usual trivia accuracy.

**Chess960.** A toggle on the setup screen, in every mode. The back rank starts in one of 960 arrangements (numbered with the standard scheme; 518 is normal chess), shown on screen with a Reroll button. Castling follows Chess960 rules: king and rook end on the usual squares (tap the king, then the rook). Formation Change on an unmoved rook removes castling on that side.

## Picking your club

Before each game every player picks the club they support from all 92 Premier League and EFL clubs (or none). Landing on a Hot Spot gives a **Club Bonus Round** on your own club for double Form, and about one deal in three swaps a card for a club card at the same difficulty. A club with fewer than 10 questions at a difficulty falls back to general questions. Bots have clubs too: Ryan and Ollie West Ham, Freddie Brighton.

## Menus

The game opens on a **main menu** in the Tactics Board style: Play a bot (pick Freddie, Ryan or Ollie and Easy, Medium or Hard), Pass and Play, High scores, Game history, How to play and Settings. The setup screen then takes clubs (one A to Z list of all 92 with a search box, not grouped by division, so it doesn't date when clubs go up or down), colour, and the Trivia, Timed and Chess960 toggles. During a game the **Menu** button (or the title bar) pauses everything, including clocks, question timers and bots, with Resume, Restart, Settings and Quit to menu. High scores keep your record (played, won, drawn, lost, best winning run) against each bot at each level, plus Pass and Play wins by name, on the device. **Game history** lists the last 100 finished games, newest first (no replays): date, opponent and level, result and how it ended, moves, Form earned and trivia score (right/asked, including Who am I? and shootout kicks).

## When trivia comes up

A question appears straight after a move that triggers one, and the player who made that move answers it. There is at most one question per move, which works out to roughly one every two or three of your moves.

| Trigger | Fires when | Question type |
| --- | --- | --- |
| Hot Spot | You land on one of 4 marked squares (a football icon) | **Club Bonus Round**: questions on your club, double Form |
| Capture | You take a piece | Normal pick of three cards |
| Kick-off | Every 3rd move you make with no other question | Normal pick of three cards |

If a move hits two triggers, the higher one in the table wins. The Kick-off counter resets whenever you get a question, so captures don't stack extra questions on top.

**Hot Spots.** Four squares on ranks 3 to 6 are picked at random each game, two on each half of the board. Once a Hot Spot is used it moves to a new random empty square in the same half, so nobody can camp on one. After every other move, the Hot Spot that has stayed put longest also jumps to a new square in its half, so one moves on every move. Hot Spots are never placed where a knight (or, in Chess960, any piece other than a pawn) can land on move one. Pawns are left out of that rule, because between them they reach every square on ranks 3 to 6.

**A turn, step by step:**

1. Optionally spend Form on one power-up.
2. Make your chess move.
3. If the move triggers a question, pick a card and answer it (15 second timer).
4. Form is added, or the penalty is applied, and play passes to the opponent.

## Choosing a question: risk and reward

You pick your own question, and the harder it is, the more you win and the more you risk. Each trigger deals three face-down cards showing only a topic and a difficulty, for example "Managers · Tap-in", "Transfers · Highlight", "West Ham · Screamer". One card of each difficulty is dealt, with random topics. A **Go for a Puskás** button turns the Screamer card into a Puskás. The names are kinds of goal, so they can't be mistaken for topics or leagues.

| Difficulty | Timer | Right answer | Wrong answer or time out |
| --- | --- | --- | --- |
| Tap-in (easy) | 15 s | +1 Form | Nothing, you just miss out |
| Highlight (medium) | 15 s | +2 Form | Opponent gets +2 Form ("scored on the break") |
| Screamer (hard) | 15 s | +4 Form | **Booked**: the piece you just moved is frozen for your next turn |
| Puskás (hard, no hints) | 8 s | +6 Form | **Sent off**: you lose your next turn, and the opponent gets a Free Kick |

**Extras on top:**

- **Quick answer:** +1 Form if you answer correctly in under 5 seconds.
- **Hat-trick:** three right in a row earns +3 Form and a commentary line.
- **Yellow card:** two wrong in a row is a yellow (banter only). Four wrong in a row is a red, and your next power-up costs double.
- **Club Bonus Round** (Hot Spots): every card is a question on your club and Form rewards are doubled. Penalties stay the same.

**Penalty safety rules,** so trivia never decides a game on its own:

- A frozen piece is unfrozen if you are in check and it is needed to get out, or if freezing it leaves you no legal move.
- A Free Kick is an extra move for the opponent that cannot capture or give check. It is cancelled if you are in check.
- Form is capped at 12, so nobody can hoard a game-winning stack.

## Form, power-ups and hints

Form is spent on one power-up per turn, before you move, plus any number of hints during a question. At about one question every two or three moves, a player earns around 1 Form per move, so cheap items come often and big ones a few times a game.

**Power-ups** (one per turn, used before your move). Each has a cooldown: once used, it is locked for that many of your own moves, and every power-up also starts the game locked for its cooldown. The button shows when it's ready, and a Form meter above the buttons shows how much you have to spend. Tapping a power-up opens a card with its cost and effect; nothing is spent until you tap Confirm, and once confirmed it can't be cancelled (so targeted power-ups only offer Confirm when there is a valid target).

**No own goals.** A power-up should never hurt the player who uses it: Extra Time's second move is optional, engine power-ups (Manager's Tip, Scout Report, Masterclass) cost nothing if the engine can't answer, Scout Report can't be used in check, and freezes or Park the Bus are lifted if they would leave the opponent with no legal move (so they can't force a stalemate).

| Power-up | Style | Cost | Cooldown (your moves) | Effect | Balance rule |
| --- | --- | --- | --- | --- | --- |
| Fergie Time | Football | 2 | 8 | Adds a tenth of the starting clock: 20s (3 min), 30s (5), 1:00 (10), 1:30 (15), 3:00 (30) | Timed games only |
| Tactical Foul | Football | 3 | 6 | Freeze one enemy piece (not the king) for their next turn | Not a piece that is giving check |
| Park the Bus | Football | 3 | 6 | Your pieces on your own back two ranks can't be captured next turn | Not while in check |
| VAR Review | Chess | 3 | 10 | Undo your last move and the opponent's reply | |
| Counter-Attack | Chess | 4 | 8 | One pawn may move two squares from anywhere this turn | Path must be clear; can't promote |
| Substitution | Chess | 4 | 12 | Bring one captured pawn back on your second rank | |
| Golden Boot | Football | 5 | 8 | Your next capture earns +3 Form | Stacks with streaks |
| Formation Change | Chess | 5 | 10 | Swap two of your own pieces (not the king) | Can't give check or leave you in check |
| Super-Sub | Football | 6 | 15 | Upgrade a pawn to a knight | |
| Red Card | Football | 7 | 20 | Send off one enemy pawn (removed) | Not a pawn on its 6th or 7th rank |
| Extra Time | Chess | 8 | 20 | Make two moves this turn | Second move can't capture or check, and can be skipped |
| Masterclass | Chess | 10 | 20 | The engine plays the best move for you | Best move that your freezes and penalties allow |

**Chess hints** (count as your power-up for the turn):

| Hint | Cost | Effect |
| --- | --- | --- |
| Assistant's Flag | 1 | Highlights every square the opponent attacks |
| Scout Report | 2 | Shows the piece the opponent will most likely move next |
| Manager's Tip | 2 | Shows the engine's best move (cooldown 8 moves) |

**Trivia hints** (during a question, not allowed on a Puskás):

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
| Chess rules | chessops | Lichess's rules library: legal moves, check, mate, draws and Chess960 castling |
| Board | Our own tap-to-move board | Each of the ten styles in themes.css dresses the same squares and pieces |
| Power-up rules | Our own layer on top of chessops (`src/game/rules.ts`) | Filters legal moves (frozen pieces), edits the board (Red Card, Super-Sub), flips turns (Extra Time, Free Kick) |
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
  "club": "west-ham",
  "verified": true
}
```

`difficulty` is easy, medium or hard (a Puskás reuses hard questions; the data keeps the keys easy/medium/hard, which the game shows as Tap-in/Highlight/Screamer). `topic` drives the card labels, and `club` (a club id, or null for general questions) decides what can appear in a Club Bonus Round. Only `verified` questions are shown in the game.

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
- [x] Hot Spot bonus rounds use each player's own club
