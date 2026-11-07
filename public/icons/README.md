# Game logo and app icons

A penalty: the white pawn about to take a spot kick against the black pawn in goal, in front of a stand of fans. Both pawns have football heads and football-patterned bodies. This is option 2 ("Face-off") of the five in `docs/design/logo-options/`. Drawn by `tools/make_logo.py`, which uses `tools/logo_options.py`.

- `logo.svg`: rounded square, used for the favicon and anywhere in the app.
- `logo-maskable.svg`: full-bleed version with the artwork inside the maskable safe zone.
- PNGs (`icon-192`, `icon-512`, `icon-maskable-512`, `apple-touch-icon` at 180, `favicon-32`) are screenshots of the SVGs at those sizes from headless Chromium. Re-render them if the SVGs change.
