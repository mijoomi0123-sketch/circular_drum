import { describe, expect, it } from 'vitest';
import { buildRings } from '../presets/designs';
import { buildOutlineRings, MAX_RING_R } from '../presets/outlineRings';

const sizes = { kick: 80, snare: 60, hihat: 45, clap: 25 };
const forms = (seed: number) => buildRings({ seed } as never, sizes);

describe('Dark Mode outline rings', () => {
  it('are the same for the same artwork', () => {
    expect(buildOutlineRings(7, forms(7))).toEqual(buildOutlineRings(7, forms(7)));
  });
  it('are only a few, each with a role: centre link, outer echo, 1–2 waves; never past the drawing', () => {
    for (let seed = 1; seed < 60; seed++) {
      const f = forms(seed);
      const rings = buildOutlineRings(seed, f);
      const [outer, inner] = [f[0], f[f.length - 1]];
      expect(rings.length).toBeGreaterThanOrEqual(3);
      expect(rings.length).toBeLessThanOrEqual(4);
      expect(rings.filter((o) => o.r < inner.r)).toHaveLength(1);
      expect(rings.filter((o) => o.r > outer.r).length).toBe(rings.length - 1);
      for (const o of rings) {
        expect(o.r * (1 + o.grow) + Math.abs(o.dx) + 4).toBeLessThan(200);
        expect(o.r).toBeLessThanOrEqual(MAX_RING_R);
        expect(Math.abs(o.rx / o.ry - 1)).toBeLessThan(0.08);
      }
    }
  });
});
