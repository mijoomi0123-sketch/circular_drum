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
  /** Light Mode mixes the colors themselves (see mixedWash); Dark Mode keeps the soft wash. */
  mixing = false,
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
    if (mixing) {
      out[x] = mixedWash(x, p, sizes, colors, same, diff);
      continue;
    }
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

const hsvOf = (hex: string): [number, number, number] => {
  const [r, g, b] = rgbOf(hex).map((c) => c / 255);
  const v = Math.max(r, g, b);
  const d = v - Math.min(r, g, b);
  const h = d === 0 ? 0 : v === r ? ((g - b) / d) % 6 : v === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [((h * 60) + 360) % 360, v ? d / v : 0, v];
};
const rgbOfHsv = (h: number, s: number, v: number): [number, number, number] => {
  const f = (k: number) => {
    const t = (k + h / 60) % 6;
    return 255 * (v - v * s * Math.max(0, Math.min(t, 4 - t, 1)));
  };
  return [f(5), f(3), f(1)];
};

/** How much more saturated a mix of colored light is than the more saturated of its colors. */
export const LIGHT_MIX_SAT = 1.5;

/**
 * Colors mixed like colored light, staying bright and clean: the hue is the
 * weighted average of the hues (on the color wheel, so Yellow + Blue lands on
 * green), the brightness is the brighter of the two, and the saturation is
 * the stronger one lifted by LIGHT_MIX_SAT. A color with itself keeps its hue
 * and becomes more vivid; nothing ever turns darker, gray or muddy.
 */
export function lightMix(colors: readonly { hex: string; w: number }[]): [number, number, number] {
  let x = 0;
  let y = 0;
  let sat = 0;
  let val = 0;
  for (const { hex, w } of colors) {
    const [h, s, v] = hsvOf(hex);
    const k = w * Math.max(0.15, s); // gray-ish colors pull the hue less
    x += Math.cos((h * Math.PI) / 180) * k;
    y += Math.sin((h * Math.PI) / 180) * k;
    sat = Math.max(sat, s);
    val = Math.max(val, v);
  }
  const hue = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return rgbOfHsv(hue, Math.min(1, sat * LIGHT_MIX_SAT), val);
}

/**
 * Light Mode: where sounding forms overlap, the shared region (the smaller
 * form, drawn on top) takes on the mix of the colors as colored light (see
 * lightMix), weighted by how loud each is, shown strongly enough to read as
 * one combined color: Yellow + Yellow becomes a brighter, more vivid yellow;
 * Blue + Yellow a clear, bright green.
 */
function mixedWash(
  x: Channel,
  p: Record<Channel, number>,
  sizes: Record<Channel, { x: number }>,
  colors: ChannelColors,
  same: number,
  diff: number,
): Overlap {
  const own = gradientFor(colors[x]).base;
  const parts: { hex: string; w: number }[] = [];
  let total = 0;
  for (const y of CHANNELS) {
    if (y === x || p[y] <= 0.001 || sizes[y].x <= sizes[x].x) continue;
    const w = p[x] * p[y];
    parts.push({ hex: gradientFor(colors[y]).base, w });
    total += w;
  }
  // The form's own color counts as much as all the colors beneath it together.
  const rgb = lightMix([{ hex: own, w: total }, ...parts]);
  const strength = MIX_STRENGTH * (1 - Math.exp(-2.4 * total));
  return {
    intensity: 1.5 * (1 - Math.exp(-0.6 * same)),
    mix: 0.42 * (1 - Math.exp(-1.2 * diff)),
    tintColor: `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`,
    tintOpacity: strength,
  };
}

/** How fully the mixed color replaces the shared region at full loudness (Light Mode). */
export const MIX_STRENGTH = 0.85;
