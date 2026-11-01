import type { ColorId } from '../types';

/**
 * Each selectable color read as a small gradient family rather than one flat
 * value: luminous glow → light → base → rich → deep, all of one hue family.
 * A form only ever uses its own color's family; other hues appear only when
 * different-colored instruments sound together (animation/overlap.ts).
 * `ink` is the readable accent for controls.
 *
 * Each `base` is the palette's exact HEX (the seven reference colors, also
 * in presets/colors.ts); the other tones are lighter or deeper steps of the
 * same hue, so the radial gradients keep their structure in the new palette.
 */
export interface GradientFamily {
  glow: string;
  light: string;
  base: string;
  rich: string;
  deep: string;
  ink: string;
}

export const GRADIENTS: Readonly<Record<ColorId, GradientFamily>> = {
  // soft apricot: base #FFB771 exactly; lighter and deeper tones of the same hue around it
  orange: { glow: '#FFEBD7', light: '#FFD4AA', base: '#FFB771', rich: '#FFA54D', deep: '#FF9024', ink: '#B85B00' },
  // pale butter: base #FEF49D exactly; lighter and deeper tones of the same hue around it
  yellow: { glow: '#FFFCE4', light: '#FEF8C4', base: '#FEF49D', rich: '#FEF07A', deep: '#FDEC51', ink: '#B6A302' },
  // mint aqua: base #ADF0E4 exactly; lighter and deeper tones of the same hue around it
  green: { glow: '#E8FBF7', light: '#CEF6EF', base: '#ADF0E4', rich: '#8FEADA', deep: '#6CE4CF', ink: '#1C9B84' },
  // sky blue: base #ADDBFB exactly; lighter and deeper tones of the same hue around it
  blue: { glow: '#E8F5FE', light: '#CEE9FD', base: '#ADDBFB', rich: '#8BCCF9', deep: '#64BBF7', ink: '#096BAF' },
  // blush pink: base #FBCAE3 exactly; lighter and deeper tones of the same hue around it
  pink: { glow: '#FEF0F7', light: '#FDDFEE', base: '#FBCAE3', rich: '#F8A9D1', deep: '#F683BD', ink: '#AB0D5D' },
  // lilac: base #D6BEFC exactly; lighter and deeper tones of the same hue around it
  purple: { glow: '#F4EDFE', light: '#E6D8FD', base: '#D6BEFC', rich: '#C09CFA', deep: '#A875F9', ink: '#4908B0' },
  // warm taupe: base #BA9784 exactly; lighter and deeper tones of the same hue around it
  brown: { glow: '#ECE2DD', light: '#D6C1B5', base: '#BA9784', rich: '#AD846D', deep: '#9B6F57', ink: '#855032' },
};

/**
 * How much more saturated the palette is in Dark Mode: ×1.4, then a further
 * +25% of that (×1.25), then +5% more (×1.05), then +50% more (×1.5),
 * then 10% less (×0.9), then 10% less again (×0.9): ×2.2325625 of the Light
 * Mode base, clamped to 100%.
 */
export const DARK_SATURATION = 1.4 * 1.25 * 1.05 * 1.5 * 0.9 * 0.9;

/**
 * Dark Mode hues for green and blue. Brightening clips both toward cyan
 * (~180°), where they looked alike, so in Dark Mode each tone is turned to a
 * fixed hue (keeping its saturation and value): green to a clear green,
 * blue to a clear sky blue. Light Mode and the other colors are unchanged.
 */
export const DARK_HUE: Readonly<Partial<Record<ColorId, number>>> = { green: 150, blue: 212, orange: 30 };

/**
 * Dark Mode fine-tuning, after everything above (hue, then saturation and
 * value scaled), so neighbouring colors read clearly apart on black:
 *   brown  saturating and brightening turned it into a second orange, so it is
 *          pulled back to an earthy, darker copper brown;
 *   pink   clipped toward lavender (~300°), close to purple: turned to a clear
 *          rose pink (330°) and made a little richer;
 *   purple turned to a clear violet (268°), away from the pink.
 */
