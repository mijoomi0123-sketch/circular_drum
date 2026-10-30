import { CHANNELS } from '../audio/channels';
import { gradientFor } from '../presets/gradients';
import type { Channel, ChannelColors } from '../types';

export interface Overlap {
  /** Same-color build-up in the shared region, 0 … ≈1.45. */
  intensity: number;
  /** How much of the other sounding colors blends in, 0 … 0.42. */
  mix: number;
  /** Wash laid over the shared region: the form's own rich tone (same color) and/or the other colors. */
  tintColor: string;
  tintOpacity: number;
}

const NO_OVERLAP: Overlap = { intensity: 0, mix: 0, tintColor: '#000000', tintOpacity: 0 };

function rgbOf(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Temporary color response where sounding forms overlap.
 *
 * The forms share one centre, so the region two forms share is the smaller
 * one's disc, which is drawn on top. For each form, every larger form that is
 * sounding at the same moment adds weight = (its presence × this form's
 * presence), where presence is how loud each instrument actually is right
 * now (DropletAnimator.presence, from the real sample envelopes):
 *
 *   same color      → intensity: a wash of the color's own rich tone, more
 *                     saturation, a little more light and glow; each further
 *                     same-color sound adds a bit less, so it builds up but
 *                     never clips to white
 *   different color → mix: the other colors (weighted) blend into the region
 *                     with a slight saturation lift so mixes stay clear
 *
 * Both work together when same- and different-color sounds overlap. With
 * nothing sounding, or a form sounding alone, everything is neutral.
 */
export function overlapState(
  presence: ((ch: Channel) => number) | null,
  sizes: Record<Channel, { x: number }>,
  colors: ChannelColors,
): Record<Channel, Overlap> {
  const out = { kick: NO_OVERLAP, snare: NO_OVERLAP, hihat: NO_OVERLAP, clap: NO_OVERLAP } as Record<Channel, Overlap>;
  if (!presence) return out;
  const p = Object.fromEntries(CHANNELS.map((ch) => [ch, presence(ch)])) as Record<Channel, number>;
  for (const x of CHANNELS) {
    if (p[x] <= 0.001) continue;
    let same = 0;
    let diff = 0;
    const rgb = [0, 0, 0];
    for (const y of CHANNELS) {
      if (y === x || p[y] <= 0.001 || sizes[y].x <= sizes[x].x) continue;
      const w = p[x] * p[y];
      if (colors[y] === colors[x]) {
        same += w;
      } else {
        diff += w;
        const c = rgbOf(gradientFor(colors[y]).base);
        for (let i = 0; i < 3; i++) rgb[i] += c[i] * w;
      }
    }
    if (same === 0 && diff === 0) continue;
    const intensity = 1.5 * (1 - Math.exp(-0.6 * same));
    const mix = 0.42 * (1 - Math.exp(-1.2 * diff));
    // One wash: own rich tone weighted by the intensity, the others' colors by the mix.
    const own = 0.24 * intensity;
    const rich = rgbOf(gradientFor(colors[x]).rich);
    const wash = [0, 1, 2].map((i) => (rich[i] * own + (diff > 0 ? (rgb[i] / diff) * mix : 0)) / (own + mix));
    out[x] = {
      intensity,
      mix,
      tintColor: `#${wash.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`,
      tintOpacity: Math.min(0.6, own + mix),
    };
  }
  return out;
}
