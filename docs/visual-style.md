# Visual style, sound and music

**Default style: Tactics Board** (picked by Freddie, 4 Nov 2026). The other nine styles from the
[style mockups](https://claude.ai/artifact/RYAvLSQ1yr3PZrbZ14npFv) (source copy in
`docs/design/style-options.html`) are all available under **Settings → Look**.

| Style | Sound voice | Music when "Match my style" is on |
| --- | --- | --- |
| Tactics Board (default) | Marker: magnets clacking on a whiteboard | Training Ground |
| Floodlit Night | Warm | Under the Lights |
| Matchday Programme | Warm | Half-Time Organ |
| Sticker Album | Crisp | Half-Time Organ |
| Tabletop Flick | Warm: wood on felt | Training Ground |
| Terrace Fanzine | Crisp | Under the Lights |
| Live Broadcast | Crisp | Under the Lights |
| Teletext Page 302 | Chip: 8-bit beeps | Page 302 (chiptune) |
| Shirt Fabric | Warm | Half-Time Organ |
| Pundit Stats | Crisp | Training Ground |

No club crests or trademarked logos are used anywhere.

## Where things live

- `src/theme/themes.ts`: the list of styles, the default, and each style's sound voice and music track.
- `src/theme/themes.css`: one `.style-<id>` block per style. The game screen root gets `className="screen style-<id>"`.
- `src/settings/settings.ts`: settings saved in browser storage (style, sound on/off and volume, music on/off, volume and track). Bad or old saves are repaired, not crashed on.
- `src/audio/sfx.ts`: sound effects, all generated with Web Audio (no audio files to license): pick up, move, capture, check whistle, kick-off, full time, right and wrong answer, Form earned, power-up, not enough Form, timer tick, crowd cheer and groan.
- `src/audio/music.ts`: four original looping tracks played by a small sequencer. Melodies are written as note names, so they are easy to change.
- `src/components/SettingsPanel.tsx`: the Settings sheet, including a "Hear every sound" list for tuning.

Browsers only allow sound after the first tap, so audio starts on the first touch or key press.
Audio pauses when the app is in the background.

## Hooking it into the real game

`src/components/GameScreen.tsx` is a style preview with a free-move board (no chess rules yet).
When milestone 1 adds the real board, keep the class names it uses (`board`, `sq`, `l`, `last`,
`sel`, `spot`, `pc w|b`, `quiz`, `answers`, `powers`, `pw`, `locked`) and call `play("move")`,
`play("capture")`, `play("check")` and so on from the game events.
