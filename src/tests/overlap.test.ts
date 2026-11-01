import { describe, expect, it } from 'vitest';
import { DropletAnimator } from '../animation/droplet';
import { overlapState } from '../animation/overlap';
import { gradientFor } from '../presets/gradients';
import type { Channel, ChannelColors, Instrument, ScheduledEvent } from '../types';

const sizes = { kick: { x: 70 }, snare: { x: 60 }, hihat: { x: 50 }, clap: { x: 40 } };
const all = (c: ChannelColors[Channel]): ChannelColors => ({ kick: c, snare: c, hihat: c, clap: c });
const on =
  (...chs: Channel[]) =>
  (ch: Channel) =>
    chs.includes(ch) ? 1 : 0;

describe('overlap color response', () => {
  it('one sounding form alone stays exactly as it is', () => {
    const o = overlapState(on('snare'), sizes, all('yellow'));
    for (const ch of ['kick', 'snare', 'hihat', 'clap'] as Channel[]) expect(o[ch]).toEqual({ intensity: 0, mix: 0, tintColor: '#000000', tintOpacity: 0 });
  });

  it('two same-color forms intensify the shared region (the smaller form), 3 and 4 progressively more, within limits', () => {
    const two = overlapState(on('kick', 'snare'), sizes, all('blue'));
    expect(two.snare.intensity).toBeGreaterThan(0.5);
    expect(two.kick.intensity).toBe(0); // the larger form's own area is not the shared region
    const three = overlapState(on('kick', 'snare', 'clap'), sizes, all('blue'));
    const four = overlapState(on('kick', 'snare', 'hihat', 'clap'), sizes, all('blue'));
    expect(three.clap.intensity).toBeGreaterThan(two.snare.intensity);
    expect(four.clap.intensity).toBeGreaterThan(three.clap.intensity);
    expect(four.clap.intensity).toBeLessThan(1.5);
    expect(four.clap.tintOpacity).toBeLessThanOrEqual(0.6);
    expect(four.clap.mix).toBe(0);
  });

  it('different colors blend instead; mixed with same colors, both apply', () => {
    const colors: ChannelColors = { kick: 'yellow', snare: 'blue', hihat: 'yellow', clap: 'yellow' };
    const d = overlapState(on('kick', 'snare'), sizes, colors);
    expect(d.snare.mix).toBeGreaterThan(0);
    expect(d.snare.intensity).toBe(0);
    expect(d.snare.tintColor).toBe(gradientFor('yellow').base.toLowerCase()); // yellow's base tone blends into the blue
    const both = overlapState(on('kick', 'snare', 'clap'), sizes, colors);
    expect(both.clap.intensity).toBeGreaterThan(0); // yellow kick over yellow clap
    expect(both.clap.mix).toBeGreaterThan(0); // blue snare over yellow clap
  });

  it('weaker sounds contribute less', () => {
    const loud = overlapState(on('kick', 'snare'), sizes, all('pink'));
    const soft = overlapState((ch) => (ch === 'kick' ? 0.3 : ch === 'snare' ? 1 : 0), sizes, all('pink'));
    expect(soft.snare.intensity).toBeLessThan(loud.snare.intensity);
  });
});

describe('presence follows the real sound', () => {
  const ev = (instrument: Instrument, time: number, level: number[]): ScheduledEvent => ({
    time,
    step: 0,
    instrument,
    sample: 'x.wav',
    color: 'blue',
    velocity: 1,
    envelope: { hop: 0.01, level: Float32Array.from(level) },
  });

  it('rises with the hit, follows the envelope, and is gone when the sound ends', () => {
    const a = new DropletAnimator();
    a.push(ev('kick', 1, [1, 0.8, 0.5, 0.2]));
    expect(a.presence(0.99, 'kick')).toBe(0);
    expect(a.presence(1.0, 'kick')).toBeCloseTo(1);
    expect(a.presence(1.005, 'kick')).toBeCloseTo(0.9);
    expect(a.presence(1.035, 'kick')).toBeCloseTo(0.1); // fading toward the end
    expect(a.presence(1.05, 'kick')).toBe(0);
    expect(a.presence(1.0, 'snare')).toBe(0);
    expect(a.isActive(1.035)).toBe(true);
  });

  it('a stop fades it quickly', () => {
    const a = new DropletAnimator();
    a.push(ev('snare', 0, Array(200).fill(1)));
    a.stop(0.5);
    expect(a.presence(0.5, 'snare')).toBeCloseTo(1);
    expect(a.presence(0.65, 'snare')).toBeLessThan(0.05);
  });
});
