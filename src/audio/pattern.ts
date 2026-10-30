import { getRhythm, type TrackDef } from '../presets/rhythms';
import type { Channel, ChannelPatterns } from '../types';
import { CHANNELS, channelOf } from './channels';

export const MIN_STEPS = 1;
export const MAX_STEPS = 32;
export const MIN_BPM = 40;
export const MAX_BPM = 200;

/** One step is a sixteenth note: four steps per beat. */
export const STEPS_PER_BEAT = 4;

export function stepDuration(bpm: number): number {
  return 60 / bpm / STEPS_PER_BEAT;
}

/** Euclidean distribution of `pulses` hits over `steps`, starting at step 0. */
export function euclid(pulses: number, steps: number): boolean[] {
  const out: boolean[] = new Array(steps).fill(false);
  if (pulses <= 0) return out;
  for (let i = 0; i < steps; i++) {
    out[i] = Math.floor((i * pulses) / steps) !== Math.floor(((i - 1) * pulses) / steps);
  }
  return out;
}

export function trackHits(track: TrackDef, steps: number): boolean[] {
  const pulses = Math.min(steps, Math.max(track.minPulses ?? 0, Math.round(track.density * steps)));
  const base = euclid(pulses, steps);
  const shift = Math.round(track.rotation * steps) % steps;
  const out: boolean[] = new Array(steps).fill(false);
  for (let i = 0; i < steps; i++) if (base[i]) out[(i + shift) % steps] = true;
  return out;
}

export function emptyPatterns(): ChannelPatterns {
  return { kick: blankRow(), snare: blankRow(), hihat: blankRow(), clap: blankRow() };
}

function blankRow(): boolean[] {
  return new Array(MAX_STEPS).fill(false);
}

/**
 * Starting step rows for an artwork, made from its rhythm preset at the
 * given step count, then repeated to fill all 32 steps so that raising the
 * step count later continues the same groove. Clap and cymbal tracks both
 * land on the Clap row (they share the fourth sample slot).
 */
export function patternsFromRhythm(rhythmId: string, steps: number): ChannelPatterns {
  const n = clampSteps(steps);
  const rows = emptyPatterns();
  for (const track of getRhythm(rhythmId).tracks) {
    const hits = trackHits(track, n);
    const row = rows[channelOf(track.instrument)];
    for (let i = 0; i < MAX_STEPS; i++) if (hits[i % n]) row[i] = true;
  }
  return rows;
}

/** Copy with one step of one row flipped; the other rows are untouched. */
export function toggleStep(p: ChannelPatterns, ch: Channel, step: number): ChannelPatterns {
  const row = [...p[ch]];
  row[step] = !row[step];
  return { ...p, [ch]: row };
}

export function clonePatterns(p: ChannelPatterns): ChannelPatterns {
  return { kick: [...p.kick], snare: [...p.snare], hihat: [...p.hihat], clap: [...p.clap] };
}

export function samePatterns(a: ChannelPatterns, b: ChannelPatterns): boolean {
  return CHANNELS.every((ch) => a[ch].every((v, i) => v === b[ch][i]));
}

/** Channels that sound on each step of a cycle of `steps` steps. */
export function buildPattern(patterns: ChannelPatterns, steps: number): Channel[][] {
  const n = clampSteps(steps);
  return Array.from({ length: n }, (_, i) => CHANNELS.filter((ch) => patterns[ch][i]));
}

export function clampSteps(v: number): number {
  return Math.min(MAX_STEPS, Math.max(MIN_STEPS, Math.round(v)));
}

export function clampBpm(v: number): number {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(v)));
}
