import { colorForGroupNumber, COLORS, getColor } from '../presets/colors';
import type { Channel, ColorId, Instrument, SampleInfo } from '../types';
import {
  AUDIO_BASE_PATH,
  INSTRUMENT_KEYWORDS,
  INSTRUMENT_OVERRIDES,
  LIGHT_SAMPLE_FILES,
  SAMPLE_FILES,
} from './sampleConfig';

/**
 * Reads the color-group number at the start of a filename.
 * "01-1-kick.wav", "1-1-kick.wav" and "001_kick.wav" all give 1, so "01" and
 * "1" can never end up in different groups. Returns null when the name does
 * not start with a number.
 */
export function parseGroupNumber(file: string): number | null {
  const base = file.split('/').pop() ?? file;
  const m = /^\s*(\d+)/.exec(base);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Reads the instrument slot number, the second number of a filename:
 * "06-1-킥.wav" → 1. Returns null when there is none.
 */
export function parseSlotNumber(file: string): number | null {
  const base = file.split('/').pop() ?? file;
  const m = /^\s*\d+\s*[-_ ]\s*(\d+)/.exec(base);
  return m ? Number.parseInt(m[1], 10) : null;
}

/**
 * Finds the instrument from the words of a filename. Returns null when no
 * keyword matches or when keywords of different instruments match.
 */
export function parseInstrument(file: string): Instrument | null {
  const base = (file.split('/').pop() ?? file).normalize('NFC').toLowerCase();
  const stem = base.replace(/\.[a-z0-9]+$/, '');
  // Split into words on separators and digits so "kick_1" -> "kick", while
  // Korean words stay whole.
  const words = stem.split(/[\s\-_.()[\]0-9]+/).filter(Boolean);
  const found = new Set<Instrument>();
  for (const [instrument, keys] of Object.entries(INSTRUMENT_KEYWORDS) as [Instrument, readonly string[]][]) {
    for (const key of keys) {
      const k = key.normalize('NFC').toLowerCase();
      // Short ASCII codes (bd, sd, hh) must be whole words; longer keywords
      // and Korean words may appear inside a word ("kick" in "kickdrum").
      const hit = k.length <= 2 ? words.includes(k) : words.some((w) => w.includes(k));
      if (hit) found.add(instrument);
    }
  }
  return found.size === 1 ? [...found][0] : null;
}

export function resolveSample(file: string): SampleInfo {
  const groupNumber = parseGroupNumber(file) ?? -1;
  const override = INSTRUMENT_OVERRIDES[file];
  return {
    file,
    url: AUDIO_BASE_PATH + file.normalize('NFC').split('/').map(encodeURIComponent).join('/'),
    groupNumber,
    slotNumber: parseSlotNumber(file),
    color: colorForGroupNumber(groupNumber),
    instrument: override ?? parseInstrument(file),
  };
}

export interface SampleMapResult {
  /** color -> instrument -> sample */
  byColor: Record<ColorId, Partial<Record<Instrument, SampleInfo>>>;
  /** Files that were not assigned, with the reason. Reported, never guessed. */
  problems: { file: string; reason: string }[];
}

export function buildSampleMap(files: readonly string[] = SAMPLE_FILES): SampleMapResult {
  const byColor = Object.fromEntries(COLORS.map((c) => [c.id, {}])) as SampleMapResult['byColor'];
  const problems: SampleMapResult['problems'] = [];
  for (const file of files) {
    const s = resolveSample(file);
    if (!s.color) {
      problems.push({ file, reason: `no color group for number "${s.groupNumber}"` });
      continue;
    }
    if (!s.instrument) {
      problems.push({ file, reason: 'instrument not recognised; add it to INSTRUMENT_OVERRIDES' });
      continue;
    }
    const slot = byColor[s.color];
    if (slot[s.instrument]) {
      problems.push({ file, reason: `duplicate ${s.instrument} for ${s.color} (kept ${slot[s.instrument]!.file})` });
      continue;
    }
    slot[s.instrument] = s;
  }
  return { byColor, problems };
}

/** The mappings used by the app, computed once from sampleConfig.ts: Dark Mode (original) and Light Mode. */
export const SAMPLE_MAP = buildSampleMap();
export const LIGHT_SAMPLE_MAP = buildSampleMap(LIGHT_SAMPLE_FILES);
export const SAMPLE_PROBLEMS = [...SAMPLE_MAP.problems, ...LIGHT_SAMPLE_MAP.problems];

for (const p of SAMPLE_PROBLEMS) console.warn(`[Circular Drum] sample "${p.file}": ${p.reason}`);

/**
 * Which sample set plays: Light Mode its own files, Dark Mode the originals.
 * Set by the settings store whenever the theme changes, so every sound follows it.
 */
export type SoundTheme = 'light' | 'dark';
let soundTheme: SoundTheme = 'dark'; // the app always plays the original set now, in both themes
export function setSoundTheme(theme: SoundTheme) {
  soundTheme = theme;
}
export function activeSoundTheme(): SoundTheme {
  return soundTheme;
}
export function sampleMapFor(theme: SoundTheme = soundTheme): SampleMapResult {
  return theme === 'dark' ? SAMPLE_MAP : LIGHT_SAMPLE_MAP;
}

/**
 * The file a channel plays for a color: color number + instrument number.
 * Kick = 1, Snare = 2, Hi-hat = 3, Clap = 4, so Kick on purple (06) is the
 * file starting "06-1-". The fourth file of green, blue and purple is a
 * cymbal (03-4-심벌, 04-4-심벌, 06-4-심벌); it is still the "-4-" file, so the
 * Clap row plays it.
 */
export const CHANNEL_SLOT: Readonly<Record<Channel, number>> = { kick: 1, snare: 2, hihat: 3, clap: 4 };

function slotsOf(files: readonly string[]): Map<string, SampleInfo> {
  const bySlot = new Map<string, SampleInfo>();
  for (const file of files) {
    const s = resolveSample(file);
    if (s.color && s.slotNumber !== null && s.instrument) bySlot.set(`${s.groupNumber}-${s.slotNumber}`, s);
  }
  return bySlot;
}
const SLOTS: Record<SoundTheme, Map<string, SampleInfo>> = { dark: slotsOf(SAMPLE_FILES), light: slotsOf(LIGHT_SAMPLE_FILES) };

/** The file a channel plays for a color in a theme (by default the active one). */
export function sampleForSlot(channel: Channel, color: ColorId, theme: SoundTheme = soundTheme): SampleInfo | undefined {
  return SLOTS[theme].get(`${getColor(color).groupNumber}-${CHANNEL_SLOT[channel]}`);
}

/** Color / instrument combinations that have no file in a theme (reported, never substituted). */
export const MISSING_SLOTS: { color: ColorId; channel: Channel; expected: string }[] = [];
for (const theme of ['dark', 'light'] as const) {
  for (const c of COLORS) {
    for (const ch of Object.keys(CHANNEL_SLOT) as Channel[]) {
      if (!sampleForSlot(ch, c.id, theme)) MISSING_SLOTS.push({ color: c.id, channel: ch, expected: `${theme === 'light' ? 'light/' : ''}${String(c.groupNumber).padStart(2, '0')}-${CHANNEL_SLOT[ch]}-*.wav` });
    }
  }
}
