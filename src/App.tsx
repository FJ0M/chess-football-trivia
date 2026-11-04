import { useCallback, useEffect, useState } from "react";
import { GameScreen } from "./components/GameScreen";
import { SettingsPanel } from "./components/SettingsPanel";
import { getStyle } from "./theme/themes";
import { loadSettings, saveSettings, type Settings } from "./settings/settings";
import { isAudioUnlocked, setMusicVolume, setSfxVolume, unlockAudio } from "./audio/engine";
import { music } from "./audio/music";
import { playSfx, type SfxName } from "./audio/sfx";

export function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [open, setOpen] = useState(false);
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
        <span className="title">Chess Football Trivia</span>
        <button type="button" className="gear" aria-label="Settings" onClick={() => setOpen(true)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
        </button>
      </header>
      <p className="tap-note" style={{ visibility: audioReady ? "hidden" : "visible" }}>Tap anywhere to turn on sound</p>
      <GameScreen style={style} play={play} />
      {open && <SettingsPanel settings={settings} onChange={setSettings} onClose={() => setOpen(false)} play={play} />}
    </div>
  );
}
