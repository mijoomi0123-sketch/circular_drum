import { buildRings } from '../presets/designs';
import { circleSizes } from '../presets/sizing';
import type { Artwork, Channel } from '../types';

/**
 * The circle whose sound is really playing in Fullscreen grows to ONE shared
 * size: every circle, small or large, ends at the same diameter. Each one's
 * own factor is target / its own drawn size, so small circles grow more and
 * large ones less, and all end exactly equal.
 *
 * Sizes are radii in the artwork's ±200 drawing, which is the same share of
 * every cell (the art box is ±106 = 96% of the cell's shorter side). The
 * largest form ever drawn at rest is r ≈ 86; the target sits just above it,
 * 88 → a diameter of 80% of the cell's shorter side, so a grown circle stays
 * inside its own cell and never covers a neighbour.
 */
export const TARGET_R = 88;

export function playBoost(outerR: number): number {
  return TARGET_R / Math.max(1, outerR);
}

/** The outermost form as drawn at rest: its radius and the instrument it belongs to. */
export function outerForm(a: Pick<Artwork, 'design' | 'patterns' | 'steps'>): { r: number; zone: Channel } {
  const [outer] = buildRings(a.design, circleSizes(a.patterns, a.steps));
  return { r: outer.r, zone: outer.zone };
}