export const DARK_TUNE: Readonly<Partial<Record<ColorId, { hue: number; saturation: number; value: number }>>> = {
  brown: { hue: 18, saturation: 0.72, value: 0.76 },
  pink: { hue: 332, saturation: 2.2, value: 1 },
  purple: { hue: 266, saturation: 1.25, value: 1 },
};

/**
 * Dark Mode depth: after saturation, brightness and hue, every tone is made
 * deeper and calmer so it sits on the pure black canvas: HSV value ×0.8 and
 * saturation ×0.85, same hue. The neon glow and its light-tone lift still come
 * from these tones, so the forms keep glowing, just in darker, muted colors.
 */
export const DARK_MUTE = { saturation: 0.85 * 1.1 * 1.07 * 1.2, value: 0.8 } as const;

/** One color with its HSV saturation and value each multiplied (clamped to 1), same hue. */
export function muteHex(hex: string, saturation: number, value: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const v = Math.max(r, g, b);
  if (v === 0) return hex;
  const s = (v - Math.min(r, g, b)) / v;
  const v2 = Math.min(255, v * value);
  const s2 = Math.min(1, s * saturation);
  // Each channel keeps its relative place between min and max, so the hue stays put.
  const ch = (c: number) => {
    const t = s === 0 ? 1 : 1 - (v - c) / (v * s);
    return Math.round(v2 * (1 - s2 * (1 - t))).toString(16).padStart(2, '0');
  };
  return `#${ch(r)}${ch(g)}${ch(b)}`.toUpperCase();
}

/** One color turned to hue `h` (degrees), keeping its HSV saturation and value. */
export function withHue(hex: string, h: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const v = Math.max(r, g, b);
  const c = v - Math.min(r, g, b);
  const f = (k: number) => {
    const t = (k + h / 60) % 6;
    return Math.round(v - c * Math.max(0, Math.min(t, 4 - t, 1)));
  };
  return `#${[f(5), f(3), f(1)].map((x) => x.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/**
 * One color with its HSV saturation multiplied by `factor` (clamped to 1),
 * keeping its hue and value (brightness). HSV is used because the pastels
 * already sit near 100% in HSL saturation, where ×1.4 would change nothing.
 */
export function saturateHex(hex: string, factor: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const v = Math.max(r, g, b);
  if (v === 0) return hex;
  const s = Math.min(1, ((v - Math.min(r, g, b)) / v) * factor);
  // Every channel keeps its place between the value (max) and the new minimum, so hue and value stay put.
  const min = v * (1 - s);
  const oldMin = Math.min(r, g, b);
  const scale = v === oldMin ? 0 : (v - min) / (v - oldMin);
  const ch = (c: number) => Math.round(v - (v - c) * scale).toString(16).padStart(2, '0');
  return `#${ch(r)}${ch(g)}${ch(b)}`.toUpperCase();
}

/** Dark Mode brightness: every channel ×1.2, then +10% more, then +10% more (×1.452 in all), clamped to 255. */
export const DARK_BRIGHTNESS = 1.2 * 1.1 * 1.1;

