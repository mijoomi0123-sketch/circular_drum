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

/** The family's bright tones (no deep), mostly its own color, so the outlines read as colored light on black. */
const TONES: (keyof GradientFamily)[] = ['base', 'rich', 'light', 'base'];

/**
 * The rings for one artwork, kept to the few that carry the motion (the four
 * forms are outlines themselves). Each ring belongs to one instrument, takes
 * its color and follows its sound most:
 *
 *   - 1 small ring near the centre, linking it to the innermost form;
 *   - beyond the outermost form, counted from the outside: two Kick wave
 *     rings, then the Snare ring (always the third ring from the outside),
 *     then the Hi-hat ring, closest to the forms.
 *
 * Every ring reacts to the sound (see applyOutlines in ArtworkGraphic).
 */
export const OUTER_RING_ZONES: readonly Channel[] = ['kick', 'kick', 'snare', 'hihat'];

export function buildOutlineRings(seed: number, forms: readonly Ring[]): OutlineRing[] {
  const rnd = mulberry32((seed ^ 0x5f3759df) >>> 0);
  const between = (a: number, b: number) => a + rnd() * (b - a);
  const out: OutlineRing[] = [];
  const bySize = [...forms].sort((a, b) => b.r - a.r);
  const outermost = bySize[0];
  const innermost = bySize[bySize.length - 1];

  const push = (zone: Channel, r: number, opacity: number, outward: number, ownTone = false) => {
    const rr = Math.min(MAX_RING_R, r);
    const tone = TONES[Math.floor(rnd() * TONES.length)];
    out.push({
      zone,
      r: rr,
      width: between(0.8, 1.9),
      opacity,
      // The Snare and Hi-hat rings show their instrument's own color plainly, so each reads as that instrument's ring.
      tone: ownTone ? 'base' : tone,
      grow: between(0.02, 0.05) + 0.07 * outward,
      period: between(6, 14),
      delay: -between(0, 14),
    });
  };

  // Centre: one ring halfway inside the smallest form, so the middle is not empty.
  push(innermost.zone, innermost.r * between(0.4, 0.55), between(0.7, 0.9), 0);

  // Outer rings, from the form outward: Hi-hat, Snare, then the two Kick waves,
  // at slightly uneven gaps that always fit inside MAX_RING_R, fading as they go.
  const n = OUTER_RING_ZONES.length;
  const room = (MAX_RING_R - outermost.r) / n;
  let r = outermost.r;
  for (let i = 0; i < n; i++) {
    r += Math.min(room, outermost.r * between(0.17, 0.22));
    const zone = OUTER_RING_ZONES[n - 1 - i];
    push(zone, r, 0.9 * (1 - i * 0.12) * between(0.85, 1), (i + 1) / n, zone !== 'kick');
  }
  return out;
}
