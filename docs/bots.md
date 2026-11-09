# Bots: the Elo ladder

The code is in `src/bots/`, and the game imports only `src/bots/index.ts`. There are seven bots, the **Elo ladder** (one strength each, 400 to 1600 chess Elo, profiles in `src/bots/profiles.ts`). The original three, Ollie, Ryan and Freddie, were retired on 2026-11-09; older sections below still mention them as history.

## How a bot plays

- **Chess.** Stockfish 17.1 lite runs single-threaded WebAssembly in a Web Worker (`public/stockfish/`, GPLv3, see `COPYING.txt` there), always in `UCI_Chess960` mode, so Chess960 works and castling comes back king-to-rook as chessops expects. The bot asks for the top few lines (MultiPV) at a fixed depth, then picks one using a temperature, a blunder rate and style bonuses. Chaotic bots grab captures and raid early with the queen, balanced ones turn aggressive when ahead, and positional ones castle early and trade down when ahead. A bot never misses a mate it can see. When power-ups limit moves (frozen pieces, Free Kick), the game passes `allowedMoves` and the bot searches only those.
- **Trivia.** Accuracy depends on difficulty, with Puskás goals harder still. Each bot does better on questions about its own club. Answer times fit inside the timer and are quicker on a Puskás. Card picks follow each bot's card weights: good quizzers go Hard, poor ones go Easy.
- **Power-ups.** In the app the bot tries every valid power-up and target with the engine and buys the best gain for its Form (see "It plans power-ups with the engine" in docs/game-design.md, and `src/bots/planner.ts`). Each bot's preference list only adds a small nudge, and Florence and Ragnar still save Form for Extra Time and Super-Sub. When the game sends no options (the older `tools/playtest/fullgame.ts`), the bot falls back to rules of thumb in `src/bots/powerUps.ts`: VAR Review after a blunder, Tactical Foul on the most valuable enemy piece, Red Card on the most advanced legal pawn.
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
- **Hot Spots.** The game passes the Hot Spots. Moves onto one get a bonus of `(own-club accuracy − 0.5) × 100` centipawns, capped at 40 (a Hot Spot is a club question at normal Form since round 3). Hot Spot moves that aren't in the engine's top lines get a separate search so they can be considered.
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

## Trivia Elo and the high score

Freddie's idea (4 and 7 Nov 2026): a trivia rating next to the chess one, and a high score that is the biggest combined rating you've beaten, with the two balanced so they compare fairly. The code is in `src/game/triviaElo.ts`.

**Trivia Elo** uses the chess Elo curve. Each question has a rating: Tap-in 1000, Highlight 1300, Screamer 1600, Puskás 1800. A quizzer rated R gets a question rated Q right with chance 1 / (1 + 10^((Q − R) / 400)), so someone rated 1600 gets half their Screamers right. A 55% quizzer comes out at about 1350, and each extra 10% of accuracy adds about 105.

- **Bots** get theirs from their accuracy at each difficulty (the best-fitting rating).
- **You** start at 1350, and your rating moves after each game against a bot, one answer at a time, like a chess rating (K = 40 for your first 30 answers, then 24, then 16 after 100). Only question cards count, not "Who am I?" or shootout kicks. Pass and Play doesn't count, because two people share the device.
- Labels build up to **Elite Ball Knowledge** at 1800: Plastic, Casual fan (1000), Matchday regular (1200), Season-ticket holder (1400), Pundit (1600).

**Combined rating** = chess Elo + `TRIVIA_WEIGHT` × (trivia Elo − 1350). An average quizzer's combined rating is just their chess rating. The weight says how many chess Elo points one trivia Elo point is worth in a real game. It is 0.35, measured with the full-game playtest below.

**Measuring the weight** (7 Nov 2026, `tools/playtest/fullgame.ts`, 96 games with the round-3 Form rules). Both sides play Stockfish `UCI_Elo 1320` chess; only their trivia accuracy differs. A Stockfish 1600 side was added as a check on the chess scale, and it fitted at 1599.

| Trivia accuracy | Trivia Elo | Plays like (chess Elo) |
| --- | --- | --- |
| 35% | 1143 | 1247 |
| 55% | 1352 | 1320 (anchor) |
| 75% | 1572 | 1440 |
| 95% | 1795 | 1484 |

Going from 35% to 95% (650 trivia Elo) was worth about 240 chess Elo, so 0.36 chess points per trivia point. The steps in between ranged from 0.2 to 0.55, because 24 games a pairing is still noisy. Trivia matters more than the early run suggested, but chess still decides most games, and the gains taper off at the top.

**High score.** The High scores page shows your **best win**: the bot with the highest combined rating you've beaten, with its chess and trivia Elo. It also shows your trivia Elo and title. Reset clears both.

| Bot | Chess | Trivia Elo | Combined |
| --- | --- | --- | --- |
| Pawny Dribbles | 400 | 1317 | 388 |
| Eezy Peasy | 600 | 1609 | 691 |
| Billy Chillwall | 800 | 1411 | 821 |
| Gambit Gary | 1000 | 1699 | 1122 |
| Mo Mate | 1200 | 1490 | 1249 |
| Florence Knightingale | 1400 | 1532 | 1464 |
| Ragnar Rookland | 1600 | 1269 | 1572 |
| Ollie (low) | 450 | 1584 | 532 |
| Ollie (medium) | 600 | 1744 | 738 |
| Ollie (hard) | 900 | 1877 | 1084 |
| Ryan (low) | 950 | 1428 | 977 |
| Ryan (medium) | 1300 | 1532 | 1364 |
| Ryan (hard) | 1600 | 1631 | 1698 |
| Freddie (low) | 1600 | 1146 | 1529 |
| Freddie (medium) | 1800 | 1238 | 1761 |
| Freddie (hard) | 2150 | 1314 | 2137 |

Known harness issue: when many games run in parallel, a Stockfish child process sometimes exits (code 7) and the run stops. Run fewer shards at once, or add a restart.
