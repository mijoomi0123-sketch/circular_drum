import type { Instrument } from '../types';

/**
 * ─── Sample configuration ────────────────────────────────────────────────
 * This is the ONE place to edit when samples change.
 *
 * Files live in `public/audio/`. The leading number of each filename picks
 * the color group (01 orange, 02 yellow, 03 green, 04 blue, 05 pink,
 * 06 purple, 07 brown). The instrument is read from the word in the
 * filename (see INSTRUMENT_KEYWORDS). A file whose instrument cannot be
 * recognised is NOT guessed: add it to INSTRUMENT_OVERRIDES instead.
 *
 * Run `npm run check:samples` to verify every listed file exists on disk.
 */
export const AUDIO_BASE_PATH = `${import.meta.env.BASE_URL}audio/`;

/** Dark Mode samples (the original set). Never replaced: Light Mode has its own list below. */
export const SAMPLE_FILES: readonly string[] = [
  '01-1-킥.wav', '01-2-스네어.wav', '01-3-하이햇.wav', '01-4-클랩.wav',
  '02-1-킥.wav', '02-2-스네어.wav', '02-3-하이햇.wav', '02-4-클랩.wav',
  '03-1-킥.wav', '03-2-스네어.wav', '03-3-하이햇.wav', '03-4-심벌.wav',
  '04-1-킥.wav', '04-2-스네어.wav', '04-3-하이햇.wav', '04-4-심벌.wav',
  '05-1-킥.wav', '05-2-스네어.wav', '05-3-하이햇.wav', '05-4-클랩.wav',
  '06-1-킥.wav', '06-2-스네어.wav', '06-3-하이햇.wav', '06-4-심벌.wav',
  '07-1-킥.wav', '07-2-스네어.wav', '07-3-하이햇.wav', '07-4-클랩.wav',
];

/**
 * Light Mode samples, in `public/audio/light/`. Same group-slot-instrument
 * names as SAMPLE_FILES (01-1-킥 … 07-4-클랩), one for one; the app picks the
 * set of the active theme (see sampleMap.ts).
 */
export const LIGHT_SAMPLE_FILES: readonly string[] = [
  'light/01-1-킥(화이트 모드).wav', 'light/01-2-스네어(화이트 모드).wav', 'light/01-3-하이햇(화이트 모드).wav', 'light/01-4-클랩(화이트 모드).wav',
  'light/02-1-킥(화이트 모드).wav', 'light/02-2-스네어(화이트 모드).wav', 'light/02-3-하이햇(화이트 모드).wav', 'light/02-4-클랩(화이트 모드).wav',
  'light/03-1-킥(화이트 모드).wav', 'light/03-2-스네어(화이트 모드).wav', 'light/03-3-하이햇(화이트 모드).wav', 'light/03-4-심벌(화이트 모드).wav',
  'light/04-1-킥(화이트 모드).wav', 'light/04-2-스네어(화이트 모드).wav', 'light/04-3-하이햇(화이트 모드).wav', 'light/04-4-심벌(화이트 모드).wav',
  'light/05-1-킥(화이트 모드).wav', 'light/05-2-스네어(화이트 모드).wav', 'light/05-3-하이햇(화이트 모드).wav', 'light/05-4-클랩(화이트 모드).wav',
  'light/06-1-킥(화이트 모드).wav', 'light/06-2-스네어(화이트 모드).wav', 'light/06-3-하이햇(화이트 모드).wav', 'light/06-4-심벌(화이트 모드).wav',
  'light/07-1-킥(화이트 모드).wav', 'light/07-2-스네어(화이트 모드).wav', 'light/07-3-하이햇(화이트 모드).wav', 'light/07-4-클랩(화이트 모드).wav',
];

/**
 * Words that identify an instrument inside a filename (case-insensitive).
 * Korean and English names are both accepted. Order matters only when a
 * filename would match several keywords; such files are treated as
 * ambiguous and must be configured explicitly.
 */
export const INSTRUMENT_KEYWORDS: Readonly<Record<Instrument, readonly string[]>> = {
  kick: ['킥', 'kick', 'bassdrum', 'bd'],
  snare: ['스네어', 'snare', 'sd'],
  hihat: ['하이햇', '하이헷', 'hihat', 'hi-hat', 'hat', 'hh'],
  clap: ['클랩', 'clap'],
  cymbal: ['심벌', '심볼', 'cymbal', 'crash', 'ride'],
};

/**
 * Explicit instrument assignment for files whose name does not identify the
 * instrument reliably. Example: `'03-5-perc.wav': 'clap'`.
 */
export const INSTRUMENT_OVERRIDES: Readonly<Record<string, Instrument>> = {};
