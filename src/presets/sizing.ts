import { CHANNELS } from '../audio/channels';
import type { Channel, ChannelPatterns } from '../types';

/**
 * Circle sizes from rhythmic density.
 *
 * Each instrument's base radius (radius-100 space) comes from how many of its
 * steps are on, compared with the other instruments, plus a small fixed bias
 * Kick > Snare > Hi-hat > Clap. Only the step rows and the step count go in:
 * BPM, colors and the playhead never change a size.
 *
 *   ratio    = activeSteps / steps                   (0 … 1)
 *   relative = ratio / densest instrument's ratio     (0 … 1, 0 when all empty)
 *   density  = 0.6·relative + 0.4·√ratio
 *   f        = 0.1 + 0.68·density + bias              (bias: 0.15 / 0.10 / 0.05 / 0)
 *   r        = MIN_R + (MAX_R − MIN_R)·f
 *
 * Then, largest first (ties in hierarchy order), each circle is kept at least
 * MIN_GAP inside the previous one so no two edges sit on top of each other,
 * and none falls below MIN_R.
 */
export const MIN_R = 14;
export const MAX_R = 86;
export const MIN_GAP = 6;

/** Default hierarchy, also the tie-break order. */
export const SIZE_PRIORITY: readonly Channel[] = ['kick', 'snare', 'hihat', 'clap'];
export const SIZE_BIAS: Record<Channel, number> = { kick: 0.15, snare: 0.1, hihat: 0.05, clap: 0 };

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

  const raw = {} as CircleSizes;
  for (const ch of CHANNELS) {
    const ratio = counts[ch] / n;
    const relative = maxRatio > 0 ? ratio / maxRatio : 0;
    const density = 0.6 * relative + 0.4 * Math.sqrt(ratio);
    const f = 0.1 + 0.68 * density + SIZE_BIAS[ch];
    raw[ch] = MIN_R + (MAX_R - MIN_R) * Math.min(1, f);
  }

  // Largest first; equal sizes keep the hierarchy order.
  const order = [...SIZE_PRIORITY].sort((a, b) => raw[b] - raw[a] || SIZE_PRIORITY.indexOf(a) - SIZE_PRIORITY.indexOf(b));
  const r = order.map((ch) => raw[ch]);
  for (let i = 1; i < r.length; i++) r[i] = Math.min(r[i], r[i - 1] - MIN_GAP);
  for (let i = r.length - 1; i >= 0; i--) r[i] = Math.max(r[i], MIN_R + (r.length - 1 - i) * MIN_GAP);

  const out = {} as CircleSizes;
  order.forEach((ch, i) => (out[ch] = r[i]));
  return out;
}
