import { getStyle } from "../theme/themes";
import { TRACKS } from "../audio/music";
import { SFX_LABELS, type SfxName } from "../audio/sfx";
import { DEFAULT_SETTINGS, VIEWS, type Settings } from "../settings/settings";
import { VIEW_INFO, ViewArt } from "./ViewArt";
import { StylePicker } from "./StylePicker";

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
  play: (s: SfxName) => void;
}

export function SettingsPanel({ settings, onChange, onClose, play }: Props) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v });
  const matchName = TRACKS.find((t) => t.id === getStyle(settings.style).music)?.name;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2 id="settings-title">Settings</h2>
          <button type="button" className="ghost" onClick={onClose}>Done</button>
        </header>

        <h3>Look</h3>
        <StylePicker value={settings.style} defaultId={DEFAULT_SETTINGS.style} onChange={(id) => set("style", id)} />

        <h3>Sound effects</h3>
        <div className="row">
          <label className="toggle" htmlFor="sfx-on">
            <input type="checkbox" id="sfx-on" checked={settings.sfxOn} onChange={(e) => set("sfxOn", e.target.checked)} />
            <span>Sound effects</span>
          </label>
          <input type="range" id="sfx-volume" aria-label="Sound effects volume" min={0} max={1} step={0.05} value={settings.sfxVolume} disabled={!settings.sfxOn}
            onChange={(e) => set("sfxVolume", Number(e.target.value))} onPointerUp={() => play("move")} />
        </div>
        <details className="sounds">
          <summary>Hear every sound</summary>
          <div className="sound-grid">
            {(Object.keys(SFX_LABELS) as SfxName[]).map((n) => (
              <button key={n} type="button" onClick={() => play(n)} disabled={!settings.sfxOn}>{SFX_LABELS[n]}</button>
            ))}
          </div>
        </details>

        <h3>Music</h3>
        <div className="row">
          <label className="toggle" htmlFor="music-on">
            <input type="checkbox" id="music-on" checked={settings.musicOn} onChange={(e) => set("musicOn", e.target.checked)} />
            <span>Music</span>
          </label>
          <input type="range" id="music-volume" aria-label="Music volume" min={0} max={1} step={0.05} value={settings.musicVolume} disabled={!settings.musicOn}
            onChange={(e) => set("musicVolume", Number(e.target.value))} />
        </div>
        <label className="select" htmlFor="music-track">
          <span>Track</span>
          <select id="music-track" value={settings.musicTrack} disabled={!settings.musicOn}
            onChange={(e) => set("musicTrack", e.target.value as Settings["musicTrack"])}>
            <option value="match">Match my style ({matchName})</option>
            {TRACKS.map((t) => <option key={t.id} value={t.id}>{t.name}: {t.mood}</option>)}
          </select>
        </label>

        <h3>Pass and Play</h3>
        <p className="sheet-note">How the screen faces each player</p>
        <div className="view-list" role="radiogroup" aria-label="Pass and Play view">
          {VIEWS.map((v) => (
            <label key={v} className={`view-option${settings.passAndPlayView === v ? " on" : ""}`}>
              <input type="radio" name="pnp-view" value={v} checked={settings.passAndPlayView === v} onChange={() => set("passAndPlayView", v)} />
              <ViewArt view={v} />
              <strong>{VIEW_INFO[v].name}</strong>
              <small>{VIEW_INFO[v].blurb}</small>
            </label>
          ))}
        </div>

        <button type="button" className="ghost reset" onClick={() => onChange({ ...DEFAULT_SETTINGS })}>Reset to defaults</button>
      </section>
    </div>
  );
}
