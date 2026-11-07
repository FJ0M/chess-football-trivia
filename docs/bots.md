# Bots: the Elo ladder, plus Ollie, Ryan and Freddie

The code is in `src/bots/`, and the game imports only `src/bots/index.ts`. There are ten bots. Seven make up the **Elo ladder** (one strength each, 400 to 1600 chess Elo, profiles in the `LADDER` block of `src/bots/profiles.ts`). The original three each have low, medium and hard levels. A level changes both its chess and its trivia, so the character stays the same: Ollie is a great quizzer and a poor chess player, Freddie is the reverse, and Ryan sits in the middle (and is close to perfect on West Ham).

## How a bot plays

- **Chess.** Stockfish 17.1 lite runs single-threaded WebAssembly in a Web Worker (`public/stockfish/`, GPLv3, see `COPYING.txt` there), always in `UCI_Chess960` mode, so Chess960 works and castling comes back king-to-rook as chessops expects. The bot asks for the top few lines (MultiPV) at a fixed depth, then picks one using a temperature, a blunder rate and style bonuses. Ollie grabs captures and raids early with his queen, Ryan turns aggressive when he's ahead, and Freddie castles early and trades down when he's ahead. A bot never misses a mate it can see. When power-ups limit moves (frozen pieces, Free Kick), the game passes `allowedMoves` and the bot searches only those.
- **Trivia.** Accuracy depends on difficulty, with Puskás goals harder still. Each bot does better on questions about its own club. Answer times fit inside the timer and are quicker on a Puskás. Card picks follow the design doc: Ollie goes Hard, Freddie goes Easy, and Ryan always goes Hard on a West Ham card.
- **Power-ups.** Each bot has a preference list. Ollie uses VAR Review after a blunder, plus Manager's Tip. Ryan uses Tactical Foul on the most valuable enemy piece and Red Card on the most advanced legal pawn. Freddie saves Form for Extra Time and Super-Sub.
- **Promotion "Who am I?".** Ollie aims for a queen (guesses on clue 1), Ryan for a rook, and Freddie for a knight.
- **Trash talk.** The lines in `src/bots/talk.ts` are **placeholders** until the real three send their catchphrases. A bot speaks at most once every two of its own moves, and always at the start, at the end and on a Hot Spot.

## The Elo ladder

| Target | Bot | Measured | Engine setup (depth, lines, temperature, blunder rate) | Style |
| --- | --- | --- | --- | --- |
| 400 | Pawny Dribbles | 439 | 2, 6, 240 cp, 50% | chaotic |
| 600 | Eezy Peasy | 596 | 3, 5, 200 cp, 38% | chaotic |
| 800 | Billy Chillwall | 801 | 4, 4, 150 cp, 25% | positional |
| 1000 | Gambit Gary | 1050 | 5, 3, 115 cp, 16% | balanced |
| 1200 | Mo Mate | 1256 | 6, 3, 95 cp, 12% | balanced |
| 1400 | Florence Knightingale | 1393 | 7, 3, 75 cp, 8% | positional |
| 1600 | Ragnar Rookland | 1622 | 8, 3, 60 cp, 6.5% | balanced |

Calibrated on 7 Nov 2026 with `tools/playtest/match.ts`: 410 games in the final fit (16 to 20 games per pairing, half of them Chess960), against neighbouring ladder bots, the original bots and Stockfish at `UCI_Elo 1320` (pinned to 1320 in `ratings.py`). Three rounds: Eezy, Chillwall and Rookland came out 100 to 200 too strong in the first round and were retuned. Treat every number as ±100. Stockfish's Elo setting can't go below 1320, so the bottom of the ladder hangs off the chain Pawny → Ollie low → Eezy → Ollie medium → Chillwall → Ollie hard / Ryan low → sf-1320. That's the main source of error at 400 to 800.

The same fit re-measured the original bots as a check: Ollie 541 / 812 / 1059, Ryan 1026 / 1389 / 1561, Freddie low 1769. That's within about 150 of the table below everywhere, so their numbers stay as they are.

