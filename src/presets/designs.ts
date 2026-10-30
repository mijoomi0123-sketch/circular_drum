import type { ArtworkDesign, Ring } from '../types';
import type { CircleSizes } from './sizing';

/** Deterministic PRNG so an artwork's layout never changes between visits. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Body opacity per instrument: the Hi-hat is a translucent membrane. */
const OPACITY = { kick: 0.97, snare: 0.95, hihat: 0.85, clap: 0.95 } as const;

/**
 * Builds an artwork as exactly four soft color forms, one per instrument,
 * in a radius-100 space. Each radius comes from the instrument's rhythmic
 * density (see sizing.ts). The seed gives each artwork its own organic
 * character without touching the size order: where each form's gradient
 * core sits. Forms are always perfect circles (no elliptical distortion). Every form is centred
 * exactly on the artwork's centre; only the gradient core is offset.
 * Returned largest first, so smaller forms draw on top.
 */
export function buildRings(design: ArtworkDesign, sizes: CircleSizes): Ring[] {
  const rnd = mulberry32(design.seed);
  const scale = 0.95 + rnd() * 0.05;
  const rings: Ring[] = (['kick', 'snare', 'hihat', 'clap'] as const).map((zone) => {
    const a = rnd() * Math.PI * 2;
    rnd(); // once drew an elliptical aspect; still drawn so every artwork's cores stay where they were
    return {
      zone,
      r: sizes[zone] * scale,
      opacity: OPACITY[zone],
      tilt: rnd() * 180,
      coreX: 0.5 + Math.cos(a) * (0.1 + rnd() * 0.14),
      coreY: 0.5 + Math.sin(a) * (0.1 + rnd() * 0.14),
    };
  });
  return rings.sort((a, b) => b.r - a.r);
}

/** Largest drawn radius including stroke, used to size the viewBox. */
export function outerRadius(rings: Ring[]): number {
  return rings.reduce((m, x) => Math.max(m, x.r), 0);
}
