import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { audibleTime } from '../animation/clock';
import type { DropletAnimator } from '../animation/droplet';
import { MOTION } from '../animation/visualEvents';
import { CHANNELS } from '../audio/channels';
import { transport } from '../audio/transport';
import { buildRings } from '../presets/designs';
import { buildOutlineRings } from '../presets/outlineRings';
import { overlapState } from '../animation/overlap';
import { darkContour, darkLift, gradientFor, GRADIENTS, type ColorStop, type GradientFamily } from '../presets/gradients';
import { useSettings } from '../storage/settingsStore';
import { circleSizes, SIZE_PRIORITY } from '../presets/sizing';
import type { ArtworkDesign, Channel, ChannelColors, ChannelPatterns, Ring } from '../types';

const VIEW = 106;
/**
 * The drawing extends to ±INK so the halos (up to ~2.5 blur radii outside a
 * swollen form) are never cut, while the layout box stays ±VIEW: the SVG is
 * drawn larger than, and centred on, its box (see .art-box in app.css). Its
 * size never changes, so sound-driven swelling can never move the page.
 */
const INK = 200;

interface Props {
  design: ArtworkDesign;
  /** Each instrument's color; its form is drawn from that color's gradient family. */
  colors: ChannelColors;
  /** Step rows and pattern length; circle sizes follow each row's active steps. */
  patterns: ChannelPatterns;
  steps: number;
  /** When given, each form moves with its own instrument's sound events. */
  animator?: DropletAnimator;
  /** Shown in the library, where `animator` is the artwork's silent rhythm (see animation/silentRhythm.ts). */
  idle?: boolean;
  /** Its library motion was stopped from the menu. */
  paused?: boolean;
  className?: string;
  label?: string;
}

type Stop = [offset: number, tone: keyof GradientFamily, opacity: number];

/**
 * Inside of each form, from its core (offset 0) to its rim (offset 1):
 *
 *   kick   dense: a deep core spreading through rich and base to a light rim
 *   snare  energetic: a luminous light core inside a saturated body
 *   hihat  airy: a lighter membrane whose color gathers at the rim
 *   clap   bright: a glowing core opening into its base and rich tones
 *
 * The outermost form holds its colors to a clean, precise silhouette (the
 * edge blur only anti-aliases). Every form inside it thins out over its last
 * quarter through several stops, so internal color boundaries blend
 * gradually instead of reading as stacked rings, while each region keeps its
 * own color. The softness comes from the gradients, not from blur.
 *
 * Every stop is a tone of the instrument's own color family, so a form never
 * shows a hue from another color.
 */
const STOPS: Record<Channel, { outer: Stop[]; inner: Stop[] }> = {
  kick: {
    outer: [[0, 'deep', 1], [0.32, 'rich', 1], [0.62, 'base', 1], [0.82, 'base', 1], [0.93, 'rich', 0.96], [1, 'base', 0.9]],
    inner: [[0, 'deep', 1], [0.3, 'rich', 1], [0.56, 'base', 1], [0.74, 'base', 0.85], [0.88, 'rich', 0.4], [1, 'rich', 0]],
  },
  snare: {
    outer: [[0, 'light', 1], [0.2, 'base', 1], [0.55, 'base', 1], [0.78, 'rich', 1], [0.93, 'rich', 0.96], [1, 'rich', 0.9]],
    inner: [[0, 'light', 1], [0.2, 'base', 1], [0.52, 'base', 1], [0.72, 'rich', 0.85], [0.88, 'rich', 0.4], [1, 'rich', 0]],
  },
  hihat: {
    outer: [[0, 'light', 0.82], [0.45, 'light', 0.82], [0.72, 'base', 0.86], [0.86, 'base', 0.84], [0.95, 'rich', 0.8], [1, 'rich', 0.76]],
    inner: [[0, 'light', 0.82], [0.42, 'light', 0.82], [0.66, 'base', 0.8], [0.8, 'base', 0.6], [0.92, 'rich', 0.25], [1, 'rich', 0]],
  },
  clap: {
    outer: [[0, 'light', 1], [0.26, 'base', 1], [0.6, 'rich', 1], [0.8, 'rich', 1], [0.93, 'rich', 0.94], [1, 'rich', 0.88]],
    inner: [[0, 'light', 1], [0.24, 'base', 1], [0.54, 'rich', 1], [0.72, 'rich', 0.8], [0.88, 'rich', 0.35], [1, 'rich', 0]],
  },
};
/** The outermost form keeps a clean silhouette; forms inside it thin out over their last quarter and melt into the color around them. */
const stopsOf = (ch: Channel, outer: boolean) => (outer ? STOPS[ch].outer : STOPS[ch].inner);

