# Chess Football Trivia

A chess game where Premier League trivia (2000/01 onwards, with West Ham bonus rounds) earns you Form to spend on power-ups and hints. Play against bots based on Freddie, Ryan and Ollie, or pass and play on one device. Built as an installable web app (PWA) for phone, tablet and computer.

- [Game design](docs/game-design.md)
- [Research: existing chess x trivia games](https://claude.ai/artifact/288D72mj429RgxhCALFLa8)
- [Visual style, sound and music](docs/visual-style.md)
- [Bots, their ratings and the playtest](docs/bots.md)

## Run it

```sh
npm install
npm run dev     # local dev server
npm test        # unit tests
npm run build   # production build in dist/
```

Pushes to `main` deploy to GitHub Pages through `.github/workflows/deploy.yml` (turn on Pages with "GitHub Actions" as the source in the repo settings).

