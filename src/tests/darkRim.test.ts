import { describe, expect, it } from 'vitest';
import { darkContour, GRADIENTS_DARK, RIM_DEPTH, type ColorStop } from '../presets/gradients';

const g = GRADIENTS_DARK.pink;
const rgb = (h: string) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));

describe('Dark Mode contour gradient', () => {
  it('colors inside 88% unchanged; up to 12% deeper at the edge; opacity unchanged', () => {
    const stops: ColorStop[] = [[0, g.light, 1], [0.5, g.base, 1], [0.88, g.rich, 0.96], [1, g.rich, 0.9]];
    const out = darkContour(stops);
    expect(out.slice(0, 3)).toEqual(stops.slice(0, 3));
    expect(out[3][2]).toBe(0.9);
    rgb(out[3][1]).forEach((v, k) => expect(Math.abs(v - rgb(g.rich)[k] * (1 - RIM_DEPTH))).toBeLessThanOrEqual(1));
  });

  it('adds the band start on the existing line when no stop sits at 88%', () => {
    const stops: ColorStop[] = [[0, '#000000', 1], [0.8, '#808080', 0.84], [0.94, '#FFFFFF', 0.8], [1, '#FFFFFF', 0.76]];
    const out = darkContour(stops);
    expect(out.map(([o]) => o)).toEqual([0, 0.8, 0.88, 0.94, 1]);
    expect(out[2][2]).toBeCloseTo(0.84 - 0.04 * (0.08 / 0.14));
    expect(rgb(out[3][1])[0]).toBe(Math.round(255 * (1 - RIM_DEPTH * 6 / 12)));
    expect(out[4][1]).toBe('#' + Math.round(255 * 0.88).toString(16).toUpperCase().repeat(3));
  });
});

describe('Dark Mode neon lift', () => {
  it('brightens only the outer part of a form toward its light tone; offsets and opacity kept', async () => {
    const { darkLift, NEON_LIFT } = await import('../presets/gradients');
    const stops: ColorStop[] = [[0, '#000000', 1], [0.4, '#000000', 1], [0.7, '#000000', 0.9], [1, '#000000', 0.8]];
    const out = darkLift(stops, '#FFFFFF');
    expect(out.map(([o, , a]) => [o, a])).toEqual(stops.map(([o, , a]) => [o, a]));
    expect(out[0][1]).toBe('#000000');
    expect(out[1][1]).toBe('#000000');
    expect(rgb(out[3][1])[0]).toBe(Math.round(255 * NEON_LIFT));
    expect(rgb(out[2][1])[0]).toBe(Math.round(255 * NEON_LIFT * 0.5));
  });
});
