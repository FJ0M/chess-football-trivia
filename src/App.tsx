import { useCallback, useEffect, useState } from "react";
import { GameScreen } from "./components/GameScreen";
import { SetupScreen } from "./components/SetupScreen";
import { MainMenu, PauseMenu, RulesScreen, ScoresScreen } from "./components/Menus";
import { recordGame } from "./game/scores";
import type { SetupChoice } from "./game/useGame";
import type { GameState } from "./game/types";
import { SettingsPanel } from "./components/SettingsPanel";
import { getStyle } from "./theme/themes";
import { loadSettings, saveSettings, type Settings } from "./settings/settings";
import { isAudioUnlocked, setMusicVolume, setSfxVolume, unlockAudio } from "./audio/engine";
import { music } from "./audio/music";
import { playSfx, type SfxName } from "./audio/sfx";

export function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<"menu" | "setup" | "game" | "scores" | "rules">("menu");
  const [mode, setMode] = useState<"bot" | "local">("bot");
  const [setup, setSetup] = useState<SetupChoice | null>(null);
  const [gameKey, setGameKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const [audioReady, setAudioReady] = useState(isAudioUnlocked());
  const style = getStyle(settings.style);

  // Browsers block audio until the first tap or key press.
  useEffect(() => {
    const unlock = () => { unlockAudio(); setAudioReady(true); };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => { saveSettings(settings); }, [settings]);
  useEffect(() => { setSfxVolume(settings.sfxOn ? settings.sfxVolume : 0); }, [settings.sfxOn, settings.sfxVolume]);
  useEffect(() => { setMusicVolume(settings.musicVolume); }, [settings.musicVolume]);

  const track = settings.musicTrack === "match" ? style.music : settings.musicTrack;
  useEffect(() => {
    if (!audioReady) return;
    if (settings.musicOn) music.play(track);
    else music.stop();
  }, [audioReady, settings.musicOn, track]);

  useEffect(() => {
    document.documentElement.dataset.style = style.id;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", style.chrome);
  }, [style]);

  const play = useCallback((s: SfxName) => { if (settings.sfxOn) playSfx(s, style.voice); }, [settings.sfxOn, style.voice]);

  return (
    <div className="app">
      <header className="appbar">
        <button type="button" className="title" onClick={() => (screen === "game" ? setPaused(true) : setScreen("menu"))}>They Think It's Checkmate</button>
        <button type="button" className="gear" aria-label="Settings" onClick={() => setOpen(true)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
        </button>
      </header>
      <p className="tap-note" style={{ visibility: audioReady ? "hidden" : "visible" }}>Tap anywhere to turn on sound</p>
      {screen === "menu" && <MainMenu onPlay={(m) => { setMode(m); setScreen("setup"); }} onSettings={() => setOpen(true)} onScores={() => setScreen("scores")} onRules={() => setScreen("rules")} />}
      {screen === "setup" && <SetupScreen mode={mode} onBack={() => setScreen("menu")} onStart={(s) => { setSetup(s); setGameKey((k) => k + 1); setPaused(false); setScreen("game"); }} />}
      {screen === "scores" && <ScoresScreen onBack={() => setScreen("menu")} />}
      {screen === "rules" && <RulesScreen onBack={() => setScreen("menu")} />}
      {screen === "game" && setup && (
        <GameScreen key={gameKey} style={style} play={play} setup={setup} view={settings.passAndPlayView} paused={paused || open}
          onPause={() => setPaused(true)} onExit={() => setScreen("menu")}
          onFinish={(g: GameState) => { const human = g.players.white.kind === "human" ? "white" : "black"; recordGame(g, setup.botLevel, g.players[human].form); }} />
      )}
      {screen === "game" && paused && !open && (
        <PauseMenu onResume={() => setPaused(false)} onRestart={() => { setGameKey((k) => k + 1); setPaused(false); }} onSettings={() => setOpen(true)} onQuit={() => { setPaused(false); setScreen("menu"); }} />
      )}
      {open && <SettingsPanel settings={settings} onChange={setSettings} onClose={() => setOpen(false)} play={play} />}
    </div>
  );
}
