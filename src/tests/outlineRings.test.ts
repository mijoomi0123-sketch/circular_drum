import { describe, expect, it } from 'vitest';
import { buildRings } from '../presets/designs';
import { buildOutlineRings, MAX_RING_R } from '../presets/outlineRings';

const sizes = { kick: 80, snare: 60, hihat: 45, clap: 25 };
const forms = (seed: number) => buildRings({ seed } as never, sizes);

describe('Dark Mode outline rings', () => {
  it('are the same for the same artwork', () => {
    expect(buildOutlineRings(7, forms(7))).toEqual(buildOutlineRings(7, forms(7)));
  });
  it('one ring per instrument, just outside its own form, in the form\'s color: pairs Kick, Snare, Hi-hat, Clap', () => {
    for (let seed = 1; seed < 60; seed++) {
      const f = forms(seed);
      const rings = buildOutlineRings(seed, f);
      expect(rings.map((o) => o.zone)).toEqual(['kick', 'snare', 'hihat', 'clap']);
      // All eight lines from the outside: each pair stays together, no other line between.
      const lines = [...f.map((x) => ({ zone: x.zone, r: x.r })), ...rings.map((o) => ({ zone: o.zone, r: o.r }))].sort((a, b) => b.r - a.r);
      expect(lines.map((l) => l.zone)).toEqual(['kick', 'kick', 'snare', 'snare', 'hihat', 'hihat', 'clap', 'clap']);
      for (const o of rings) {
        expect(o.tone).toBe('base');
        expect(o.r).toBeLessThanOrEqual(MAX_RING_R);
        expect(o.r * (1 + o.grow) + 4).toBeLessThan(200);
      }
    }
  });
});
