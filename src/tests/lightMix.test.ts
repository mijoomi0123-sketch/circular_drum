import { describe, expect, it } from 'vitest';
import { lightMix, overlapState } from '../animation/overlap';
import { setPaletteTheme } from '../presets/gradients';

const hsv = ([r, g, b]: number[]) => {
  const v = Math.max(r, g, b);
  const d = v - Math.min(r, g, b);
  const h = d === 0 ? 0 : v === r ? (((g - b) / d) % 6) * 60 : v === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
  return [(h + 360) % 360, v ? d / v : 0, v];
};
const rgb = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
const [YELLOW, BLUE] = ['#FEF49D', '#ADDBFB'];

describe('Light Mode overlap: colors mix like light', () => {
  it('Blue + Yellow → a clear, bright green (never darker than either color)', () => {
    const [h, s, v] = hsv(lightMix([{ hex: BLUE, w: 1 }, { hex: YELLOW, w: 1 }]));
    expect(h).toBeGreaterThan(100);
    expect(h).toBeLessThan(160);
    expect(v).toBeGreaterThanOrEqual(Math.max(hsv(rgb(BLUE))[2], hsv(rgb(YELLOW))[2]) - 1);
    expect(s).toBeGreaterThan(hsv(rgb(BLUE))[1]);
  });
  it('Yellow + Yellow → the same yellow, brighter and more vivid', () => {
    const [h0, s0, v0] = hsv(rgb(YELLOW));
    const [h1, s1, v1] = hsv(lightMix([{ hex: YELLOW, w: 1 }, { hex: YELLOW, w: 1 }]));
    expect(Math.abs(h1 - h0)).toBeLessThan(2);
    expect(s1).toBeGreaterThan(s0 * 1.4);
    expect(v1).toBeGreaterThanOrEqual(v0 - 1);
  });
  it('every pair of palette colors mixes without getting darker', () => {
    const palette = ['#FFB771', YELLOW, '#ADF0E4', BLUE, '#FBCAE3', '#D6BEFC', '#BA9784'];
    for (const a of palette) for (const b of palette) {
      const [, , v] = hsv(lightMix([{ hex: a, w: 1 }, { hex: b, w: 1 }]));
      expect(v, `${a}+${b}`).toBeGreaterThanOrEqual(Math.max(hsv(rgb(a))[2], hsv(rgb(b))[2]) - 1);
    }
  });
  it('the shared region takes the mixed color strongly while both sound, and nothing when silent', () => {
    setPaletteTheme('light');
    const sizes = { kick: { x: 80 }, snare: { x: 60 }, hihat: { x: 40 }, clap: { x: 20 } };
    const colors = { kick: 'yellow', snare: 'blue', hihat: 'yellow', clap: 'yellow' } as const;
    const on = (chs: string[]) => (ch: string) => (chs.includes(ch) ? 1 : 0);
    const o = overlapState(on(['kick', 'snare']), sizes, colors, true);
    const [h] = hsv(rgb(o.snare.tintColor));
    expect(h).toBeGreaterThan(100);
    expect(h).toBeLessThan(160);
    expect(o.snare.tintOpacity).toBeGreaterThan(0.7);
    expect(o.kick.tintOpacity).toBe(0);
    const same = overlapState(on(['kick', 'hihat']), sizes, colors, true);
    expect(hsv(rgb(same.hihat.tintColor))[1]).toBeGreaterThan(hsv(rgb(YELLOW))[1] * 1.4);
    expect(overlapState(null, sizes, colors, true).snare.tintOpacity).toBe(0);
  });
});
