import { describe, expect, it } from 'vitest';
import { buildPattern, euclid, patternsFromRhythm, stepDuration, toggleStep, MAX_STEPS } from '../audio/pattern';
import { hitEnvelope } from '../animation/envelope';
import type { Channel } from '../types';

const on = (rhythm: string, steps: number, ch: Channel) =>
  buildPattern(patternsFromRhythm(rhythm, steps), steps)
    .map((hits, i) => (hits.includes(ch) ? i : -1))
    .filter((i) => i >= 0);

describe('step rows', () => {
  it('spreads pulses evenly', () => {
    expect(euclid(4, 16).map(Number).join('')).toBe('1000100010001000');
    expect(euclid(3, 8).map(Number).join('')).toBe('10010010');
  });

  it('migrated rows keep the old 16-step groove', () => {
    expect(on('pulse', 16, 'kick')).toEqual([0, 4, 8, 12]);
    expect(on('pulse', 16, 'snare')).toEqual([4, 12]);
    expect(on('pulse', 16, 'hihat')).toEqual([2, 6, 10, 14]);
    expect(on('pulse', 16, 'clap')).toEqual([0, 12]); // clap + cymbal tracks share the Clap row
  });

  it('rows are 32 long and repeat the groove past the step count', () => {
    const p = patternsFromRhythm('pulse', 16);
    expect(p.kick).toHaveLength(MAX_STEPS);
    expect(p.kick.slice(16)).toEqual(p.kick.slice(0, 16));
  });

  it('toggling one row leaves the other rows untouched', () => {
    const p = patternsFromRhythm('pulse', 16);
    const q = toggleStep(p, 'kick', 3);
    expect(q.kick[3]).toBe(true);
    expect(p.kick[3]).toBe(false);
    expect(q.snare).toBe(p.snare);
    expect(q.hihat).toBe(p.hihat);
    expect(q.clap).toBe(p.clap);
  });

  it('step count sets the cycle length for all rows', () => {
    const p = patternsFromRhythm('pulse', 16);
    expect(buildPattern(p, 7)).toHaveLength(7);
    expect(buildPattern(p, 32)).toHaveLength(32);
  });

  it('uses sixteenth-note steps', () => {
    expect(stepDuration(120)).toBeCloseTo(0.125);
    expect(stepDuration(60)).toBeCloseTo(0.25);
  });
});

describe('hit envelope', () => {
  it('rises and settles smoothly without overshoot when spring = 0', () => {
    const a = 0.1;
    const d = 0.15;
    expect(hitEnvelope(0, a, d)).toBe(0);
    expect(hitEnvelope(a, a, d)).toBeCloseTo(1);
    let prev = 1;
    for (let t = a; t < a + 2; t += 0.01) {
      const v = hitEnvelope(t, a, d);
      expect(v).toBeLessThanOrEqual(prev + 1e-9);
      expect(v).toBeGreaterThanOrEqual(0);
      prev = v;
    }
    expect(hitEnvelope(a - 1e-4, a, d)).toBeCloseTo(hitEnvelope(a + 1e-4, a, d), 3);
  });

  it('spring dips below rest by about the requested share, once, then settles', () => {
    const a = 0.08;
    const d = 0.2;
    let min = 0;
    for (let t = a; t < a + 3; t += 0.001) min = Math.min(min, hitEnvelope(t, a, d, 0.12));
    expect(min).toBeCloseTo(-0.12, 2);
    expect(Math.abs(hitEnvelope(a + 3, a, d, 0.12))).toBeLessThan(0.001);
    expect(hitEnvelope(a - 1e-4, a, d, 0.12)).toBeCloseTo(hitEnvelope(a + 1e-4, a, d, 0.12), 3);
  });
});
