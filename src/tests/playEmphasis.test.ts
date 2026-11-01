import { describe, expect, it } from 'vitest';
import { outerForm, playBoost, TARGET_R } from '../components/playEmphasis';
import type { ChannelPatterns } from '../types';

const row = (n: number, on: number) => Array.from({ length: 16 }, (_, i) => i < on).concat(Array(16).fill(false)).slice(0, n);
const pats = (k: number, s: number, h: number, c: number): ChannelPatterns =>
  ({ kick: row(32, k), snare: row(32, s), hihat: row(32, h), clap: row(32, c) }) as ChannelPatterns;

describe('playing circle: one shared target size', () => {
  it('every circle ends at exactly the same diameter (factor = target / own size)', () => {
    for (const r of [30, 52, 60, 70, 81, 86]) expect(r * playBoost(r)).toBeCloseTo(TARGET_R, 10);
    expect(playBoost(44)).toBeCloseTo(2);
    expect(playBoost(88)).toBeCloseTo(1);
  });

  it('works from the drawn size of real artworks, small and large', () => {
    const design = { seed: 7 } as never;
    const small = outerForm({ design, patterns: pats(0, 0, 0, 1), steps: 16 });
    const large = outerForm({ design, patterns: pats(16, 8, 4, 2), steps: 16 });
    expect(small.r).toBeLessThan(large.r - 8); // the Kick is always the outer form; its band is BAND wide
    expect(small.r * playBoost(small.r)).toBeCloseTo(large.r * playBoost(large.r), 10);
    expect(large.r).toBeLessThanOrEqual(TARGET_R);
  });

  it('the shared size stays inside the cell (80% of its shorter side)', () => {
    expect(((2 * TARGET_R) / 212) * 0.96).toBeLessThan(0.81);
  });
});
