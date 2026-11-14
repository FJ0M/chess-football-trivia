import { useCallback, useEffect, useState } from "react";
import { GameScreen } from "./components/GameScreen";
import { SetupScreen } from "./components/SetupScreen";
import { AchievementsHead, GAME_NAME, HistoryScreen, MainMenu, PauseMenu, PlayMenu, ScoresScreen, type AchievementsTab } from "./components/Menus";
import { loadScores, recordGame } from "./game/scores";
import { awardBadges, type NewBadge } from "./game/badges";
import { BadgeToast, CabinetScreen } from "./components/Cabinet";
import { botList, loadBots } from "./game/bots";
import { loadTriviaRating, saveTriviaRating, updateTriviaRating } from "./game/triviaElo";
import { entryFor, recordHistory, usedAssist, type MatchStats } from "./game/history";
import type { SetupChoice } from "./game/useGame";
import type { GameState } from "./game/types";
import { clearMatch, loadMatch, matchLabel, type SavedMatch } from "./game/savedMatch";
import { RulesScreen } from "./components/HowToPlay";
import { SettingsPanel } from "./components/SettingsPanel";
import { getStyle } from "./theme/themes";
import { loadStyleFonts } from "./theme/fonts";
import { loadSettings, saveSettings, type Settings } from "./settings/settings";
import { isAudioUnlocked, setMusicVolume, setSfxVolume, unlockAudio } from "./audio/engine";
import { music } from "./audio/music";
import { playSfx, type SfxName } from "./audio/sfx";

/** Vibration patterns (ms) for the moments that matter. */
const BUZZ: Partial<Record<SfxName, number | number[]>> = { capture: 25, check: [20, 40, 20], wrong: 90, correct: 15, fulltime: [60, 60, 120] };

export function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<"menu" | "play" | "setup" | "game" | "achievements" | "rules">("menu");
  const [tab, setTab] = useState<AchievementsTab>("cabinet");
  const [mode, setMode] = useState<"bot" | "local">("bot");
  const [setup, setSetup] = useState<SetupChoice | null>(null);
  const [gameKey, setGameKey] = useState(0);
  const [paused, setPaused] = useState(false);
  /** A match saved before the page was reloaded, offered on the main menu. */
  const [saved, setSaved] = useState<SavedMatch | null>(() => loadMatch());
  const [resume, setResume] = useState<SavedMatch | undefined>(undefined);
  const [newBadges, setNewBadges] = useState<NewBadge[]>([]);
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
    loadStyleFonts(style.id);
    document.documentElement.dataset.style = style.id;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", style.chrome);
  }, [style]);

  const pause = useCallback(() => setPaused(true), []);
  const play = useCallback((s: SfxName) => {
    if (settings.sfxOn) playSfx(s, style.voice);
    // A little buzz on phones that support it (Android), unless motion is turned down.
    const buzz = settings.reduceMotion ? undefined : BUZZ[s];
    if (buzz) try { navigator.vibrate?.(buzz); } catch { /* not supported */ }
  }, [settings.sfxOn, settings.reduceMotion, style.voice]);

  return (
    <div className={`app${screen === "menu" ? " app-menu" : screen === "game" ? " app-game" : ""}`}>
      {/* No header during a match: the game fills the screen, and its Menu button pauses (Settings are in there). */}
      {screen !== "menu" && screen !== "game" && <header className="appbar">
        <button type="button" className="title" onClick={() => setScreen("menu")}>{GAME_NAME}</button>
        <button type="button" className="gear" aria-label="Settings" onClick={() => setOpen(true)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
        </button>
      </header>}
      {screen !== "game" && <p className="tap-note" style={{ visibility: audioReady ? "hidden" : "visible" }}>Tap anywhere to turn on sound</p>}
      {screen === "menu" && <MainMenu
        resume={saved ? { label: matchLabel(saved), onResume: () => { setSetup(saved.setup); setResume(saved); setGameKey((k) => k + 1); setPaused(true); setScreen("game"); } } : undefined}
        onPlay={() => setScreen("play")} onAchievements={() => setScreen("achievements")} onSettings={() => setOpen(true)} />}
      {screen === "play" && <PlayMenu onPick={(m) => { setMode(m); setScreen("setup"); }} onRules={() => setScreen("rules")} onBack={() => setScreen("menu")} />}
      {screen === "setup" && <SetupScreen mode={mode} onBack={() => setScreen("play")} onStart={(s) => { clearMatch(); setSaved(null); setResume(undefined); setSetup(s); setGameKey((k) => k + 1); setPaused(false); setScreen("game"); }} />}
      {screen === "achievements" && (() => {
        const back = () => setScreen("menu");
        const head = <AchievementsHead tab={tab} onTab={setTab} onBack={back} />;
        if (tab === "scores") return <ScoresScreen onBack={back} head={head} />;
        if (tab === "history") return <HistoryScreen onBack={back} head={head} />;
        return <CabinetScreen onBack={back} head={head} />;
      })()}
      {screen === "rules" && <RulesScreen onBack={() => setScreen("play")} />}
      {screen === "game" && setup && (
        <GameScreen key={gameKey} resume={resume} style={style} play={play} setup={setup} view={settings.passAndPlayView} motion={!settings.reduceMotion} commentary={settings.commentary} paused={paused || open}
          onPause={pause} onExit={() => { setSaved(loadMatch()); setScreen("menu"); }}
          onFinish={async (g: GameState, stats: MatchStats) => {
            const human = g.players.white.kind === "human" ? "white" : "black";
            const entry = entryFor(g, stats, setup.botLevel);
            if (entry) recordHistory(entry);
            if (g.options.mode !== "bot") { recordGame(g, setup.botLevel, stats.formEarned[human]); return; }
            // Your trivia Elo moves with your answers against bots (Pass and Play shares a device, so it doesn't count).
            if (stats.answers[human].length) saveTriviaRating(updateTriviaRating(loadTriviaRating(), stats.answers[human]));
            const botId = g.players[human === "white" ? "black" : "white"].botId;
            const meta = await loadBots().then((m) => botList(m).find((b) => b.id === botId)).catch(() => undefined);
            const rating = meta?.ratings?.[setup.botLevel];
            const prevBestMatch = loadScores().best?.match;
            recordGame(g, setup.botLevel, stats.formEarned[human], rating, new Date(), usedAssist(stats, human));
            const won = awardBadges({ game: g, stats, human, botMatch: rating?.match, prevBestMatch });
            if (won.length) { setNewBadges(won); play("cheer"); }
          }} />
      )}
      {screen === "game" && paused && !open && (
        <PauseMenu onResume={() => setPaused(false)} onRestart={() => { clearMatch(); setResume(undefined); setGameKey((k) => k + 1); setPaused(false); }} onSettings={() => setOpen(true)} onQuit={() => { setPaused(false); setSaved(loadMatch()); setScreen("menu"); }} />
      )}
      {newBadges.length > 0 && !(screen === "achievements" && tab === "cabinet") && (
        <BadgeToast badges={newBadges} onOpen={() => { setNewBadges([]); setPaused(false); setTab("cabinet"); setScreen("achievements"); }} onClose={() => setNewBadges([])} />
      )}
      {open && <SettingsPanel settings={settings} onChange={setSettings} onClose={() => setOpen(false)} play={play} />}
    </div>
  );
}
