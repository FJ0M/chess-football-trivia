# Question bank

`questions.json` holds the trivia questions. Do not edit it by hand: edit `tools/build_questions.py` and run

    python3 tools/build_questions.py data/questions.json

The script checks every question has 4 unique options, shuffles where the right answer sits, and writes the file.

Each question:

```json
{"id":"whu-0005","question":"...","options":["a","b","c","d"],"answer":2,
 "difficulty":"easy|medium|hard","topic":"West Ham moments","westHam":true,
 "verified":true,"explanation":"Shown after the player answers."}
```

- `answer` is the index of the correct option.
- `topic` is short, for the question cards. Topics: Title races, Goals & records, Legends, Transfers, Managers, Big moments, Clubs & grounds, Cups & Europe, West Ham moments, West Ham players, West Ham bosses.
- `westHam: true` questions feed the West Ham bonus rounds (Hot Spot squares).
- Scope: Premier League from 2000-01 onwards, plus a few all-time records and West Ham history.
- Facts current to the 2024-25 season. Questions about "records" may go stale; check them each season.