/** Stop colors and opacities of a form; in Dark Mode the outermost one gets its soft contour (see darkContour). */
function stopColors(ch: Channel, outer: boolean, g: GradientFamily, dark: boolean): ColorStop[] {
  const stops: ColorStop[] = stopsOf(ch, outer).map(([o, t, a]) => [o, g[t], a]);
  return dark && outer ? darkContour(darkLift(stops, g.light)) : stops;
}
const stopOffsets = (ch: Channel, outer: boolean, dark: boolean) => stopColors(ch, outer, GRADIENTS.orange, dark);

/** Overall saturation of the forms at rest (1 = the color families as they are; the pastel lift below keeps them soft). */
const BASE_SAT = 1;
/**
 * Pastel lift: each channel becomes c·slope + lift. The palette itself is now
 * pastel (exact reference HEX values), so the lift is neutral (1, 0) and every
 * base tone renders as its exact HEX.
 */
const PASTEL = { slope: 1, lift: 0 };

/** How far each gradient core keeps its off-centre position (1 = fully): mostly concentric, flat-luminous rather than glossy. */
const CORE_PULL = 0.3;

/** Soft edge (share of the radius) and the outer halo's spread and strength. */
const EDGE: Record<Channel, number> = {
  kick: 0.004,
  snare: 0.004,
  hihat: 0.006,
  clap: 0.004,
};
const HALO_SPREAD: Record<Channel, number> = {
  kick: 0.09,
  snare: 0.1,
  hihat: 0.08,
  clap: 0.12,
};
const HALO_ALPHA: Record<Channel, number> = {
  kick: 0.1,
  snare: 0.09,
  hihat: 0.07,
  clap: 0.1,
};

/**
 * Dark Mode neon: the outermost form's own-color halo is wider and stronger,
 * so the circle seems to give off its own light on black. The form itself
 * (shape, edge, gradient) is unchanged; the light stays close enough that
 * neighbours never merge. Light Mode and inner forms keep the values above.
 */
const NEON = { spread: 2.3, alpha: 6.5 };
function glowOf(ch: Channel, outer: boolean, dark: boolean): { spread: number; alpha: number } {
  const neon = dark && outer;
  return { spread: HALO_SPREAD[ch] * (neon ? NEON.spread : 1), alpha: HALO_ALPHA[ch] * (neon ? NEON.alpha : 1) };
}

/**
 * Each form's filter area, relative to its own circle: just wide enough for
 * its halo at the strongest hit (2.5 blur radii, where it has faded below
 * 1%). A tight area keeps the browser's filter buffer small, so it renders
 * at full display resolution even in fullscreen on large high-DPI screens
 * (WebKit, for one, lowers the resolution of filters above ~4096² pixels).
 */
const regions = (spread: number) =>
  Object.fromEntries(
    (Object.keys(HALO_SPREAD) as Channel[]).map((ch) => {
      const k = 1 + 2.5 * HALO_SPREAD[ch] * spread * 1.6; // half-size in radii
      return [ch, { x: `${(-(k - 1) / 2) * 100}%`, y: `${(-(k - 1) / 2) * 100}%`, width: `${k * 100}%`, height: `${k * 100}%` }];
    }),
  ) as Record<Channel, { x: string; y: string; width: string; height: string }>;
const FILTER_REGION = regions(1);
/** Dark Mode's outermost form: wide enough for its neon halo. */
const FILTER_REGION_NEON = regions(NEON.spread);

/**
 * Dark Mode outline rings: how far a hit expands them (×swell; rings near the
 * forms by `near`, the farthest by up to `near + far·0.9`) and how long the
 * wave takes to reach the outermost ring (seconds). Wide rings may spread
 * over neighbouring circles.
 */
