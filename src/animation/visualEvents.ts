import type { Channel } from '../types';

/**
 * Motion character of each instrument's form.
 *
 * - growth   peak radial growth, as a share of the form's current base size
 * - attack   seconds from the hit to the crest
 * - decay    how long the return takes (time constant, seconds)
 * - spring   0 = glides straight back to rest; > 0 = a soft spring that
 *            dips slightly below rest once before settling (share of the
 *            crest, kept small so it never wobbles)
 * - halo     how much the outer glow intensifies at the crest (0–1)
 * - bloom    how far the gradient's inner colors spread outward at the crest
 * - fade     how much the body's opacity rises at the crest (0–1)
 */
export interface MotionCharacter {
  growth: number;
  attack: number;
  decay: number;
  spring: number;
  halo: number;
  bloom: number;
  fade: number;
}

export const MOTION: Readonly<Record<Channel, MotionCharacter>> = {
  // Dense pressure wave: a heavy swell, the dark core pushes outward, one soft spring-back.
  kick: { growth: 0.14, attack: 0.075, decay: 0.2, spring: 0.12, halo: 0.45, bloom: 0.16, fade: 0.03 },
  // Sharp and slightly explosive: an instant snap, a white-hot core flash.
  snare: { growth: 0.11, attack: 0.022, decay: 0.085, spring: 0, halo: 0.6, bloom: 0.3, fade: 0.05 },
  // Light and airy but lively: a quick, clearly visible flick outward while the membrane shimmers brighter.
  // (growth, halo and bloom only drive Light Mode; Dark Mode sizes its hits with DARK_HIT.)
  hihat: { growth: 0.26, attack: 0.015, decay: 0.1, spring: 0.06, halo: 0.6, bloom: 0.24, fade: 0.35 },
  // Broad and brief: a wide soft expansion with a large glow that settles quickly.
  clap: { growth: 0.24, attack: 0.035, decay: 0.13, spring: 0, halo: 0.7, bloom: 0.14, fade: 0.05 },
};

/**
 * Faster tempos get slightly quicker returns so individual hits stay
 * readable; slower tempos settle more lazily.
 */
export function tempoScale(bpm: number): number {
  return Math.min(1.3, Math.max(0.65, 120 / bpm));
}
