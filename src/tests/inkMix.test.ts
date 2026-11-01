import { describe, expect, it } from 'vitest';
import { inkMix, overlapState } from '../animation/overlap';
import { setPaletteTheme } from '../presets/gradients';

const hsv = ([r, g, b]: number[]) => {
  const v = Math.max(r, g, b);
  const d = v - Math.min(r, g, b);
  const h = d === 0 ? 0 : v === r ? (((g - b) / d) % 6) * 60 : v === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
  return [(h + 360) % 360, v ? d / v : 0, v];
};
const rgb = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));

describe('Light Mode overlap color mixing', () => {
  it('Blue + Yellow mixes to green', () => {
    const [h] = hsv(inkMix('#ADDBFB', '#FEF49D'));
    expect(h).toBeGreaterThan(80);
    expect(h).toBeLessThan(160);
  });
  it('a color with itself becomes more saturated and denser', () => {
    const [h0, s0, v0] = hsv(rgb('#FEF49D'));
    const [h1, s1, v1] = hsv(inkMix('#FEF49D', '#FEF49D'));
    expect(Math.abs(h1 - h0)).toBeLessThan(6);
    expect(s1).toBeGreaterThan(s0 * 1.5);
    expect(v1).toBeLessThanOrEqual(v0);
  });
  it('the shared region takes the mixed color strongly while both sound, and nothing when silent', () => {
    setPaletteTheme('light');
    const sizes = { kick: { x: 80 }, snare: { x: 60 }, hihat: { x: 40 }, clap: { x: 20 } };
    const colors = { kick: 'yellow', snare: 'blue', hihat: 'yellow', clap: 'yellow' } as const;
    const on = (chs: string[]) => (ch: string) => (chs.includes(ch) ? 1 : 0);
    const o = overlapState(on(['kick', 'snare']), sizes, colors, true);
    const [h] = hsv(rgb(o.snare.tintColor));
    expect(h).toBeGreaterThan(80);
    expect(h).toBeLessThan(160);
    expect(o.snare.tintOpacity).toBeGreaterThan(0.7);
    expect(o.kick.tintOpacity).toBe(0); // the largest form has nothing beneath it to mix with
    const same = overlapState(on(['kick', 'hihat']), sizes, colors, true);
    expect(hsv(rgb(same.hihat.tintColor))[1]).toBeGreaterThan(hsv(rgb('#FEF49D'))[1] * 1.5);
    expect(overlapState(null, sizes, colors, true).snare.tintOpacity).toBe(0);
  });
});