const OUTLINE_WAVE = { near: 0.14, far: 0.75, lag: 0.07 };
/**
 * Dark Mode neon (blur radii in drawing units): a tight bloom and a close
 * glow on every line, plus, around the outer lines only, a wide light and a
 * far, faint one, so the light is strongest at the rings and fades gradually
 * into the black without filling the inside. While the circle sounds, the
 * glows brighten with the hits (`boost`) and settle back as the sound fades.
 */
const NEON_GLOW = { near: 1.1, mid: 2.6, midAlpha: 1.5, wide: 9, wideAlpha: 1.05, far: 26, farAlpha: 0.8, boost: { mid: 0.5, wide: 0.7, far: 1 } };

/** Dark Mode forms are drawn as outlines this wide (drawing units) instead of filled surfaces. */
const DARK_FORM_STROKE = 2;

/**
 * Dark Mode playing feedback: at a full hit a form grows by 30% of its radius
 * or 20 units, whichever is more (so even the smallest form clearly grows),
 * and its outline gets up to 2.5× thicker.
 */
const DARK_HIT = { share: 0.3, min: 20, stroke: 1.5 };

/**
 * Dark Mode: the least black space between the strokes of two neighbouring
 * lines of a circle (drawing units), at rest and in motion. With the 2-unit
 * form strokes this is 5.5 between centres, just under the least gap the
 * forms keep at rest (6 × the artwork scale, 0.95–1), so rest sizes never move.
 */
const RING_CLEAR = 3.5;
/** Next to a ring (whose neon bloom is wider), the clear space is wider too. */
const RING_CLEAR_WIDE = 8;


/** Spring rate of size changes (rad/s); critically damped, so no bounce. */
const SIZE_SPRING = 9;
/** Swollen forms ease into this band instead of leaving the frame. */
const SOFT_EDGE = 92;
const HARD_EDGE = VIEW - 6;

function capRadius(r: number): number {
  if (r <= SOFT_EDGE) return r;
  const room = HARD_EDGE - SOFT_EDGE;
  return SOFT_EDGE + room * Math.tanh((r - SOFT_EDGE) / room);
}

interface Spring {
  x: number;
  v: number;
}

/** Larger forms first so smaller ones draw on top; ties keep the hierarchy. */
function drawOrder(r: Record<Channel, number>): Channel[] {
  return [...SIZE_PRIORITY].sort((a, b) => r[b] - r[a] || SIZE_PRIORITY.indexOf(a) - SIZE_PRIORITY.indexOf(b));
}

/** Turns only the off-centre gradient core; no scale, so a form is always a perfect circle. */
function transformOf(ring: Ring): string {
  return `rotate(${ring.tilt.toFixed(2)})`;
}

/**
 * The artwork: exactly four soft color forms, one per instrument (see
 * audio/channels.ts), each an SVG circle filled with its own radial gradient
 * and wrapped in a filter that blurs its edge and adds a colored halo. All
 * four share the artwork's exact centre; they are slightly elliptical about
 * it, and only each gradient's core sits off-centre.
 *
 * Each form's base size comes from its instrument's active steps
 * (presets/sizing.ts); when the pattern changes, the forms glide to their new
 * sizes. With an animator, each form also reacts to its own instrument's
 * sound events around its current base size: it swells, its halo brightens,
 * its inner colors bloom outward, and the Snare and Clap briefly distort.
 * A requestAnimationFrame loop runs only while a size is moving or sound
 * events are pending or settling; at rest every attribute is written exactly.
 */
