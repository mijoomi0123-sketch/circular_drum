import { patternsFromRhythm } from '../audio/pattern';
import type { Artwork, ColorId } from '../types';

/** Example artworks created on first launch so the library is not empty. */
const SEEDS: { name: string; color: ColorId; seed: number; scale: number; rhythm: string }[] = [
  { name: 'Ember', color: 'orange', seed: 1103, scale: 0.78, rhythm: 'pulse' },
  { name: 'Pollen', color: 'yellow', seed: 2207, scale: 0.92, rhythm: 'ripple' },
  { name: 'Moss', color: 'green', seed: 3301, scale: 0.7, rhythm: 'drift' },
  { name: 'Tide', color: 'blue', seed: 4409, scale: 1, rhythm: 'bloom' },
  { name: 'Petal', color: 'pink', seed: 5501, scale: 0.84, rhythm: 'ripple' },
  { name: 'Dusk', color: 'purple', seed: 6607, scale: 0.74, rhythm: 'drift' },
  { name: 'Bark', color: 'brown', seed: 7703, scale: 0.88, rhythm: 'pulse' },
  { name: 'Sunset', color: 'orange', seed: 8821, scale: 0.96, rhythm: 'bloom' },
  { name: 'Lagoon', color: 'blue', seed: 9907, scale: 0.68, rhythm: 'pulse' },
];

export function createDefaultArtworks(now = Date.now()): Artwork[] {
  return SEEDS.map((s, i) => ({
    id: `default-${i + 1}`,
    name: s.name,
    color: s.color,
    bpm: 120,
    steps: 16,
    loop: true,
    colors: { kick: s.color, snare: s.color, hihat: s.color, clap: s.color },
    patterns: patternsFromRhythm(s.rhythm, 16),
    design: { seed: s.seed, scale: s.scale, rhythm: s.rhythm },
    createdAt: now + i,
    updatedAt: now + i,
  }));
}
