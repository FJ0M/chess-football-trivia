# Question bank

`questions.json` holds the trivia questions. Do not edit it by hand: edit `tools/build_questions.py` and run

    python3 tools/build_questions.py data/questions.json

The script checks every question has 4 unique options, shuffles where the right answer sits, and writes the file.

General and West Ham questions live in `tools/build_questions.py`. Club questions for the other 91 clubs live in `tools/clubs/` (one file per division, ids in `tools/clubs/clubs.py`), and the build merges them in and prints a per-club count by difficulty.

Each question:

```json
{"id":"whu-0005","question":"...","options":["a","b","c","d"],"answer":2,
 "difficulty":"easy|medium|hard","topic":"West Ham moments","club":"west-ham",
 "verified":true,"explanation":"Shown after the player answers.",
 "source":"https://en.wikipedia.org/wiki/..."}
```

- `answer` is the index of the correct option.
- `topic` is short, for the question cards. Topics: Title races, Goals & records, Legends, Transfers, Managers, Big moments, Clubs & grounds, Cups & Europe, World Cup, Euros, International cups (Copa América, Nations League, Africa Cup of Nations), These Streets Won't Forget (cult heroes who faded), Record books (Premier League stat records: top scorer by nationality, cards, free kicks, penalties), West Ham moments, West Ham players, West Ham bosses.
- `club` is a kebab-case club id (e.g. `west-ham`) for club-specific questions, or null for general ones. `club: "west-ham"` questions feed the West Ham bonus rounds (Hot Spot squares).
- Club questions use the topic form `<club short name> <kind>`, where kind is one of: history, players, bosses, big moments, home & identity (e.g. `York big moments`).
- `source` is the page each question was checked against. Every question has one.
  - Club questions: every fact was read from that page on 2026-11-04; nothing was written from memory.
  - Round 3 general questions (ids `wor-`, `eur-`, `int-`, `str-`, `rec-`, and `tit-0034`, `goa-0031`, `goa-0032`, `pla-0029`, `pla-0030`, `man-0029`, `man-0030`, `mom-0020`): each fact was read on its page on 2026-11-07, and questions were reworded until the page supported every detail.
  - The first 324 general and West Ham questions were written from memory with spot checks. Their `source` is the most relevant Wikipedia article, added on 2026-11-07 but not yet re-read line by line.
- Clubs: all 92 clubs in the 2026-27 Premier League, Championship, League One and League Two. Each has at least 10 questions per difficulty, so a player who picks their club always gets tailored cards. West Ham's club questions are the 83 West Ham questions in the general bank.
- Scope: Premier League from 2000-01 onwards, plus a few all-time records, West Ham history, and the World Cup, Euros, Copa América, Nations League and Africa Cup of Nations since 2000.
- Facts current to the 2024-25 season (round 3 questions to November 2026; nothing about the 2026 World Cup's results). Questions about "records" may go stale; check them each season.

## Who am I? (pawn promotion)

`whoami.json` holds the "Who am I?" clue sets used for pawn promotion. Do not edit it by hand: edit `tools/build_whoami.py` and run

    python3 tools/build_whoami.py data/whoami.json

Each set has five clues (hardest first), four `options`, the `answer` index, `club` (null for general Premier League players, or a club id for a club set) and the Wikipedia `source` every clue was checked against on 2026-11-04. v1: 30 general, 10 West Ham, 8 Brighton.
