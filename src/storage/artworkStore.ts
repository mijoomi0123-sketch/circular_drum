import { CHANNELS } from '../audio/channels';
import { clampBpm, clampSteps, clonePatterns, MAX_STEPS, patternsFromRhythm } from '../audio/pattern';
import { COLORS, isColorId } from '../presets/colors';
import { createDefaultArtworks } from '../presets/defaultArtworks';
import { DEFAULT_RHYTHM, RHYTHMS } from '../presets/rhythms';
import type { Artwork, ChannelColors, ChannelPatterns, ColorId } from '../types';

/**
 * Artwork settings are kept in localStorage under one key, as JSON. Only
 * settings and references are stored; audio stays in public/audio/.
 */
export const STORAGE_KEY = 'circular-drum.artworks.v1';

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/**
 * Step rows. Artworks saved before rows existed get rows made from their
 * rhythm preset at their saved step count, so they keep sounding the same.
 * Old volume and level values are simply no longer read.
 */
function sanitizePatterns(raw: unknown, rhythm: string, steps: number): ChannelPatterns {
  const fallback = patternsFromRhythm(rhythm, steps);
  if (!raw || typeof raw !== 'object') return fallback;
  const r = raw as Record<string, unknown>;
  const out = clonePatterns(fallback);
  for (const ch of CHANNELS) {
    const row = r[ch];
    if (Array.isArray(row)) out[ch] = Array.from({ length: MAX_STEPS }, (_, i) => row[i] === true || row[i] === 1);
  }
  return out;
}

/** Same color for all four instruments (how older artworks sounded). */
export function uniformColors(color: ColorId): ChannelColors {
  return { kick: color, snare: color, hihat: color, clap: color };
}

/**
 * Per-instrument colors. Artworks saved before these existed get their one
 * artwork color on all four instruments, so they keep the same samples.
 */
function sanitizeColors(raw: unknown, fallback: ColorId): ChannelColors {
  const out = uniformColors(fallback);
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    for (const ch of CHANNELS) if (isColorId(r[ch])) out[ch] = r[ch] as ColorId;
  }
  return out;
}

/** Repairs one stored record; returns null if it cannot be used. */
export function sanitizeArtwork(raw: unknown): Artwork | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  if (typeof a.id !== 'string' || !a.id) return null;
  const d = (a.design ?? {}) as Record<string, unknown>;
  const rhythm = typeof d.rhythm === 'string' && RHYTHMS.some((r) => r.id === d.rhythm) ? d.rhythm : DEFAULT_RHYTHM;
  const now = Date.now();
  const steps = clampSteps(num(a.steps, 16));
  const color = isColorId(a.color) ? a.color : 'orange';
  const colors = sanitizeColors(a.colors, color);
  return {
    id: a.id,
    name: typeof a.name === 'string' && a.name.trim() ? a.name.trim().slice(0, 60) : 'Untitled',
    color: colors.kick,
    colors,
    bpm: clampBpm(num(a.bpm, 120)),
    steps,
    loop: typeof a.loop === 'boolean' ? a.loop : true,
    patterns: sanitizePatterns(a.patterns, rhythm, steps),
    design: {
      seed: Math.floor(num(d.seed, 1)),
      scale: Math.min(1, Math.max(0.55, num(d.scale, 0.85))),
      rhythm,
    },
    createdAt: num(a.createdAt, now),
    updatedAt: num(a.updatedAt, now),
  };
}

function defaultStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined; // blocked in private windows or some embedded viewers
  }
}

export function loadArtworks(storage: Storage | undefined = defaultStorage()): Artwork[] {
  try {
    const text = storage?.getItem(STORAGE_KEY);
    if (text) {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) return parsed.map(sanitizeArtwork).filter((x): x is Artwork => x !== null);
    }
  } catch (err) {
    console.error('[Circular Drum] Could not read saved artworks, starting from defaults.', err);
  }
  const defaults = createDefaultArtworks();
  saveArtworks(defaults, storage);
  return defaults;
}

export function saveArtworks(list: Artwork[], storage: Storage | undefined = defaultStorage()): boolean {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (err) {
    console.error('[Circular Drum] Could not save artworks.', err);
    return false;
  }
}

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `art-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function duplicateArtwork(a: Artwork, now = Date.now()): Artwork {
  return {
    ...a,
    design: { ...a.design },
    patterns: clonePatterns(a.patterns),
    colors: { ...a.colors },
    id: newId(),
    name: `${a.name} copy`,
    createdAt: now,
    updatedAt: now,
  };
}

/** A new artwork. `index` picks its color so new ones cycle through all seven. */
export function createArtwork(index = 0, now = Date.now()): Artwork {
  const seed = Math.floor(Math.random() * 1e9);
  const rhythm = RHYTHMS[seed % RHYTHMS.length].id;
  return {
    id: newId(),
    name: `Artwork ${index + 1}`,
    color: COLORS[index % COLORS.length].id,
    // A fresh artwork starts with four different colors (and so four
    // different sample groups), spaced around the palette.
    colors: {
      kick: COLORS[index % COLORS.length].id,
      snare: COLORS[(index + 2) % COLORS.length].id,
      hihat: COLORS[(index + 4) % COLORS.length].id,
      clap: COLORS[(index + 5) % COLORS.length].id,
    },
    bpm: 120,
    steps: 16,
    loop: true,
    patterns: patternsFromRhythm(rhythm, 16),
    design: { seed, scale: 0.7 + (seed % 30) / 100, rhythm },
    createdAt: now,
    updatedAt: now,
  };
}
