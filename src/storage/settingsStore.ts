import { useSyncExternalStore } from 'react';
import { setSoundTheme } from '../audio/sampleMap';
import { setPaletteTheme } from '../presets/gradients';

/**
 * App-wide preferences (not part of any artwork): light/dark theme and the
 * global volume. Stored in localStorage under their own key, so artworks and
 * their data are never touched.
 */
export const SETTINGS_KEY = 'circular-drum.settings.v1';

export type Theme = 'light' | 'dark';

export interface AppSettings {
  theme: Theme;
  /** Global volume, 0–1. 1 is the original playback level. */
  volume: number;
  /**
   * All Animations: whether circles may move at all. Each circle's own on/off
   * stays in the saved fullscreen layout and is never changed by this switch;
   * a circle moves only when both are on.
   */
  animations: boolean;
}

function systemTheme(): Theme {
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function load(): AppSettings {
  let raw: Partial<AppSettings> = {};
  try {
    raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') ?? {};
  } catch {
    raw = {};
  }
  const theme: Theme = raw.theme === 'dark' || raw.theme === 'light' ? raw.theme : systemTheme();
  const volume = typeof raw.volume === 'number' && Number.isFinite(raw.volume) ? Math.min(1, Math.max(0, raw.volume)) : 1;
  const animations = raw.animations !== false;
  return { theme, volume, animations };
}

let current: AppSettings = load();
const listeners = new Set<() => void>();

function applyTheme(theme: Theme) {
  setPaletteTheme(theme); // circle colors follow the theme (see presets/gradients.ts)
  // Both themes play the same sounds: the original (Dark Mode) samples. The Light Mode set stays in
  // public/audio/light/ but is no longer used (see audio/sampleMap.ts).
  setSoundTheme('dark');
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#000000' : '#fafafa');
}
applyTheme(current.theme);

export function getSettings(): AppSettings {
  return current;
}

export function updateSettings(patch: Partial<AppSettings>) {
  current = { ...current, ...patch };
  if (patch.volume !== undefined) current.volume = Math.min(1, Math.max(0, patch.volume));
  // Saved as soon as it is chosen; only the theme, volume and All Animations are written here.
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(current));
  } catch {
    /* storage blocked: the choice still applies for this visit */
  }
  if (patch.theme) applyTheme(current.theme);
  listeners.forEach((fn) => fn());
}

export function subscribeSettings(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useSettings(): AppSettings {
  return useSyncExternalStore(subscribeSettings, getSettings);
}
