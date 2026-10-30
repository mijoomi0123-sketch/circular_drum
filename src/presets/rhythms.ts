import type { Instrument } from '../types';

/**
 * Rhythm presets.
 *
 * A pattern is not stored as a fixed list of 16 on/off steps. Each track is
 * described by a *density* (share of steps that sound) and a *rotation*
 * (share of the cycle by which the hits are shifted). For any step count N
 * the hits are spread as evenly as possible (Euclidean distribution):
 *
 *   pulses   = clamp(round(density × N), minPulses, N)
 *   hit(i)   = floor(i·pulses/N) ≠ floor((i−1)·pulses/N)
 *   shifted  = (i + round(rotation × N)) mod N
 *
 * With N = 16 the presets give familiar drum patterns; other step counts
 * keep the same character while the cycle length and spacing really change.
 */
export interface TrackDef {
  instrument: Instrument;
  density: number;
  rotation: number;
  minPulses?: number;
  velocity: number;
}

export interface RhythmPreset {
  id: string;
  tracks: TrackDef[];
}

export const RHYTHMS: readonly RhythmPreset[] = [
  {
    id: 'pulse',
    tracks: [
      { instrument: 'kick', density: 0.25, rotation: 0, minPulses: 1, velocity: 1 },
      { instrument: 'snare', density: 0.125, rotation: 0.25, velocity: 0.85 },
      { instrument: 'hihat', density: 0.25, rotation: 0.125, velocity: 0.5 },
      { instrument: 'clap', density: 0.0625, rotation: 0.75, velocity: 0.7 },
      { instrument: 'cymbal', density: 0.0625, rotation: 0, velocity: 0.55 },
    ],
  },
  {
    id: 'ripple',
    tracks: [
      { instrument: 'kick', density: 0.1875, rotation: 0, minPulses: 1, velocity: 1 },
      { instrument: 'snare', density: 0.125, rotation: 0.25, velocity: 0.8 },
      { instrument: 'hihat', density: 0.5, rotation: 0.0625, velocity: 0.42 },
      { instrument: 'clap', density: 0.125, rotation: 0.3125, velocity: 0.6 },
      { instrument: 'cymbal', density: 0.0625, rotation: 0.5, velocity: 0.5 },
    ],
  },
  {
    id: 'drift',
    tracks: [
      { instrument: 'kick', density: 0.125, rotation: 0, minPulses: 1, velocity: 1 },
      { instrument: 'snare', density: 0.0625, rotation: 0.5, velocity: 0.85 },
      { instrument: 'hihat', density: 0.3125, rotation: 0.125, velocity: 0.45 },
      { instrument: 'clap', density: 0.0625, rotation: 0.875, velocity: 0.55 },
      { instrument: 'cymbal', density: 0.0625, rotation: 0, velocity: 0.6 },
    ],
  },
  {
    id: 'bloom',
    tracks: [
      { instrument: 'kick', density: 0.3125, rotation: 0, minPulses: 1, velocity: 1 },
      { instrument: 'snare', density: 0.125, rotation: 0.25, velocity: 0.8 },
      { instrument: 'hihat', density: 0.75, rotation: 0, velocity: 0.35 },
      { instrument: 'clap', density: 0.125, rotation: 0.25, velocity: 0.55 },
      { instrument: 'cymbal', density: 0.0625, rotation: 0.5, velocity: 0.45 },
    ],
  },
];

export const DEFAULT_RHYTHM = 'pulse';

export function getRhythm(id: string): RhythmPreset {
  return RHYTHMS.find((r) => r.id === id) ?? RHYTHMS[0];
}