Ladder bots run the same code as the originals. What differs is in the profile: `fixedLevel` (all three levels identical, level picker hidden), `thinkMs`, `promotionAim` and, optionally, `hotSpotCp`.

## Playing the game around the chess (review bug 10)

- **Evaluation.** `bot.choosePowerUp()` is async: the bot first analyses the position (depth up to 8). It uses that score for Park the Bus (when behind by 1.5 pawns or more), for VAR Review (when the score has dropped 2.5 pawns or more since the eval it expected after its own last move, or after its own blunder) and for picking safer cards when well ahead. The card choice reuses the eval from the bot's own move.
- **Hot Spots.** The game passes the Hot Spots that count (none while the bot is resting). Moves onto one get a bonus of `(own-club accuracy − 0.45) × 150` centipawns, capped at 70. Hot Spot moves that aren't in the engine's top lines get a separate search so they can be considered.
- **Hints.** `bot.chooseHint()` buys a 50:50 on a Highlight or Screamer the bot rates below 65%, if it can pay and keep any reserve it saves for. Never on a Tap-in or a Puskás.
- **Golden Boot.** Bought only when the engine's best move is a capture (it costs 2 and pays 2 a capture). While it runs, captures get a 40 cp bonus.

## Measured chess strength (the original three)

400 bot-vs-bot and bot-vs-Stockfish games (`tools/playtest/match.ts`, players named `<bot>-<level>`, `<ladder bot>` or `sf-<elo>`, about 40% of them Chess960). Ratings were fitted with `tools/playtest/ratings.py`, with Stockfish at `UCI_Elo 1320` pinned to 1320.

| Level | Ollie | Ryan | Freddie |
| --- | --- | --- | --- |
| Low | 450 | 950 | 1600 |
| Medium | 600 | 1300 | 1800 |
| Hard | 900 | 1600 | 2150 |

The first draft of every bot played about 400 points too strong, and these numbers come from the retune. Treat them as accurate to about ±150. At fast time limits Stockfish's own Elo setting is not exact (its "1600" and "2000" fitted at about 1450 and 1650 here), and online ratings on chess.com and Lichess differ from each other too.

## Should players enter their Elo?

**Yes, but make it optional and use it only to suggest a bot and level.** The nine levels run from about 450 to 2150 in steps of 150 to 350, so a typed rating can point to a level that should give a close game ("You're about 1200, try Ryan medium"). It should not be the only way to choose:

- Most casual players don't know their rating, and the bots' ratings are only ±150.
- In this game a rating isn't the whole story, because trivia changes the result as well.

A simple improvement for later: after each game, suggest moving up a level after a win and down after a loss, so the suggestion fixes itself.

## Trivia rating and high score (provisional)

Freddie's idea is that the high score is the biggest combined rating you've beaten, with trivia weighted by what it is actually worth. Each bot level now carries three numbers in `BOTS[i].ratings[level]`:

- `chess`: the measured Elo above.
- `trivia`: average accuracy across easy, medium and hard.
- `match`: chess + (accuracy − 55%) × 4 per point. An average quizzer (55%) gets their chess rating, and a perfect one gets +180.

| Match rating | Ollie | Ryan | Freddie |
| --- | --- | --- | --- |
| Low | 534 | 979 | 1521 |
| Medium | 728 | 1367 | 1756 |
| Hard | 1052 | 1699 | 2135 |

The weighting (4 Elo per accuracy point) is a first guess. The full-game playtest (`tools/playtest/fullgame.ts`, simplified trivia, Form and power-up rules) was cut short. What it did show is that chess dominates. Ollie earned noticeably more Form, but won only 1 of 47 games against opponents of 1320 chess or stronger who answer 55% of questions right. So "2500 chess with no football knowledge" really does beat "perfect trivia with weak chess", and the trivia weighting should stay small. A longer run of the trivia-accuracy grid (same chess, 15% to 95% trivia) would pin the number down.

Known harness issue: when many games run in parallel, a Stockfish child process sometimes exits (code 7) and the run stops. Run fewer shards at once, or add a restart.
