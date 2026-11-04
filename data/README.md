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
- `topic` is short, for the question cards. Topics: Title races, Goals & records, Legends, Transfers, Managers, Big moments, Clubs & grounds, Cups & Europe, West Ham moments, West Ham players, West Ham bosses.
- `club` is a kebab-case club id (e.g. `west-ham`) for club-specific questions, or null for general ones. `club: "west-ham"` questions feed the West Ham bonus rounds (Hot Spot squares).
- Club questions use the topic form `<club short name> <kind>`, where kind is one of: history, players, bosses, big moments, home & identity (e.g. `York big moments`).
- `source` is the page each club question was checked against (club questions only). Every club fact was read from that page on 2026-11-04; nothing was written from memory.
- Clubs: all 92 clubs in the 2026-27 Premier League, Championship, League One and League Two. Each has at least 10 questions per difficulty, so a player who picks their club always gets tailored cards. West Ham's club questions are the 57 West Ham questions in the general bank.
- Scope: Premier League from 2000-01 onwards, plus a few all-time records and West Ham history.
- Facts current to the 2024-25 season. Questions about "records" may go stale; check them each season.
