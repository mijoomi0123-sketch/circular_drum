import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { updateSettings, useSettings } from '../storage/settingsStore';
import { SettingsIcon, VolumeIcon } from './PlayIcons';

/** Open state of a small icon popover: closes on the icon again, a press outside, or Escape (focus back on the icon). */
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  return { open, setOpen, ref, btn };
}

/** The theme icon at the top right: one click switches Dark Mode ↔ Light Mode (saved). */
export function SettingsMenu() {
  const { theme } = useSettings();
  const dark = theme === 'dark';
  return (
    <div className="settings">
      <button
        type="button"
        className="add-btn gear-btn"
        aria-label="Dark Mode"
        aria-pressed={dark}
        title={dark ? 'Dark Mode: on (click for Light Mode)' : 'Dark Mode: off (click for Dark Mode)'}
        onClick={() => updateSettings({ theme: dark ? 'light' : 'dark' })}
      >
        <SettingsIcon />
      </button>
    </div>
  );
}

/**
 * The speaker icon at the top left: the global volume only. Its slider sets
 * the one master volume of the audio engine (saved), so every instrument,
 * preview and fullscreen circle follows it at once. The icon shows the level.
 */
export function VolumeMenu() {
  const { volume } = useSettings();
  const { open, setOpen, ref, btn } = usePopover();
  const pct = Math.round(volume * 100);
  const level = pct === 0 ? 0 : pct < 50 ? 1 : 2;

  return (
    <div className="settings" ref={ref}>
      <button
        type="button"
        ref={btn}
        className={`add-btn vol-btn${open ? ' is-open' : ''}`}
        aria-label={`Volume ${pct}%`}
        title={`Volume ${pct}%`}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-level={level}
        onClick={() => setOpen((o) => !o)}
      >
        <VolumeIcon level={level} />
      </button>
      {open && (
        <div className="settings-panel is-below is-left" role="dialog" aria-label="Volume">
          <label className="settings-volume" style={{ '--pct': `${pct}%` } as CSSProperties}>
            <span className="settings-row">
              <span>Volume</span>
              <span className="settings-value">{pct}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={pct}
              aria-label="Global Volume"
              aria-valuetext={`${pct}%`}
              onChange={(e) => updateSettings({ volume: Number(e.currentTarget.value) / 100 })}
            />
          </label>
        </div>
      )}
    </div>
  );
}
