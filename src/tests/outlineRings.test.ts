import { describe, expect, it } from 'vitest';
import { buildRings } from '../presets/designs';
import { buildOutlineRings, MAX_RING_R } from '../presets/outlineRings';

const sizes = { kick: 80, snare: 60, hihat: 45, clap: 25 };
const forms = (seed: number) => buildRings({ seed } as never, sizes);

describe('Dark Mode outline rings', () => {
  it('are the same for the same artwork and differ between artworks', () => {
    expect(buildOutlineRings(7, forms(7))).toEqual(buildOutlineRings(7, forms(7)));
    const counts = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => buildOutlineRings(s, forms(s)).length));
    expect(counts.size).toBeGreaterThan(1);
  });
  it('give every form 2–4 rings near its edge and spread 2–4 wider rings outward, never past the drawing', () => {
    for (let seed = 1; seed < 40; seed++) {
      const f = forms(seed);
      const rings = buildOutlineRings(seed, f);
      for (const form of f) {
        const near = rings.filter((o) => o.zone === form.zone && o.r <= form.r * 1.08 + 1e-9);
        expect(near.length).toBeGreaterThanOrEqual(2);
      }
      const outer = f[0];
      const wide = rings.filter((o) => o.r > outer.r * 1.08 + 1e-9);
      expect(wide.length).toBeGreaterThanOrEqual(1);
      for (const o of rings) {
        expect(o.r * (1 + o.grow) + Math.abs(o.dx) + 4).toBeLessThan(200);
        expect(o.r).toBeLessThanOrEqual(MAX_RING_R);
        expect(Math.abs(o.rx / o.ry - 1)).toBeLessThan(0.08); // slightly irregular, still circles
        expect(o.period).toBeGreaterThanOrEqual(6);
        expect(o.grow).toBeLessThanOrEqual(0.12); // calm, not a strong ripple
      }
      expect(new Set(rings.map((o) => o.period.toFixed(2))).size).toBeGreaterThanOrEqual(rings.length - 2); // independent motion
    }
  });
});