export function ArtworkGraphic({ design, colors, patterns, steps, animator, idle, paused, className, label }: Props) {
  const { theme } = useSettings(); // re-render with the theme's palette (Dark Mode: more saturated, with a soft contour)
  const sizes = circleSizes(patterns, steps); // the same in both themes
  const sizeKey = CHANNELS.map((ch) => sizes[ch].toFixed(4)).join();
  const rings = useMemo(() => buildRings(design, sizes), [design.seed, sizeKey]);
  const byZone = useMemo(() => Object.fromEntries(rings.map((r) => [r.zone, r])) as Record<Channel, Ring>, [rings]);
  const dark = theme === 'dark';
  const outlines = useMemo(() => (dark ? buildOutlineRings(design.seed, rings) : []), [dark, design.seed, rings]);
  const outlinesRef = useRef(outlines);
  outlinesRef.current = outlines;
  const ringEls = useRef<(SVGGElement | null)[]>([]);

  const springs = useRef<Record<Channel, Spring> | null>(null);
  if (!springs.current) springs.current = Object.fromEntries(rings.map((r) => [r.zone, { x: r.r, v: 0 }])) as Record<Channel, Spring>;
  const [order, setOrder] = useState<Channel[]>(() => rings.map((r) => r.zone));
  const orderRef = useRef(order);
  orderRef.current = order;
  const darkRef = useRef(theme === 'dark');
  darkRef.current = theme === 'dark';

  const refs = useRef<Partial<Record<Channel, SVGCircleElement | null>>>({});
  const uid = useId().replace(/:/g, '');
  const idOf = (kind: 'g' | 'f', ch: Channel) => `${kind}-${ch}-${uid}`;
  const colorsRef = useRef(colors);
  colorsRef.current = colors;
  const ringsRef = useRef(byZone);
  ringsRef.current = byZone;
  const wakeRef = useRef<() => void>(() => {});


  useEffect(() => {
    let raf = 0;
    let running = false;
    let last = 0;
    const sp = springs.current!;
    const svg = refs.current.kick?.ownerSVGElement ?? null;
    const part = (ch: Channel) => {
      const g = svg?.querySelector(`#${idOf('g', ch)}`);
      const f = svg?.querySelector(`#${idOf('f', ch)}`);
      return {
        stops: g ? [...g.querySelectorAll('stop')] : [],
        halo: f?.querySelector('[data-part="halo"]') ?? null,
        haloA: f?.querySelector('feFuncA') ?? null,
        edge: f?.querySelector('[data-part="edge"]') ?? null,
        sat: f?.querySelector('[data-part="sat"]') ?? null,
        lum: f ? [...f.querySelectorAll('[data-part="lum"] > *')] : [],
        tint: f?.querySelector('[data-part="tint"]') ?? null,
      };
    };
    const parts = Object.fromEntries(CHANNELS.map((ch) => [ch, part(ch)])) as Record<Channel, ReturnType<typeof part>>;

    /** Moves each base size toward its target; true while any is still moving. */
    const advance = (dt: number): boolean => {
      let moving = false;
      for (const ch of CHANNELS) {
        const s = sp[ch];
        const target = ringsRef.current[ch].r;
        const x = s.x - target;
        if (Math.abs(x) < 0.005 && Math.abs(s.v) < 0.01) {
          s.x = target;
          s.v = 0;
          continue;
        }
        const k = s.v + SIZE_SPRING * x;
        const e = Math.exp(-SIZE_SPRING * dt);
        s.x = target + (x + k * dt) * e;
        s.v = (s.v - SIZE_SPRING * k * dt) * e;
        moving = true;
      }
      return moving;
    };

    /**
     * Dark Mode outline rings follow the sound: every ring, inner to outer,
     * swells with the circle's hits (its own instrument most, the others
     * too, so the circle moves as one system). Outer rings expand further and
     * a little later, so each hit reads as a wave of light spreading outward.
     * Between hits they breathe faintly; at rest they sit exactly in place.
     *
     * Then every line of the circle (the four form outlines and these rings)
     * is kept in its rest order with at least RING_CLEAR of black between neighbouring strokes: a
     * line that would reach the next one pushes it outward instead, so rings
     * never touch, cross or stack, even on the strongest hit.
     */
    const applyOutlines = (t: number | null) => {
      const list = outlinesRef.current;
      if (!darkRef.current) return;
      const live = t !== null && !!animator;
      const outerR = Math.max(...CHANNELS.map((ch) => ringsRef.current[ch].r));
      const now = performance.now() / 1000;
      const want = list.map((o) => {
        if (!live) return { r: o.r, wave: 0, energy: 0 };
        const out = Math.max(0, o.r / outerR - 0.85); // 0 near the forms, up to ~0.9 for the farthest ring
        const lag = OUTLINE_WAVE.lag * (o.r / outerR); // seconds: the wave reaches outer rings later
        let own = 0;
        let all = 0;
        let energy = 0;
        for (const ch of CHANNELS) {
          const s = animator!.sample(t! - lag, ch);
          const v = Math.max(0, s.swell);
          if (ch === o.zone) own = v;
          all = Math.max(all, v);
          energy = Math.max(energy, s.energy);
        }
        const wave = 0.65 * own + 0.35 * all;
        const breathe = o.grow * 0.35 * Math.sin((2 * Math.PI * now) / o.period + o.delay);
        return { r: o.r * (1 + breathe + wave * (OUTLINE_WAVE.near + OUTLINE_WAVE.far * out)), wave, energy };
      });

      // The neon swells with the circle's sound and settles back with it.
      const glow = live ? Math.max(...want.map((w) => w.energy), 0) : 0;
      // Looked up each time: the filter only exists while Dark Mode is on.
      for (const [part, base, boost] of [
        ['mid', NEON_GLOW.midAlpha, NEON_GLOW.boost.mid],
        ['wide', NEON_GLOW.wideAlpha, NEON_GLOW.boost.wide],
        ['far', NEON_GLOW.farAlpha, NEON_GLOW.boost.far],
      ] as const) {
        svg?.querySelectorAll(`[data-part="neon-${part}"]`).forEach((fn) => fn.setAttribute('slope', (base * (1 + boost * glow)).toFixed(3)));
      }
      svg?.setAttribute('data-neon', glow.toFixed(4));

      // Every line of the circle in rest order, pushed apart where they would meet.
      const lines = [
        ...CHANNELS.map((ch) => {
          const el = refs.current[ch];
          return { rest: sp[ch].x, r: Number(el?.getAttribute('r') ?? sp[ch].x), w: Number(el?.getAttribute('stroke-width') ?? DARK_FORM_STROKE), form: ch as Channel | null, i: -1 };
        }),
        ...list.map((o, i) => ({ rest: o.r, r: want[i].r, w: live ? o.width * (1 + 0.7 * want[i].energy) : o.width, form: null as Channel | null, i })),
      ].sort((a, b) => a.rest - b.rest);
      // A ring is drawn scaled, so its stroke widens with it.
      const drawnW = (line: (typeof lines)[number]) => (line.form ? line.w : (line.w * line.r) / list[line.i].r);
      // Clear black space between neighbours, measured between the edges of their strokes.
      for (let k = 1; k < lines.length; k++) {
        const [a, b] = [lines[k - 1], lines[k]];
        const least = a.r + drawnW(a) / 2 + (a.form && b.form ? RING_CLEAR : RING_CLEAR_WIDE);
        // Solve r − (w·r/r₀)/2 ≥ least for a ring (its stroke grows with r); a form's stroke does not.
        const need = b.form ? least + b.w / 2 : least / (1 - b.w / (2 * list[b.i].r));
        b.r = Math.max(b.r, need);
      }
      for (const line of lines) {
        if (line.form) {
          const el = refs.current[line.form];
          if (el && Math.abs(Number(el.getAttribute('r')) - line.r) > 1e-4) el.setAttribute('r', line.r.toFixed(4));
          continue;
        }
        const o = list[line.i];
        const el = ringEls.current[line.i];
        if (!el) continue;
        const stroke = el.firstElementChild as SVGElement | null;
        const { wave, energy } = want[line.i];
        if (!live && Math.abs(line.r - o.r) < 1e-4) el.removeAttribute('transform');
        else el.setAttribute('transform', `scale(${(line.r / o.r).toFixed(5)})`);
        stroke?.setAttribute('stroke-opacity', live ? Math.min(1, o.opacity * (1 + 0.8 * energy)).toFixed(3) : String(o.opacity));
        stroke?.setAttribute('stroke-width', live ? (o.width * (1 + 0.7 * energy)).toFixed(3) : String(o.width));
        el.setAttribute('data-wave', wave.toFixed(4));
      }
    };

    const apply = (t: number | null) => {
      const overlap = overlapState(t === null || !animator ? null : (ch) => animator.presence(t, ch), sp, colorsRef.current, !darkRef.current);
      for (const ch of CHANNELS) {
        const el = refs.current[ch];
        if (!el) continue;
        const ring = ringsRef.current[ch];
        const p = parts[ch];
        const r0 = sp[ch].x;
        const s = t === null || !animator ? null : animator.sample(t, ch);
        const rest = !s || (s.swell === 0 && s.energy === 0);
        const m = MOTION[ch];
        const swell = rest ? 0 : s!.swell;
        const energy = rest ? 0 : s!.energy;

        el.setAttribute('data-r0', String(r0));
        if (darkRef.current) {
          // Dark Mode: the sounding form grows by a clearly visible amount whatever its size,
          // and follows its sound as it rings out, so it eases back to its own size.
          // √ lifts soft hits (a quiet Hi-hat), so every instrument shows clearly; full hits stay at 1.
          const raw = rest && !(t !== null && animator) ? 0 : Math.max(Math.max(0, swell), animator && t !== null ? animator.presence(t, ch) : 0);
          const act = raw < 0.002 ? 0 : Math.min(1.1, Math.sqrt(raw));
          el.setAttribute('r', act === 0 ? String(r0) : capRadius(r0 + act * Math.max(r0 * DARK_HIT.share, DARK_HIT.min)).toFixed(4));
          el.setAttribute('stroke-width', act === 0 ? String(DARK_FORM_STROKE) : (DARK_FORM_STROKE * (1 + DARK_HIT.stroke * act)).toFixed(3));
          el.setAttribute('data-hit', act.toFixed(4));
        } else {
          el.setAttribute('r', rest ? String(r0) : capRadius(r0 * (1 + m.growth * swell)).toFixed(4));
        }
        el.setAttribute('transform', transformOf(ring));
        el.setAttribute('fill-opacity', rest ? String(ring.opacity) : Math.min(1, ring.opacity + m.fade * energy).toFixed(3));

        // Inner colors spread toward the rim with the hit.
        // The same stops as drawn (Dark Mode's contour adds one on some forms), so each offset lands on its own stop.
        const stops = stopOffsets(ch, orderRef.current[0] === ch, darkRef.current);
        stops.forEach(([off], i) => {
          const last = i === stops.length - 1;
          const o = rest || i === 0 || last ? off : Math.min(0.97, off + m.bloom * energy * (1 - off));
          p.stops[i]?.setAttribute('offset', rest ? String(off) : o.toFixed(4));
        });
        const glow = glowOf(ch, orderRef.current[0] === ch, darkRef.current);
        const haloA = Math.min(1, glow.alpha + m.halo * energy);
        p.haloA?.setAttribute('slope', rest ? String(glow.alpha) : haloA.toFixed(3));
        p.halo?.setAttribute('stdDeviation', (r0 * glow.spread * (1 + 0.6 * energy)).toFixed(3));
        p.edge?.setAttribute('stdDeviation', (r0 * EDGE[ch]).toFixed(3));
        el.setAttribute('data-glow', rest ? String(glow.alpha) : haloA.toFixed(3));

        // Where this form overlaps other forms that are sounding with it.
        const o = overlap[ch];
        const quiet = o.intensity === 0 && o.mix === 0;
        const sat = BASE_SAT * (1 + 0.45 * o.intensity + 0.15 * o.mix);
        const lum = 1 + 0.07 * o.intensity;
        p.sat?.setAttribute('values', quiet ? String(BASE_SAT) : sat.toFixed(4));
        p.lum.forEach((fn) => fn.setAttribute('slope', quiet ? '1' : lum.toFixed(4)));
        p.tint?.setAttribute('flood-color', o.tintColor);
        p.tint?.setAttribute('flood-opacity', quiet ? '0' : o.tintOpacity.toFixed(4));
        if (o.intensity > 0) p.haloA?.setAttribute('slope', Math.min(1, haloA + 0.12 * o.intensity).toFixed(3));
        el.setAttribute('data-intensity', quiet ? '0' : o.intensity.toFixed(4));
        el.setAttribute('data-mix', quiet ? '0' : o.mix.toFixed(4));
      }
      applyOutlines(t);
      const next = drawOrder(Object.fromEntries(CHANNELS.map((ch) => [ch, sp[ch].x])) as Record<Channel, number>);
      if (next.join() !== orderRef.current.join()) setOrder(next);
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const moving = advance(dt);
      const t = animator?.now() ?? audibleTime();
      const sounding = !!animator && t !== null && (animator.isActive(t) || transport.isPlaying());
      if (moving || sounding) {
        apply(t);
        raf = requestAnimationFrame(frame);
      } else {
        apply(null); // exact rest shape
        running = false;
      }
    };

    const wake = () => {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    wakeRef.current = wake;

    const off = animator?.onWake(wake);
    wake(); // events may already be queued when this graphic mounts
    return () => {
      off?.();
      cancelAnimationFrame(raf);
      wakeRef.current = () => {};
      for (const ch of CHANNELS) {
        sp[ch].x = ringsRef.current[ch].r;
        sp[ch].v = 0;
      }
      apply(null); // leave the static rest shape behind
    };
  }, [animator]);

  // A pattern edit, a new step count or a restored artwork: glide to the new sizes.
  useEffect(() => wakeRef.current(), [rings]);

  const outerFormR = byZone[order[0]].r;
  const formEl = (zone: Channel) => {
    const ring = byZone[zone];
    const r0 = springs.current![zone].x;
    return (
      <g key={zone} className="form-drift">
        <g className="form-breathe">
          <circle
            ref={(el) => {
              refs.current[zone] = el;
            }}
            data-zone={zone}
            data-color={colors[zone]}
            data-r0={r0}
            data-target={ring.r}
            data-glow={glowOf(zone, order[0] === zone, dark).alpha}
            cx={0}
            cy={0}
            r={r0}
            transform={transformOf(ring)}
            // Dark Mode: no filled surface, only the form's glowing outline (rings fill the inside).
            fill={dark ? 'none' : `url(#${idOf('g', zone)})`}
            stroke={dark ? gradientFor(colors[zone]).base : undefined}
            strokeWidth={dark ? DARK_FORM_STROKE : undefined}
            fillOpacity={ring.opacity}
            // Dark Mode's light comes from the shared neon filters around the lines.
            filter={dark ? undefined : `url(#${idOf('f', zone)})`}
          />
        </g>
      </g>
    );
  };
  // Dark Mode only: thin concentric outlines over and around the forms (presets/outlineRings.ts).
  const ringEl = (o: (typeof outlines)[number], i: number) => (
    <g
      key={`ring-${i}`}
      className="outline-ring"
      data-zone={o.zone}
      ref={(el) => {
        ringEls.current[i] = el;
      }}
    >
      <circle cx={0} cy={0} r={o.r} fill="none" stroke={gradientFor(colors[o.zone])[o.tone]} strokeWidth={o.width} strokeOpacity={o.opacity} />
    </g>
  );

  return (
    <div className={`art-box${className ? ` ${className}` : ''}`} role="img" aria-label={label}>
    <svg
      className={`art${idle ? ' art--idle' : ''}${idle && paused ? ' art--paused' : ''}${animator && !paused ? ' art--live' : ''}`}
      viewBox={`${-INK} ${-INK} ${INK * 2} ${INK * 2}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {CHANNELS.map((ch) => {
          const ring = byZone[ch];
          const g = gradientFor(colors[ch]);
          const r0 = springs.current![ch].x;
          const glow = glowOf(ch, order[0] === ch, theme === 'dark');
          return (
            <g key={ch}>
              <radialGradient id={idOf('g', ch)} cx="0.5" cy="0.5" r="0.5" fx={0.5 + (ring.coreX - 0.5) * CORE_PULL} fy={0.5 + (ring.coreY - 0.5) * CORE_PULL}>
                {stopColors(ch, order[0] === ch, g, theme === 'dark').map(([off, color, op], i) => (
                  <stop key={i} offset={off} stopColor={color} stopOpacity={op} />
                ))}
              </radialGradient>
              <filter id={idOf('f', ch)} {...(theme === 'dark' && order[0] === ch ? FILTER_REGION_NEON : FILTER_REGION)[ch]} colorInterpolationFilters="sRGB">
                <feGaussianBlur data-part="halo" in="SourceGraphic" stdDeviation={r0 * glow.spread} result="halo" />
                <feComponentTransfer in="halo" result="haloSoft">
                  <feFuncA type="linear" slope={glow.alpha} />
                </feComponentTransfer>
                <feGaussianBlur data-part="edge" in="SourceGraphic" stdDeviation={r0 * EDGE[ch]} result="body" />
                {/* Overlap response; neutral at rest (see overlapState). */}
                <feColorMatrix data-part="sat" in="body" type="saturate" values={String(BASE_SAT)} result="bodySat" />
                <feComponentTransfer in="bodySat" result="bodyPastel">
                  <feFuncR type="linear" slope={PASTEL.slope} intercept={PASTEL.lift} />
                  <feFuncG type="linear" slope={PASTEL.slope} intercept={PASTEL.lift} />
                  <feFuncB type="linear" slope={PASTEL.slope} intercept={PASTEL.lift} />
                </feComponentTransfer>
                <feComponentTransfer data-part="lum" in="bodyPastel" result="bodyLum">
                  <feFuncR type="linear" slope="1" />
                  <feFuncG type="linear" slope="1" />
                  <feFuncB type="linear" slope="1" />
                </feComponentTransfer>
                <feFlood data-part="tint" floodColor="#000000" floodOpacity="0" result="tint" />
                <feComposite in="tint" in2="bodyLum" operator="in" result="tintIn" />
                <feMerge>
                  <feMergeNode in="haloSoft" />
                  <feMergeNode in="bodyLum" />
                  <feMergeNode in="tintIn" />
                </feMerge>
              </filter>
            </g>
          );
        })}
        {dark && (
          <>
            {/* Dark Mode neon, in the lines' own colors, with the crisp strokes on top so the structure stays sharp:
                every line gets a tight bloom and a close glow; the outer lines also a wide diffuse light that
                fades gradually into the black (see NEON_GLOW). */}
            <filter id={`neon-${uid}`} x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
              <feGaussianBlur in="SourceGraphic" stdDeviation={NEON_GLOW.near} result="near" />
              <feGaussianBlur in="SourceGraphic" stdDeviation={NEON_GLOW.mid} result="midBlur" />
              <feComponentTransfer in="midBlur" result="mid">
                <feFuncA data-part="neon-mid" type="linear" slope={NEON_GLOW.midAlpha} />
              </feComponentTransfer>
              <feMerge>
                <feMergeNode in="mid" />
                <feMergeNode in="near" />
                <feMergeNode in="near" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id={`aura-${uid}`} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
              <feGaussianBlur in="SourceGraphic" stdDeviation={NEON_GLOW.near} result="near" />
              <feGaussianBlur in="SourceGraphic" stdDeviation={NEON_GLOW.mid} result="midBlur" />
              <feComponentTransfer in="midBlur" result="mid">
                <feFuncA data-part="neon-mid" type="linear" slope={NEON_GLOW.midAlpha} />
              </feComponentTransfer>
              <feGaussianBlur in="SourceGraphic" stdDeviation={NEON_GLOW.wide} result="wideBlur" />
              <feComponentTransfer in="wideBlur" result="wide">
                <feFuncA data-part="neon-wide" type="linear" slope={NEON_GLOW.wideAlpha} />
              </feComponentTransfer>
              <feGaussianBlur in="SourceGraphic" stdDeviation={NEON_GLOW.far} result="farBlur" />
              <feComponentTransfer in="farBlur" result="far">
                <feFuncA data-part="neon-far" type="linear" slope={NEON_GLOW.farAlpha} />
              </feComponentTransfer>
              <feMerge>
                <feMergeNode in="far" />
                <feMergeNode in="wide" />
                <feMergeNode in="mid" />
                <feMergeNode in="near" />
                <feMergeNode in="near" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </>
        )}
      </defs>
      {dark ? (
        <>
          {/* Inner lines: crisp neon with a close glow, so the inside stays dark and open. */}
          <g className="neon" filter={`url(#neon-${uid})`}>
            {order.slice(1).map(formEl)}
            {outlines.map((o, i) => (o.r < outerFormR ? ringEl(o, i) : null))}
          </g>
          {/* The outermost line and the rings beyond it also send a wide, soft light out into the black. */}
          <g className="neon-aura" filter={`url(#aura-${uid})`}>
            {formEl(order[0])}
            {outlines.map((o, i) => (o.r >= outerFormR ? ringEl(o, i) : null))}
          </g>
        </>
      ) : (
        order.map(formEl)
      )}
    </svg>
    </div>
  );
}
