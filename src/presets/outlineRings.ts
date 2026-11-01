import type { GradientFamily } from './gradients';
import { mulberry32 } from './designs';
import type { Channel, Ring } from '../types';

/**
 * Dark Mode outline rings: thin concentric outlines drawn over and around the
 * four color forms, as if the circle kept spreading outward in layers. Every
 * artwork gets its own spacing, size and tone
 * from its seed, so no two look alike. Light Mode never draws them.
 */
export interface OutlineRing {
  zone: Channel;
  /** Radius in the artwork's radius-100 space. */
  r: number;
  /** Stroke width and opacity. */
  width: number;
  opacity: number;
  tone: keyof GradientFamily;
  /** Motion while the artwork animates: faint breathing (scale, period, phase). Rings stay perfect, centred circles so they never cross. */
  grow: number;
  period: number;
  delay: number;
}

/** No ring reaches past this radius, so the drawing (±200) never cuts one, even fully spread. */
export const MAX_RING_R = 158;


/** Stroke width of a companion ring (drawing units); the form outline beside it is 2. */
export const PAIR_RING_WIDTH = 0.9;
/** Black space between a form's stroke and its companion ring's stroke (drawing units). */
export const PAIR_CLEAR = 5;
/** Half the form outline's stroke (DARK_FORM_STROKE / 2). */
const FORM_HALF = 0.7;
/** Dark Mode form outline stroke (drawing units). */
export const DARK_FORM_STROKE = FORM_HALF * 2;
/** Black space between two instrument groups (drawing units): a little more than inside a pair. */
export const GROUP_CLEAR = 8;
/** Centre-to-centre step from one instrument's form to the next one's (sizing units, before the artwork scale ≈ 0.975). */
export const DARK_GROUP_PITCH = (FORM_HALF + PAIR_CLEAR + PAIR_RING_WIDTH + GROUP_CLEAR + FORM_HALF) / 0.975;

/**
 * Dark Mode sizes: the Kick keeps its size from the beat (sizing.ts); the
 * other instruments follow it inward at one even step, so every pair has the
 * same spacing inside and every group the same, slightly wider, gap to the next.
 */
export function darkSizes<T extends Record<Channel, number>>(sizes: T): T {
  const k = sizes.kick;
  return { ...sizes, kick: k, snare: k - DARK_GROUP_PITCH, hihat: k - 2 * DARK_GROUP_PITCH, clap: k - 3 * DARK_GROUP_PITCH };
}

/**
 * The rings for one artwork: every instrument is drawn as a pair of
 * concentric lines in its own color, its form outline and one companion ring
 * just outside it. From the outside in, the circle always reads
 *
 *   Kick, Kick → Snare, Snare → Hi-hat, Hi-hat → Clap/Cymbal, Clap/Cymbal
 *
 * and no line of another instrument ever sits between a pair (the pair's gap,
 * PAIR_CLEAR, is the smallest in the circle). The outermost pair's ring also
 * carries the wave that spreads outward with each hit (see applyOutlines).
 */
export function buildOutlineRings(seed: number, forms: readonly Ring[]): OutlineRing[] {
  const rnd = mulberry32((seed ^ 0x5f3759df) >>> 0);
  const between = (a: number, b: number) => a + rnd() * (b - a);
  const bySize = [...forms].sort((a, b) => b.r - a.r);
  return bySize.map((form, i) => ({
    zone: form.zone,
    r: Math.min(MAX_RING_R, form.r + FORM_HALF + PAIR_CLEAR + PAIR_RING_WIDTH / 2),
    width: PAIR_RING_WIDTH,
    opacity: 0.9,
    // The very color of its form's outline, so the two lines of a pair always match.
    tone: 'base',
    grow: i === 0 ? between(0.06, 0.09) : 0,
    period: between(6, 14),
    delay: -between(0, 14),
  }));
}