/** One color with every RGB channel multiplied by `factor`, clamped. */
export function brightenHex(hex: string, factor: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const ch = (c: number) => Math.min(255, Math.round(c * factor)).toString(16).padStart(2, '0');
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`.toUpperCase();
}

/**
 * Dark Mode families: every tone of each Light Mode family, ×2.2325625 saturation,
 * then ×1.452 brighter (green and blue then turned to DARK_HUE), then
 * deepened and muted by DARK_MUTE. Always derived
 * from GRADIENTS, never from itself.
 */
export const GRADIENTS_DARK: Readonly<Record<ColorId, GradientFamily>> = Object.fromEntries(
  Object.entries(GRADIENTS).map(([id, g]) => [
    id,
    Object.fromEntries(
      Object.entries(g).map(([tone, hex]) => {
        const lit = brightenHex(saturateHex(hex, DARK_SATURATION), DARK_BRIGHTNESS);
        const h = DARK_HUE[id as ColorId];
        const muted = muteHex(h === undefined ? lit : withHue(lit, h), DARK_MUTE.saturation, DARK_MUTE.value);
        const earth = DARK_TUNE[id as ColorId];
        return [tone, earth ? muteHex(withHue(muted, earth.hue), earth.saturation, earth.value) : muted];
      }),
    ) as unknown as GradientFamily,
  ]),
) as Record<ColorId, GradientFamily>;

/** Light Mode circles: every tone of the palette at 90% of its saturation (same hue and brightness). */
export const LIGHT_SATURATION = 0.9;

export const GRADIENTS_LIGHT: Readonly<Record<ColorId, GradientFamily>> = Object.fromEntries(
  Object.entries(GRADIENTS).map(([id, g]) => [
    id,
    Object.fromEntries(Object.entries(g).map(([tone, hex]) => [tone, saturateHex(hex, LIGHT_SATURATION)])) as unknown as GradientFamily,
  ]),
) as Record<ColorId, GradientFamily>;

export type PaletteTheme = 'light' | 'dark';
let activeTheme: PaletteTheme = 'light';

/** Set by the settings store whenever the theme changes. */
export function setPaletteTheme(theme: PaletteTheme) {
  activeTheme = theme;
}

/** A color's family for the active theme (Light Mode: the palette at LIGHT_SATURATION; Dark Mode: ×2.2325625 saturation, ×1.452 brightness, DARK_HUE for green and blue, DARK_MUTE). */
export function gradientFor(color: ColorId, theme: PaletteTheme = activeTheme): GradientFamily {
  return (theme === 'dark' ? GRADIENTS_DARK : GRADIENTS_LIGHT)[color];
}

/** A compact radial gradient for swatches, step dots and buttons. */
export function swatchGradient(color: ColorId, at = '35% 30%'): string {
  const g = gradientFor(color);
  return `radial-gradient(circle at ${at}, ${g.light} 0%, ${g.base} 48%, ${g.rich} 100%)`;
}

/** A gradient stop: offset (0 centre … 1 edge), color, opacity. */
export type ColorStop = [offset: number, color: string, opacity: number];

/**
 * Dark Mode contour: over a form's last 12% of radius (5% + 7%) its own colors
 * deepen gradually, by up to 12% at the edge, toward the black canvas. Opacity is
 * unchanged, so the edge stays crisp, with no line or ring. Light Mode never uses it.
 */
export const RIM_BAND = 0.12;
export const RIM_DEPTH = 0.12;
const RIM_FROM = Math.round((1 - RIM_BAND) * 1000) / 1000; // 0.88 exactly

/**
 * Dark Mode neon, inside the form: from 40% of the radius outward, each stop
 * moves a little toward its family's light tone (up to 16% at the edge), so
 * the outer gradient glows brighter. Same stops, same order, same hues.
 */
export const NEON_LIFT = 0.16;
const LIFT_FROM = 0.4;
export function darkLift(stops: readonly ColorStop[], light: string): ColorStop[] {
  return stops.map(([o, c, a]): ColorStop => [o, o > LIFT_FROM ? mixHex(c, light, (NEON_LIFT * (o - LIFT_FROM)) / (1 - LIFT_FROM)) : c, a]);
}

export function darkContour(stops: readonly ColorStop[]): ColorStop[] {
  const out = stops.map((s): ColorStop => [...s]);
  const i = out.findIndex(([o]) => o >= RIM_FROM);
  if (i > 0 && out[i][0] > RIM_FROM) {
    // A stop exactly where the band starts, on the line between its neighbours, so nothing inside the band moves.
    const [[o0, c0, a0], [o1, c1, a1]] = [out[i - 1], out[i]];
    const f = (RIM_FROM - o0) / (o1 - o0);
    out.splice(i, 0, [RIM_FROM, mixHex(c0, c1, f), a0 + (a1 - a0) * f]);
  }
  return out.map(([o, c, a]) => [o, o > RIM_FROM ? shadeHex(c, (RIM_DEPTH * (o - RIM_FROM)) / RIM_BAND) : c, a]);
}

const rgbOf = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const hexOf = (rgb: number[]) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
/** `k` of the way toward black (the Dark Mode canvas). */
const shadeHex = (hex: string, k: number) => hexOf(rgbOf(hex).map((c) => c * (1 - k)));
const mixHex = (a: string, b: string, f: number) => {
  const y = rgbOf(b);
  return hexOf(rgbOf(a).map((c, k) => c + (y[k] - c) * f));
};
