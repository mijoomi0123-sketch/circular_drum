import { describe, expect, it } from 'vitest';
import { brightenHex, DARK_SATURATION, GRADIENTS, GRADIENTS_DARK, gradientFor, saturateHex } from '../presets/gradients';

function hue(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

describe('color families', () => {
  it('every tone a form can use stays in its own hue family (no teal in brown, etc.)', () => {
    for (const [id, g] of Object.entries(GRADIENTS)) {
      const base = hue(g.base);
      for (const tone of ['glow', 'light', 'base', 'rich', 'deep'] as const) {
        const d = Math.abs(((hue(g[tone]) - base + 540) % 360) - 180);
        expect(d, `${id} ${tone} ${g[tone]}`).toBeLessThan(35);
      }
      expect(Object.keys(g).sort()).toEqual(['base', 'deep', 'glow', 'ink', 'light', 'rich']);
    }
  });
});

function hsv(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const v = Math.max(r, g, b);
  return [hue(hex), v ? (v - Math.min(r, g, b)) / v : 0, v];
}

describe('theme palettes', () => {
  it('Light Mode keeps the exact reference HEX values', () => {
    const want = { orange: '#FFB771', yellow: '#FEF49D', green: '#ADF0E4', blue: '#ADDBFB', pink: '#FBCAE3', purple: '#D6BEFC', brown: '#BA9784' };
    for (const [id, hex] of Object.entries(want)) expect(gradientFor(id as keyof typeof want, 'light').base).toBe(hex);
  });
  it('Dark Mode: every tone 1.8375× saturation (HSV, same hue and value), then ×1.32 brightness (clamped)', () => {
    expect(DARK_SATURATION).toBeCloseTo(1.8375);
    for (const [id, g] of Object.entries(GRADIENTS)) {
      for (const [tone, hex] of Object.entries(g)) {
        const sat = saturateHex(hex, DARK_SATURATION);
        const [h0, s0, v0] = hsv(hex);
        const [h1, s1, v1] = hsv(sat);
        expect(s1, `${id} ${tone}`).toBeCloseTo(Math.min(1, s0 * 1.8375), 1);
        expect(Math.abs(v1 - v0), `${id} ${tone} value`).toBeLessThanOrEqual(1);
        if (s0 > 0.05) expect(Math.abs(((h1 - h0 + 540) % 360) - 180), `${id} ${tone} hue`).toBeLessThan(3);
        expect(GRADIENTS_DARK[id as keyof typeof GRADIENTS][tone as keyof typeof g]).toBe(brightenHex(sat, 1.2 * 1.1));
      }
    }
    expect(brightenHex('#806040', 1.2)).toBe('#9A734D');
    expect(brightenHex('#F0A000', 1.2)).toBe('#FFC000');
  });
  it('is always derived from the Light palette, never compounding', () => {
    expect(gradientFor('blue', 'dark').base).toBe(brightenHex(saturateHex(GRADIENTS.blue.base, DARK_SATURATION), 1.2 * 1.1));
    expect(gradientFor('blue', 'dark').base).toBe(gradientFor('blue', 'dark').base);
    expect(gradientFor('blue', 'light').base).toBe('#ADDBFB');
  });
});
