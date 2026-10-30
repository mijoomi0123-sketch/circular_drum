import { describe, expect, it } from 'vitest';
import { DropletAnimator } from '../animation/droplet';
import { CHANNELS, channelOf } from '../audio/channels';
import { SAMPLE_MAP } from '../audio/sampleMap';
import { buildRings } from '../presets/designs';
import { circleSizes } from '../presets/sizing';
import { emptyPatterns } from '../audio/pattern';
import { COLORS } from '../presets/colors';
import type { Channel, Instrument, ScheduledEvent } from '../types';

const ev = (instrument: Instrument, time: number): ScheduledEvent => ({
  time,
  step: 0,
  instrument,
  sample: 'x.wav',
  color: 'orange',
  velocity: 1,
});

const peak = (a: DropletAnimator, ch: Channel) => {
  let m = 0;
  for (let t = 0; t < 1; t += 0.002) m = Math.max(m, Math.abs(a.sample(t, ch).swell));
  return m;
};

describe('instrument channels', () => {
  it('routes every color’s four samples to four different channels', () => {
    for (const c of COLORS) {
      const used = Object.keys(SAMPLE_MAP.byColor[c.id]).map((i) => channelOf(i as Instrument));
      expect(new Set(used).size, c.id).toBe(4);
    }
  });

  it('every artwork is exactly four circles, one per instrument', () => {
    const sizes = circleSizes(emptyPatterns(), 16);
    for (const seed of [1, 1103, 4409, 9907, 123456]) {
      const rings = buildRings({ seed, scale: 1, rhythm: 'pulse' }, sizes);
      expect(rings).toHaveLength(4);
      expect(rings.map((r) => r.zone).sort()).toEqual([...CHANNELS].sort());
    }
  });

  it('circles keep their size order, larger drawn first, for any seed', () => {
    const sizes = circleSizes(emptyPatterns(), 16);
    for (const seed of [1, 1103, 4409, 9907, 123456]) {
      const rings = buildRings({ seed, scale: 1, rhythm: 'pulse' }, sizes);
      expect(rings.map((r) => r.zone)).toEqual(['kick', 'snare', 'hihat', 'clap']);
      expect(rings[0].r).toBeLessThan(100);
    }
  });
});

describe('per-instrument animation', () => {
  it('each instrument moves only its own circle', () => {
    for (const inst of ['kick', 'snare', 'hihat', 'clap'] as Instrument[]) {
      const a = new DropletAnimator();
      a.push(ev(inst, 0.1));
      for (const ch of CHANNELS) {
        if (ch === inst) expect(peak(a, ch), ch).toBeGreaterThan(0.5);
        else expect(peak(a, ch), `${inst} → ${ch}`).toBe(0);
      }
    }
  });

  it('a cymbal moves the clap circle (it is the fourth sample)', () => {
    const a = new DropletAnimator();
    a.push(ev('cymbal', 0.1));
    expect(peak(a, 'clap')).toBeGreaterThan(0.5);
    expect(peak(a, 'kick')).toBe(0);
  });

  it('simultaneous hits move their circles together', () => {
    const a = new DropletAnimator();
    a.push(ev('kick', 0.1));
    a.push(ev('snare', 0.1));
    expect(a.sample(0.15, 'kick').swell).toBeGreaterThan(0.3);
    expect(a.sample(0.15, 'snare').swell).toBeGreaterThan(0.3);
    expect(a.sample(0.15, 'hihat').swell).toBe(0);
  });

  it('kick springs back slightly below rest; snare does not', () => {
    const a = new DropletAnimator();
    a.push(ev('kick', 0));
    a.push(ev('snare', 0));
    let kMin = 0;
    let sMin = 0;
    for (let t = 0; t < 2; t += 0.002) {
      kMin = Math.min(kMin, a.sample(t, 'kick').swell);
      sMin = Math.min(sMin, a.sample(t, 'snare').swell);
    }
    expect(kMin).toBeLessThan(-0.05);
    expect(kMin).toBeGreaterThan(-0.2);
    expect(sMin).toBe(0);
  });

  it('overlapping hits add smoothly instead of restarting', () => {
    const a = new DropletAnimator();
    a.push(ev('kick', 0.1));
    a.push(ev('kick', 0.18));
    let prev = a.sample(0.1, 'kick').swell;
    for (let t = 0.1; t < 0.8; t += 0.002) {
      const v = a.sample(t, 'kick').swell;
      expect(Math.abs(v - prev)).toBeLessThan(0.06);
      prev = v;
    }
  });

  it('rests completely when nothing plays', () => {
    const a = new DropletAnimator();
    expect(a.sample(5, 'kick')).toEqual({ swell: 0, energy: 0 });
    a.push(ev('kick', 0));
    expect(a.isActive(10)).toBe(false);
  });
});
