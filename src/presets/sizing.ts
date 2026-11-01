import { CHANNELS } from '../audio/channels';
import type { Channel, ChannelPatterns } from '../types';

/**
 * Circle sizes: the instrument sets the size level, the rhythm sets where in
 * that level the circle sits. The same in Light and Dark Mode.
 *
 * Levels, largest first: Kick > Snare > Hi-hat > Clap/Cymbal. Each owns its
 * own band of radii (radius-100 space), BAND wide, with MIN_GAP between
 * neighbouring bands, so the order can never change and every level reads
 * clearly. Inside its band a circle grows with how many of its steps are on,
 * compared with the other instruments. Only the step rows and the step count
 * go in: BPM, colors and the playhead never change a size.
 *
 *   ratio    = activeSteps / steps                   (0 … 1)
 *   relative = ratio / densest instrument's ratio     (0 … 1, 0 when all empty)
 *   density  = 0.6·relative + 0.4·√ratio            (0 … 1)
 *   r        = band's inner edge + BAND·density
 *
 * More steps on a row always means a larger (never smaller) circle.
 */
export const MIN_R = 14;
export const MAX_R = 86;
/** Least difference between two instruments' radii, so every size level reads clearly. */
export const MIN_GAP = 10;
/** Width of each instrument's band of radii: four bands and three gaps fill MIN_R … MAX_R. */
export const BAND = (MAX_R - MIN_R - 3 * MIN_GAP) / 4;

/** The fixed size order, largest first (both themes). */
export const SIZE_PRIORITY: readonly Channel[] = ['kick', 'snare', 'hihat', 'clap'];

export type CircleSizes = Record<Channel, number>;

/** Active steps of each row within the current pattern length. */
export function activeSteps(patterns: ChannelPatterns, steps: number): Record<Channel, number> {
  const n = Math.max(1, Math.round(steps));
  const out = {} as Record<Channel, number>;
  for (const ch of CHANNELS) out[ch] = (patterns[ch] ?? []).slice(0, n).filter(Boolean).length;
  return out;
}

export function circleSizes(patterns: ChannelPatterns, steps: number): CircleSizes {
  const n = Math.max(1, Math.round(steps));
  const counts = activeSteps(patterns, n);
  const maxRatio = Math.max(...CHANNELS.map((ch) => counts[ch] / n));

  const out = {} as CircleSizes;
  SIZE_PRIORITY.forEach((ch, level) => {
    const ratio = counts[ch] / n;
    const relative = maxRatio > 0 ? ratio / maxRatio : 0;
    const density = 0.6 * relative + 0.4 * Math.sqrt(ratio);
    const top = MAX_R - level * (BAND + MIN_GAP);
    out[ch] = top - BAND + BAND * Math.min(1, density);
  });
  return out;
}
