import type { GradientFamily } from './gradients';
import { mulberry32 } from './designs';
import type { Channel, Ring } from '../types';

/**
 * Dark Mode outline rings: thin concentric outlines drawn over and around the
 * four color forms, as if the circle kept spreading outward in layers. Every
 * artwork gets its own number, spacing, size, tone and slight irregularity
 * from its seed, so no two look alike and no ring is a perfect copy of
 * another. Light Mode never draws them.
 */
export interface OutlineRing {
  zone: Channel;
  /** Radius in the artwork's radius-100 space. */
  r: number;
  /** Slightly elliptical and a little off-centre, so the layers feel organic. */
  rx: number;
  ry: number;
  cx: number;
  cy: number;
  rotate: number;
  /** Stroke width and opacity. */
  width: number;
  opacity: number;
  tone: keyof GradientFamily;
  /** Motion while the artwork animates: faint breathing (scale, period, phase) and how far a hit drifts it. */
  grow: number;
  dx: number;
  dy: number;
  period: number;
  delay: number;
}

/** No ring reaches past this radius, so the drawing (±200) never cuts one, even fully spread. */
export const MAX_RING_R = 158;

/** The family's bright tones (no deep), mostly its own color, so the outlines read as colored light on black. */
const TONES: (keyof GradientFamily)[] = ['base', 'rich', 'light', 'base'];

/**
 * The rings for one artwork, kept to the few that carry the motion (the four
 * forms are outlines themselves, so with these the whole circle is about
 * nine lines):
 *
 *   - 1 small ring near the centre, linking it to the innermost form;
 *   - 1 echo just outside the outermost form, which a hit pushes out first;
 *   - 1–2 wider wave rings beyond it, which a hit carries furthest.
 *
 * Every ring reacts to the sound (see applyOutlines in ArtworkGraphic).
 */
export function buildOutlineRings(seed: number, forms: readonly Ring[]): OutlineRing[] {
  const rnd = mulberry32((seed ^ 0x5f3759df) >>> 0);
  const between = (a: number, b: number) => a + rnd() * (b - a);
  const out: OutlineRing[] = [];
  const bySize = [...forms].sort((a, b) => b.r - a.r);
  const outermost = bySize[0];
  const innermost = bySize[bySize.length - 1];

  const push = (zone: Channel, r: number, opacity: number, outward: number) => {
    const rr = Math.min(MAX_RING_R, r);
    const aspect = between(0.012, 0.035);
    out.push({
      zone,
      r: rr,
      rx: rr * (1 + aspect),
      ry: rr * (1 - aspect),
      cx: between(-1, 1) * rr * 0.012,
      cy: between(-1, 1) * rr * 0.012,
      rotate: between(0, 180),
      width: between(0.8, 1.9),
      opacity,
      tone: TONES[Math.floor(rnd() * TONES.length)],
      grow: between(0.02, 0.05) + 0.07 * outward,
      dx: between(-1.6, 1.6),
      dy: between(-1.6, 1.6),
      period: between(6, 14),
      delay: -between(0, 14),
    });
  };

  // Centre: one ring halfway inside the smallest form, so the middle is not empty.
  push(innermost.zone, innermost.r * between(0.4, 0.55), between(0.7, 0.9), 0);

  // Echo of the outermost form, just outside it.
  push(outermost.zone, outermost.r * between(1.08, 1.14), between(0.75, 0.95), 0.3);

  // Wave rings beyond it, at uneven gaps, fading as they go.
  const n = 1 + Math.floor(rnd() * 2);
  let r = outermost.r * 1.12;
  for (let i = 0; i < n; i++) {
    r += outermost.r * between(0.16, 0.26);
    if (r > MAX_RING_R) break;
    push(outermost.zone, r, 0.85 * (1 - i * 0.3) * between(0.85, 1), (i + 1) / n);
  }
  return out;
}
