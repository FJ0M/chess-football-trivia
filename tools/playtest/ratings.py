"""Fits ratings to playtest results (Bradley-Terry / Elo maximum likelihood).

    python3 tools/playtest/ratings.py results1.json [results2.json ...]

One Stockfish anchor (sf-1320 by default) is pinned to its UCI_Elo; everything
else is fitted. The other sf-* anchors are fitted too, as a check on how well
Stockfish's own Elo setting holds up at these short time limits.
"""
import json
import math
import sys
from collections import defaultdict

ANCHOR = "sf-1320"

def main(paths):
    global ANCHOR
    if paths and paths[0].startswith("--anchor="):
        ANCHOR = paths[0].split("=", 1)[1]
        paths = paths[1:]
    games = []
    for p in paths:
        games += json.load(open(p))
    players = sorted({g["white"] for g in games} | {g["black"] for g in games})
    r = {p: 1200.0 for p in players}
    if ANCHOR in r:
        r[ANCHOR] = float(ANCHOR[3:].split("+")[0])
    # Gradient ascent on the log-likelihood, with a weak prior towards 1200 so
    # a clean sweep can't run off to infinity.
    for _ in range(4000):
        grad = defaultdict(float)
        for g in games:
            w, b, s = g["white"], g["black"], g["score"]
            e = 1 / (1 + 10 ** ((r[b] - r[w]) / 400))
            grad[w] += s - e
            grad[b] -= s - e
        for p in players:
            if p == ANCHOR:
                continue
            grad[p] -= (r[p] - 1200) / 400 ** 2 * 2
            r[p] += 8 * grad[p]

    stats = defaultdict(lambda: [0, 0.0])
    for g in games:
        stats[g["white"]][0] += 1
        stats[g["white"]][1] += g["score"]
        stats[g["black"]][0] += 1
        stats[g["black"]][1] += 1 - g["score"]

    print(f"{len(games)} games\n")
    print(f"{'player':16} {'rating':>7} {'games':>6} {'score':>6}")
    for p in sorted(players, key=lambda p: -r[p]):
        n, s = stats[p]
        print(f"{p:16} {r[p]:7.0f} {n:6d} {s / n:6.0%}")

    # Head-to-head table for adjacent pairs.
    print("\nhead to head (score of the first player)")
    h2h = defaultdict(lambda: [0, 0.0])
    for g in games:
        a, b = sorted([g["white"], g["black"]])
        h2h[(a, b)][0] += 1
        h2h[(a, b)][1] += g["score"] if g["white"] == a else 1 - g["score"]
    for (a, b), (n, s) in sorted(h2h.items()):
        print(f"  {a:16} vs {b:16} {s:4.1f}/{n}")

    reasons = defaultdict(int)
    for g in games:
        reasons[g["reason"]] += 1
    print("\nendings:", dict(reasons))
    avg = sum(g["plies"] for g in games) / len(games)
    print(f"average length: {avg / 2:.0f} moves; Chess960 games: {sum(g['chess960'] for g in games)}")


if __name__ == "__main__":
    main(sys.argv[1:])
