import { describe, expect, it } from 'vitest';
import { brightenHex, DARK_BRIGHTNESS, DARK_EARTH, DARK_HUE, DARK_MUTE, DARK_SATURATION, GRADIENTS, GRADIENTS_DARK, gradientFor, LIGHT_SATURATION, muteHex, saturateHex, withHue } from '../presets/gradients';

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

const hsvN = (hex: string) => { const [h, s, v] = hsv(hex); return [h, s, v / 255] as const; };

describe('theme palettes', () => {
  it('Dark Mode: orange and brown are clearly apart (hue ≥ 10°, and brown clearly darker and calmer)', () => {
    for (const tone of ['base', 'rich', 'deep'] as const) {
      const [ho, so, vo] = hsvN(GRADIENTS_DARK.orange[tone]);
      const [hb, sb, vb] = hsvN(GRADIENTS_DARK.brown[tone]);
      expect(ho - hb, tone).toBeGreaterThanOrEqual(10);
      expect(vo - vb, tone).toBeGreaterThan(0.15);
      expect(so - sb, tone).toBeGreaterThan(0.25);
    }
  });
  it('the palette keeps the exact reference HEX values', () => {
    const want = { orange: '#FFB771', yellow: '#FEF49D', green: '#ADF0E4', blue: '#ADDBFB', pink: '#FBCAE3', purple: '#D6BEFC', brown: '#BA9784' };
    for (const [id, hex] of Object.entries(want)) expect(GRADIENTS[id as keyof typeof want].base).toBe(hex);
  });
  it('Light Mode circles: every tone at 90% saturation, same hue and brightness', () => {
    expect(LIGHT_SATURATION).toBe(0.9);
    for (const [id, g] of Object.entries(GRADIENTS)) {
      for (const [tone, hex] of Object.entries(g)) {
        const out = gradientFor(id as keyof typeof GRADIENTS, 'light')[tone as keyof typeof g];
        const [h0, s0, v0] = hsv(hex);
        const [h1, s1, v1] = hsv(out);
        expect(s1, `${id} ${tone}`).toBeCloseTo(s0 * 0.9, 1);
        expect(Math.abs(v1 - v0)).toBeLessThanOrEqual(1);
        if (s0 > 0.05) expect(Math.abs(((h1 - h0 + 540) % 360) - 180), `${id} ${tone} hue`).toBeLessThan(3);
      }
    }
  });
  it('Dark Mode: every tone 2.2325625× saturation (HSV, same hue and value), then ×1.452 brightness (clamped)', () => {
    expect(DARK_SATURATION).toBeCloseTo(2.2325625);
    expect(DARK_BRIGHTNESS).toBeCloseTo(1.452);
    for (const [id, g] of Object.entries(GRADIENTS)) {
      for (const [tone, hex] of Object.entries(g)) {
        const sat = saturateHex(hex, DARK_SATURATION);
        const [h0, s0, v0] = hsv(hex);
        const [h1, s1, v1] = hsv(sat);
        expect(s1, `${id} ${tone}`).toBeCloseTo(Math.min(1, s0 * DARK_SATURATION), 1);
        expect(Math.abs(v1 - v0), `${id} ${tone} value`).toBeLessThanOrEqual(1);
        if (s0 > 0.05) expect(Math.abs(((h1 - h0 + 540) % 360) - 180), `${id} ${tone} hue`).toBeLessThan(3);
        const lit = brightenHex(sat, DARK_BRIGHTNESS);
        const h = DARK_HUE[id as keyof typeof GRADIENTS];
        const muted = muteHex(h === undefined ? lit : withHue(lit, h), DARK_MUTE.saturation, DARK_MUTE.value);
        const e = DARK_EARTH[id as keyof typeof GRADIENTS];
        expect(GRADIENTS_DARK[id as keyof typeof GRADIENTS][tone as keyof typeof g]).toBe(e ? muteHex(withHue(muted, e.hue), e.saturation, e.value) : muted);
      }
    }
    expect(brightenHex('#806040', 1.2)).toBe('#9A734D');
    expect(brightenHex('#F0A000', 1.2)).toBe('#FFC000');
  });
  it('is always derived from the Light palette, never compounding', () => {
    expect(gradientFor('pink', 'dark').base).toBe(muteHex(brightenHex(saturateHex(GRADIENTS.pink.base, DARK_SATURATION), DARK_BRIGHTNESS), DARK_MUTE.saturation, DARK_MUTE.value));
    expect(gradientFor('blue', 'dark').base).toBe(gradientFor('blue', 'dark').base);
    expect(gradientFor('blue', 'light').base).toBe(saturateHex('#ADDBFB', LIGHT_SATURATION));
  });
  it('Dark Mode: green and blue are clearly different hues (at least 50° apart) with other colors unchanged', () => {
    expect(Object.keys(DARK_HUE).sort()).toEqual(['blue', 'green', 'orange']);
    for (const tone of ['light', 'base', 'rich', 'deep'] as const) {
      const [hg, hb] = [hue(GRADIENTS_DARK.green[tone]), hue(GRADIENTS_DARK.blue[tone])];
      expect(Math.abs(hg - 150), `green ${tone}`).toBeLessThan(3);
      expect(Math.abs(hb - 212), `blue ${tone}`).toBeLessThan(2);
      expect(hb - hg).toBeGreaterThanOrEqual(50);
    }
    expect(withHue('#FF0000', 120)).toBe('#00FF00');
    expect(withHue('#80FFC0', 240)).toBe('#8080FF');
    expect(GRADIENTS.green.base).toBe('#ADF0E4');
  });
  it('Dark Mode tones are deeper and muted (value ×0.8, saturation ×1.0005, same hue)', () => {
    expect(DARK_MUTE).toEqual({ saturation: 0.85 * 1.1 * 1.07, value: 0.8 });
    expect(muteHex('#FF0000', DARK_MUTE.saturation, DARK_MUTE.value)).toBe('#CC0000');
    expect(muteHex('#FFFFFF', DARK_MUTE.saturation, DARK_MUTE.value)).toBe('#CCCCCC');
    expect(muteHex('#000000', DARK_MUTE.saturation, DARK_MUTE.value)).toBe('#000000');
    for (const g of Object.values(GRADIENTS_DARK)) for (const tone of ['light', 'base', 'rich', 'deep'] as const) {
      const n = Number.parseInt(g[tone].slice(1), 16);
      expect(Math.max((n >> 16) & 255, (n >> 8) & 255, n & 255)).toBeLessThanOrEqual(204);
    }
    const [hg, hb] = [hue(GRADIENTS_DARK.green.base), hue(GRADIENTS_DARK.blue.base)];
    expect(hb - hg).toBeGreaterThanOrEqual(50);
  });
});
