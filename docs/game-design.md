# They Think It's Checkmate: Game Design

Nov 4, 2026 · Freddie Martin

> Living version: [Claude Doc](https://claude.ai/artifact/241R9Ua8TD4wYkUo9GEswQ). This file is a snapshot of it.

## Summary

Chess is played normally, and football questions pop up along the way. A right answer earns **Form**, which you spend on power-ups and chess hints. A wrong answer can cost you, and how much depends on the question you picked: easy questions are safe, hard ones pay more but can freeze a piece or cost a turn.

This builds on the [research doc](https://claude.ai/artifact/288D72mj429RgxhCALFLa8) and Freddie's answers to the planning questions:

| Decision | Choice |
| --- | --- |
| When trivia comes up | A mix: a regular cadence, captures, and special squares |
| Wrong answers | Penalty scales with the difficulty you chose |
| Modes | vs bots, and two players on one device, each with an optional Chess960 start |
| Questions | Premier League from 2000/01, plus questions on the club you pick (all 92 league clubs) |
| Power-ups | Chess-style and football-themed |
| Bots | An Elo ladder of 7 made-up characters (400 to 1600 chess Elo), plus Freddie, Ryan and Ollie with three levels each; every bot has a style and trash talk |
| Tech | Installable web app (PWA), one link for phone, tablet and computer |

All numbers below (Form costs, timers, bot accuracy) are first guesses to tune in playtesting.

## Modes and winning

There are two ways to play, and both use the same rules.

- **vs Bot.** Pick a bot from the Elo ladder (400 to 1600) or Freddie, Ryan or Ollie. You answer questions yourself; the bot "answers" using its trivia profile and talks trash throughout.
- **Pass and Play.** Two people on one device. Whoever triggered the question answers it, and the other player hands over the device without peeking (honour system, as at the pub). The screen faces whoever is up. Settings has two views, each with a picture. **Flat on the table** (the default, on phones, tablets and computers) turns the whole game round 180 degrees on Black's turn, so the board, question card and power-ups all face them with the device flat on the table. The layout is symmetric about the board (the same space on each side, each side scrolling on its own, side by side in landscape), so the turn leaves the board exactly where it was: it never jumps between moves (playtest, 2026-11-08). Cards, questions and results sit over the board in this view, since each side is too small for them. **Pass the phone** flips only the board, for handing the device across. (The old Face to face and Off views were removed in playtest round 3; saved settings move to Flat on the table and Pass the phone.) **Handicap** (Pass and Play setup): pick who gets the help, then piece odds from the other player (the f-pawn, the queenside knight, the queenside rook with its castling right, or the queen; Chess960 back ranks too) and a Form boost on the weaker player's right answers (x1.25, x1.5 or x2, with fractions carried to the next answer). Enter both chess ratings for a suggestion: the biggest piece the rating gap covers (pawn ~150, knight ~350, rook ~550, queen ~900 Elo), then a Form boost for what's left (x1.25 ~50, x1.5 ~100, x2 ~200). These values are first guesses to tune in playtesting. Odds count as already given, so the player who gave them doesn't get the material catch-up bonus just for that.

Each game also has a **Plain Chess** toggle (no trivia) and a **Timed** toggle (3, 5, 10, 15 or 30 minutes each, shown on stadium-style scoreboard clocks), so it works for a quick game or a serious one. In a timed game the clock of whoever has to act **always runs**: while choosing a move, picking a card, answering, reading the result (which moves on by itself after 2.5 seconds) and while the engine thinks for a power-up. It stops only for a "Who am I?", the Penalty Shootout and the pause menu. Every move adds **3 seconds** to the mover's clock.

**Winning.** Checkmate wins, as normal. Resigning is allowed. A draw of any kind (stalemate, repetition, 50 moves, agreement) goes to a **Penalty Shootout**: five questions each, alternating, best score wins, sudden death if level. Rules that only exist because of power-ups are listed with each power-up below; nothing can capture or remove a king or queen directly.

## Pawn promotion: "Who am I?"

When a pawn reaches the last rank, you earn your new piece with a **"Who am I?"** about a footballer (Freddie, Nov 4, 2026). Five clues appear one at a time, hardest first, and you get **one guess**, typed in (playtest round 3). The board is hidden and both chess clocks stop while it's on. Clues show every 12 seconds, or you can tap Next clue. Capitals and accents don't matter (Paquetá, Ødegaard), the surname alone is enough, a typo or two is allowed (none for names of 3 letters or fewer, 1 up to 6, then 2), and each set lists extra accepted names (`aliases`, e.g. "Kun" for Agüero). Typing another footballer's name exactly is always wrong, so "Kane" doesn't pass for Kanté. Bots still pick from four names with their usual odds.

| Guess right after | Piece |
| --- | --- |
| Clue 1 or 2 | Queen |
| Clue 3 | Rook |
| Clue 4 | Bishop |
| Clue 5 | Knight |

A wrong guess, or no guess by 12 seconds after the fifth clue, gives you a knight **and your opponent +2 Form**. That way a blind early guess is a real gamble. The question replaces any other trigger on that move, and it restarts the Kick-off count. About half of all "Who am I?"s are a player from your own club, where your club has clue sets.

Clue sets live in `data/whoami.json`, built by `tools/build_whoami.py`: 30 Premier League players from 2000 onwards, 10 West Ham and 8 Brighton. Every clue was checked against the player's Wikipedia page on 2026-11-04. Bots aim for a piece (Ollie a queen, Ryan a rook, Freddie a knight) and guess with their usual trivia accuracy.

**Chess960.** A toggle on the setup screen, in every mode. The back rank starts in one of 960 arrangements (numbered with the standard scheme; 518 is normal chess), shown on screen with a Reroll button. Castling follows Chess960 rules: king and rook end on the usual squares (tap the king, then the rook). Formation Change on an unmoved rook removes castling on that side.

## Picking your club

Before each game every player picks the club they support from all 92 Premier League and EFL clubs (or none). About one deal in three (Hot Spots included) swaps a card for a club card at the same difficulty. A club with fewer than 10 questions at a difficulty falls back to general questions. Bots have clubs too: Ryan and Ollie West Ham, Freddie Brighton.

## Menus

The game opens on a **main menu** in the Tactics Board style: Play a bot (pick a ladder bot, or Freddie, Ryan or Ollie and Easy, Medium or Hard), Pass and Play, High scores, Game history, How to play and Settings. The setup screen then takes clubs (one A to Z list of all 92 with a search box, not grouped by division, so it doesn't date when clubs go up or down), colour, and the Trivia, Timed and Chess960 toggles. During a game the **Menu** button (or the title bar) pauses everything, including clocks, question timers and bots, with Resume, Restart, Settings and Quit to menu. High scores keep your record (played, won, drawn, lost, best winning run) against each bot at each level, plus Pass and Play wins by name, on the device. The top of the page shows your **best win** (the bot with the highest combined chess + trivia rating you have beaten) and your **trivia Elo**, which moves with your answers against bots and tops out at the title Elite Ball Knowledge (docs/bots.md). **Game history** lists the last 100 finished games, newest first (no replays): date, opponent and level, result and how it ended, moves, Form earned and trivia score (right/asked, including Who am I? and shootout kicks).

## When trivia comes up

A question appears straight after a move that triggers one, and the player who made that move answers it. There is at most one question per move, which works out to roughly one every two or three of your moves.

| Trigger | Fires when | Question type |
| --- | --- | --- |
| Hot Spot | You land on one of 2 marked squares (a football icon) | Normal pick of three cards from the whole bank |
| Capture | You take a piece | Normal pick of three cards |
| Kick-off | Every 4th move you make with no other question | Normal pick of three cards |

If a move hits two triggers, the higher one in the table wins. The Kick-off counter resets whenever you get a question, so captures don't stack extra questions on top.

**Hot Spots.** Two squares on ranks 3 to 6 are picked at random each game, one on each half of the board. They stay put until someone lands on one. A used Hot Spot jumps to a new random empty square in the same half, preferring a square no piece can reach on the very next move, so claiming one takes a little planning. Hot Spots are never placed where a knight (or, in Chess960, any piece other than a pawn) can land on move one. Pawns are left out of that rule, because between them they reach every square on ranks 3 to 6.

**A turn, step by step:**

1. Optionally spend Form on one power-up.
2. Make your chess move.
3. If the move triggers a question, pick a card and answer it (10 second timer; your chess clock keeps running).
4. Form is added, or the penalty is applied, and play passes to the opponent.

## Choosing a question: risk and reward

You pick your own question, and the harder it is, the more you win and the more you risk. Each trigger deals three face-down cards showing only a topic and a difficulty, for example "Managers · Tap-in", "Transfers · Highlight", "West Ham · Screamer". One card of each difficulty is dealt, with random topics. A **Go for a Puskás** button turns the Screamer card into a Puskás. The names are kinds of goal, so they can't be mistaken for topics or leagues.

| Difficulty | Timer | Right answer | Wrong answer or time out |
| --- | --- | --- | --- |
| Tap-in (easy) | 10 s | +1 Form | Nothing, you just miss out |
| Highlight (medium) | 10 s | +2 Form | Opponent gets +2 Form ("scored on the break") |
| Screamer (hard) | 10 s | +3 Form | **Booked**: the piece you just moved is frozen for your next turn |
| Puskás (hard) | 8 s | +5 Form | **Sent off**: you lose your next turn, and the opponent gets a Free Kick |

**Extras on top:**

- **Quick answer:** +1 Form if you answer a Screamer or Puskás correctly in under 5 seconds.
- **Hat-trick:** three right in a row earns +2 Form and a commentary line.
- **Catch-up:** if you're behind on material (pawn 1, knight and bishop 3, rook 5, queen 9), every right answer earns +1 Form more.
- **Yellow card:** two wrong in a row is a yellow (banter only). Four wrong in a row is a red, and your next power-up costing 3 Form or more costs double. Cheaper ones don't pay the double price and don't clear it.
- **Hot Spots** deal from the whole bank like any other trigger, with normal rewards and penalties. They used to be a Club Bonus Round on your club, but with 30 questions a club those came round often enough to memorise (Freddie, 2026-11-08). Double Form was already dropped on 2026-11-07 so chasing Hot Spots doesn't farm Form.

**Penalty safety rules,** so trivia never decides a game on its own:

- A frozen piece is unfrozen if you are in check and it is needed to get out, or if freezing it leaves you no legal move.
- A Free Kick is an extra move for the opponent that cannot capture or give check. It is cancelled if you are in check.
- Form is capped at 12, so nobody can hoard a game-winning stack.

## Form, power-ups and chess hints

Form is spent on one power-up per turn, before you move. (Trivia hints during a question, 50:50, Ask the Crowd and Phone Ollie, were removed on 2026-11-08 as too complicated.) The target is about 1.2 Form per move for a strong quizzer, so cheap items come often and big ones a few times a game. `tools/playtest/formsim.ts` measures it with the real rules (playtest round 3, 300 games per row, 40 moves a side):

| Player | Before round 3 | Now | Now, chasing every Hot Spot |
| --- | --- | --- | --- |
| Strong (85%), always Screamer | 1.9 (7.3 chasing) | 1.3 | 2.4 |
| Strong, always Puskás | 2.1 | 1.6 | 2.4 |
| Average (65%), always Screamer | 1.4 | 0.9 | 1.7 |
| Weak, always Tap-in | 0.5 | 0.4 | 0.8 |

Each power-up shows a **value of 1 to 5 stars**: roughly how much it swings the board (about a star per half-pawn to a pawn of advantage). The bar always shows every power-up; ones you can't afford, or that are cooling down, are faded.

**Power-ups** (one per turn, used before your move). Each has a cooldown: once used, it is locked for that many of your own moves, and every power-up also starts the game locked for its cooldown. The button shows when it's ready, and a Form meter above the buttons shows how much you have to spend. Tapping a power-up opens a card with its cost and effect; nothing is spent until you tap Confirm, and once confirmed it can't be cancelled (so targeted power-ups only offer Confirm when there is a valid target).

**No own goals.** A power-up should never hurt the player who uses it: Extra Time's second move is optional, engine power-ups (Manager's Tip, Scout Report, Masterclass) cost nothing if the engine can't answer, Scout Report can't be used in check, and freezes or Park the Bus are lifted if they would leave the opponent with no legal move (so they can't force a stalemate).

| Power-up | Style | Cost | Cooldown (your moves) | Value | Effect | Balance rule |
| --- | --- | --- | --- | --- | --- | --- |
| Fergie Time | Football | 2 | 8 | ★★ | Adds a tenth of the starting clock: 20s (3 min), 30s (5), 1:00 (10), 1:30 (15), 3:00 (30) | Timed games only |
| Tactical Foul | Football | 5 | 10 | ★★ | Freeze one enemy piece for their next turn | Not the king, the queen, or a piece giving check |
| Park the Bus | Football | 2 | 6 | ★ | Your pieces on your own back two ranks can't be captured next turn | Not while in check |
| VAR Review | Chess | 6 | 15 | ★★★★★ | Undo your last move and the opponent's reply | Form, cooldowns, streaks and freezes roll back too (clocks don't); the cost comes out of the Form you had before that move |
| Counter-Attack | Chess | 3 | 8 | ★ | One pawn may move two squares from anywhere this turn | Path must be clear; can't reach the 7th rank, or skip past a square an enemy pawn covers (it would dodge en passant) |
| Substitution | Chess | 4 | 12 | ★★★ | Bring one captured pawn back on your second rank | |
| Golden Boot | Football | 2 | 8 | ★ | +2 Form for each capture in your next 3 moves (this one included) | |
| Formation Change | Chess | 6 | 12 | ★★ | Swap two of your own pieces (not the king) | Not while in check, not a frozen piece, a pawn can only land on its 2nd to 5th rank; can't give check |
| Super-Sub | Football | 7 | 15 | ★★★★ | Upgrade a pawn to a knight | |
| Red Card | Football | 5 | 15 | ★★★ | Send off one enemy pawn (removed) | Not a pawn on its 6th or 7th rank |
| Extra Time | Chess | 10 | 25 | ★★★★ | Make two moves this turn | Neither move can capture; the second can't give check, and can be skipped |
| Masterclass | Chess | 6 | 12 | ★★★ | The engine plays the best move for you | Best move that your freezes and penalties allow |

**Chess hints** (count as your power-up for the turn):

| Hint | Cost | Cooldown | Value | Effect |
| --- | --- | --- | --- | --- |
| Assistant's Flag | 1 | 3 | ★ | Highlights every square the opponent attacks |
| Scout Report | 2 | 4 | ★ | Shows the piece the opponent will most likely move next |
| Manager's Tip | 4 | 10 | ★★ | Shows the engine's best move |

## Bots: Freddie, Ryan and Ollie

The three bots are mirror images, so each one beats you a different way: Ollie out-quizzes you, Freddie out-plays you, and Ryan does a bit of both. Each runs on Stockfish with its strength capped, then picks among the engine's top moves with its own style and mistake rate.

| | Ollie | Ryan | Freddie |
| --- | --- | --- | --- |
| Chess strength | Weak, about 700 | Middle, about 1200 | Strong, about 1800 |
| Engine setup | Skill Level 0, picks from top 5 moves, blunders often | Skill Level 6, picks from top 3, blunders sometimes | UCI_Elo 1800, top move nearly always |
| Chess style | Chaotic: early queen raids, grabs every capture | Balanced, turns aggressive when ahead | Solid and positional, trades into endgames |
| Trivia accuracy | 85% overall | 70% overall, 92% on West Ham | 45% overall |
| Answer speed | Fast, 2 to 5 s | Medium, 4 to 9 s | Slow, 7 to 13 s |
| Question picks | Hard or Puskás most of the time | Medium, but always Hard on a West Ham card | Easy most of the time |
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

## The Elo ladder

Playtest round 3 (Freddie, 7 Nov 2026) added one bot at each of 400, 600, 800, 1000, 1200, 1400 and 1600 chess Elo, so there is always a next rung to beat. Each is a made-up character with a pun name; four are loosely inspired by footballers known for loving chess (Eze, Chilwell, Salah and Haaland), with no real names. Ladder bots have one strength each, so the setup screen hides the level picker for them. Their trivia varies on purpose, so the combined rating doesn't just follow the chess.

| Elo | Bot | Club | Style | Trivia | Spends Form on |
| --- | --- | --- | --- | --- | --- |
| 400 | Pawny Dribbles | Stockport County | Chaotic Sunday-leaguer | 52% | Golden Boot, Counter-Attack |
| 600 | Eezy Peasy | Crystal Palace | Chaotic flair player | 78%, goes for Screamers | Counter-Attack, Golden Boot, Manager's Tip |
| 800 | Billy Chillwall | Chelsea | Positional, parks the bus | 61% | Park the Bus, Tactical Foul, Red Card |
| 1000 | Gambit Gary | Leicester City | Balanced pundit | 84%, goes for Screamers | Manager's Tip, Golden Boot, Red Card |
| 1200 | Mo Mate | Liverpool | Balanced finisher | 68% | Tactical Foul, Golden Boot, Super-Sub |
| 1400 | Florence Knightingale | Everton | Positional playmaker | 72% | Saves for Super-Sub and Extra Time |
| 1600 | Ragnar Rookland | Manchester City | Balanced goal machine | 47% | Saves for Extra Time and Super-Sub |

Every bot (ladder and originals) also plays the game around the chess (review bug 10 and "easy bots"):

- **It sees the evaluation.** Before deciding on a power-up, the bot takes a quick look at the position with the engine (depth 8 at most). So Park the Bus fires when it's losing, VAR Review fires when the score has swung against it since its last move, and it picks safer cards when it's well ahead.
- **It chases Hot Spots.** A move onto a Hot Spot gets a bonus worth up to 0.4 of a pawn, scaled by how well the bot knows its own club, so good quizzers go for them and poor ones mostly don't.
- **Golden Boot only pays.** The bot buys it only when the engine's best move is a capture, and while it runs the bot likes captures a bit more, so it doesn't lose Form on it.

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

`difficulty` is easy, medium or hard (a Puskás reuses hard questions; the data keeps the keys easy/medium/hard, which the game shows as Tap-in/Highlight/Screamer). `topic` drives the card labels, and `club` (a club id, or null for general questions) decides which club cards a player can be dealt. Only `verified` questions are shown in the game.

## Build order and open questions

Each step ends with something playable on a phone, so the game can be tested with mates from the first milestone.

1. **Playable chess.** Board, rules, Pass and Play, installable and hosted.
2. **Trivia and Form.** Triggers, the three-card pick, rewards, penalties and Hot Spots, using the question bank.
3. **Power-ups and chess hints.** The tables above, with tests for every rule.
4. **Bots.** Stockfish in the browser, then the three personalities and their trash talk.
5. **Theme and polish.** Claret-and-blue board, commentary, sounds, Penalty Shootout.

**Open questions for Freddie, Ryan and Ollie:**

- [ ] chess.com or Lichess usernames, so the bots can copy real openings and ratings
- [ ] Real catchphrases and in-jokes to replace the starter trash talk
- [x] Question timer: 10 seconds, with the chess clock running (playtest round 3)
- [x] Hot Spot bonus rounds use each player's own club
