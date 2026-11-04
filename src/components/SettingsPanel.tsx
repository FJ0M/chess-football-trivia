import { STYLES, getStyle } from "../theme/themes";
import { TRACKS } from "../audio/music";
import { SFX_LABELS, type SfxName } from "../audio/sfx";
import { DEFAULT_SETTINGS, type Settings } from "../settings/settings";

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
        <div className="style-list" role="radiogroup" aria-label="Game style">
          {STYLES.map((s) => (
            <label key={s.id} className={`style-option${settings.style === s.id ? " on" : ""}`}>
              <input type="radio" name="style" id={`style-${s.id}`} value={s.id} checked={settings.style === s.id} onChange={() => set("style", s.id)} />
              <span className="sw">{s.swatches.map((c) => <i key={c} style={{ background: c }} />)}</span>
              <span className="txt">
                <strong>{s.name}{s.id === DEFAULT_SETTINGS.style && <em> Default</em>}</strong>
                <small>{s.blurb}</small>
              </span>
            </label>
          ))}
        </div>

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
        <label className="select" htmlFor="pnp-view">
          <span>How the screen faces each player</span>
          <select id="pnp-view" value={settings.passAndPlayView} onChange={(e) => set("passAndPlayView", e.target.value as Settings["passAndPlayView"])}>
            <option value="hand-over">Hand over: the board flips to whoever is up (best on a phone)</option>
            <option value="face-to-face">Face to face: board stays put, controls turn round (tablet on a table)</option>
            <option value="off">Off: White always at the bottom</option>
          </select>
        </label>

        <button type="button" className="ghost reset" onClick={() => onChange({ ...DEFAULT_SETTINGS })}>Reset to defaults</button>
      </section>
    </div>
  );
}
