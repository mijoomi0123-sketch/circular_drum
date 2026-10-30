import { describe, expect, it } from 'vitest';
import { CHANNELS } from '../audio/channels';
import { emptyPatterns, MAX_STEPS, MIN_STEPS } from '../audio/pattern';
import { activeSteps, circleSizes, MAX_R, MIN_GAP, MIN_R } from '../presets/sizing';
import type { Channel, ChannelPatterns } from '../types';

/** Rows with the given number of active steps, spread evenly over `steps`. */
function withCounts(counts: Partial<Record<Channel, number>>, steps: number): ChannelPatterns {
  const p = emptyPatterns();
  for (const ch of CHANNELS) {
    const k = counts[ch] ?? 0;
    for (let i = 0; i < k; i++) p[ch][Math.floor((i * steps) / k)] = true;
  }
  return p;
}

function ordered(s: Record<Channel, number>): Channel[] {
  return [...CHANNELS].sort((a, b) => s[b] - s[a]);
}

describe('circle sizes from active steps', () => {
  it('equal counts keep Kick > Snare > Hi-hat > Clap, for every count and length', () => {
    for (const steps of [1, 4, 7, 16, 32]) {
      for (let k = 0; k <= steps; k++) {
        const s = circleSizes(withCounts({ kick: k, snare: k, hihat: k, clap: k }, steps), steps);
        expect(ordered(s), `${k}/${steps}`).toEqual(['kick', 'snare', 'hihat', 'clap']);
      }
    }
  });

  it('16 steps, Kick 4 and Snare 8: Snare is larger than Kick', () => {
    const s = circleSizes(withCounts({ kick: 4, snare: 8 }, 16), 16);
    expect(s.snare).toBeGreaterThan(s.kick);
    // The same holds whatever the other two rows do.
    const s2 = circleSizes(withCounts({ kick: 4, snare: 8, hihat: 16, clap: 2 }, 16), 16);
    expect(s2.snare).toBeGreaterThan(s2.kick);
  });

  it('more active steps never makes a circle smaller', () => {
    for (const steps of [8, 16, 32]) {
      for (const ch of CHANNELS) {
        let prev = 0;
        for (let k = 0; k <= steps; k++) {
          const r = circleSizes(withCounts({ kick: 4, snare: 4, hihat: 4, clap: 4, [ch]: k }, steps), steps)[ch];
          expect(r, `${ch} ${k}/${steps}`).toBeGreaterThanOrEqual(prev - 1e-9);
          prev = r;
        }
      }
    }
  });

  it('only counts steps inside the current pattern length', () => {
    const p = withCounts({ kick: 8 }, 32); // kick on 0,4,8,…,28
    expect(activeSteps(p, 16).kick).toBe(4);
    expect(activeSteps(p, 32).kick).toBe(8);
    // Same steps on, longer pattern: lower density, smaller circle.
    const q = withCounts({ kick: 8, snare: 4 }, 16); // all inside the first 16
    expect(circleSizes(q, 32).kick).toBeLessThan(circleSizes(q, 16).kick);
  });

  it('sizes stay within bounds and edges stay apart, for random patterns', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let n = 0; n < 2000; n++) {
      const steps = MIN_STEPS + Math.floor(rnd() * (MAX_STEPS - MIN_STEPS + 1));
      const p = emptyPatterns();
      for (const ch of CHANNELS) for (let i = 0; i < 32; i++) p[ch][i] = rnd() < rnd();
      const s = circleSizes(p, steps);
      const r = CHANNELS.map((ch) => s[ch]).sort((a, b) => b - a);
      for (const x of r) {
        expect(Number.isFinite(x)).toBe(true);
        expect(x).toBeGreaterThanOrEqual(MIN_R);
        expect(x).toBeLessThanOrEqual(MAX_R);
      }
      for (let i = 1; i < r.length; i++) expect(r[i - 1] - r[i]).toBeGreaterThanOrEqual(MIN_GAP - 1e-9);
    }
  });

  it('empty rows still get a visible resting size', () => {
    const s = circleSizes(withCounts({ kick: 16, snare: 16, hihat: 16 }, 16), 16);
    expect(s.clap).toBeGreaterThanOrEqual(MIN_R);
    const none = circleSizes(emptyPatterns(), 16);
    expect(ordered(none)).toEqual(['kick', 'snare', 'hihat', 'clap']);
    expect(Math.min(...CHANNELS.map((ch) => none[ch]))).toBeGreaterThanOrEqual(MIN_R);
  });

  it('is deterministic: the same pattern always gives the same sizes', () => {
    const p = withCounts({ kick: 3, snare: 5, hihat: 11, clap: 1 }, 13);
    expect(circleSizes(p, 13)).toEqual(circleSizes(p, 13));
  });
});
