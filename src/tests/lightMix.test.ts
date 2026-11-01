import { describe, expect, it } from 'vitest';
import { LIGHT_LAYER, overlapState } from '../animation/overlap';
import { gradientFor, setPaletteTheme } from '../presets/gradients';

const sizes = { kick: { x: 80 }, snare: { x: 60 }, hihat: { x: 40 }, clap: { x: 20 } };
const on = (chs: string[]) => (ch: string) => (chs.includes(ch) ? 1 : 0);

describe('Light Mode overlap: no blending, subtle same-color layering', () => {
  it('different colors never blend: no wash, no new color', () => {
    setPaletteTheme('light');
    const colors = { kick: 'yellow', snare: 'blue', hihat: 'green', clap: 'pink' } as const;
    const o = overlapState(on(['kick', 'snare', 'hihat', 'clap']), sizes, colors, true);
    for (const ch of ['kick', 'snare', 'hihat', 'clap'] as const) {
      expect(o[ch].tintOpacity).toBe(0);
      expect(o[ch].intensity).toBe(0);
      expect(o[ch].mix).toBe(0);
    }
  });
  it('same colors layer a touch deeper, in their own tone, and stay subtle', () => {
    setPaletteTheme('light');
    const colors = { kick: 'yellow', snare: 'blue', hihat: 'yellow', clap: 'yellow' } as const;
    const o = overlapState(on(['kick', 'snare', 'hihat', 'clap']), sizes, colors, true);
    expect(o.hihat.tintColor).toBe(gradientFor('yellow').rich);
    expect(o.hihat.tintOpacity).toBeGreaterThan(0.05);
    expect(o.clap.tintOpacity).toBeGreaterThan(o.hihat.tintOpacity); // two yellows above it
    for (const ch of ['hihat', 'clap'] as const) {
      expect(o[ch].tintOpacity).toBeLessThanOrEqual(LIGHT_LAYER.wash);
      expect(o[ch].intensity).toBeLessThanOrEqual(LIGHT_LAYER.intensity);
      expect(o[ch].mix).toBe(0);
    }
    expect(o.snare.tintOpacity).toBe(0); // blue under yellow: keeps its own color
    expect(o.kick.tintOpacity).toBe(0);
  });
  it('nothing happens when silent', () => {
    const colors = { kick: 'yellow', snare: 'yellow', hihat: 'yellow', clap: 'yellow' } as const;
    expect(overlapState(null, sizes, colors, true).snare.tintOpacity).toBe(0);
  });
  it('Dark Mode keeps its own overlap wash unchanged', () => {
    setPaletteTheme('dark');
    const colors = { kick: 'yellow', snare: 'blue', hihat: 'yellow', clap: 'yellow' } as const;
    const o = overlapState(on(['kick', 'snare']), sizes, colors, false);
    expect(o.snare.mix).toBeGreaterThan(0);
    expect(o.snare.tintOpacity).toBeGreaterThan(0);
  });
});
