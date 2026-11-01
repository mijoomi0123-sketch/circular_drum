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
 * The rings for one artwork. Each form gets 2–4 outlines hugging its own edge
 * (some just inside, some just outside); the outermost form also sends 2–4
 * wider rings outward at uneven gaps, fading as they go.
 */
export function buildOutlineRings(seed: number, forms: readonly Ring[]): OutlineRing[] {
  const rnd = mulberry32((seed ^ 0x5f3759df) >>> 0);
  const between = (a: number, b: number) => a + rnd() * (b - a);
  const out: OutlineRing[] = [];
  const outermost = [...forms].sort((a, b) => b.r - a.r)[0];

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

  for (const form of forms) {
    const n = 2 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) push(form.zone, form.r * between(0.7, 1.08), between(0.7, 0.95), 0);
  }

  // The forms have no filled surface in Dark Mode, so rings carry the inside too:
  // the outermost form's interior, from near the centre outward, at uneven gaps.
  const inner = 3 + Math.floor(outermost.r / 16) + Math.floor(rnd() * 2);
  for (let i = 0; i < inner; i++) {
    const at = 0.1 + (0.6 * (i + between(0.15, 0.85))) / inner;
    const form = [...forms].sort((a, b) => a.r - b.r).find((f) => f.r >= outermost.r * at * 1.05) ?? outermost;
    push(form.zone, outermost.r * at, between(0.6, 0.9), 0);
  }

  // Wider rings spreading outward from the outermost form, at uneven, growing gaps.
  const n = 2 + Math.floor(rnd() * 3);
  let r = outermost.r;
  for (let i = 0; i < n; i++) {
    r += outermost.r * between(0.1, 0.24) * (1 + i * 0.25);
    if (r > MAX_RING_R) break;
    push(outermost.zone, r, 0.9 * (1 - i / (n + 3)) * between(0.8, 1), (i + 1) / n);
  }
  return out;
}
