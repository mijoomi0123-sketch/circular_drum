import { channelOf } from '../audio/channels';
import type { Channel, ScheduledEvent } from '../types';
import { envelopeLength, hitEnvelope, softLimit } from './envelope';
import { MOTION, tempoScale } from './visualEvents';

/** Fade used when playback is stopped while circles are still swollen. */
const RELEASE_S = 0.14;
const SATURATION = 1.25;

interface Impulse {
  e: ScheduledEvent;
  channel: Channel;
  decay: number;
  /** Set when playback was stopped: contribution fades out from here. */
  cutAt: number | null;
  end: number;
}

export interface CircleState {
  /** Radial swell, ≈ −0.15 … 1.25 (negative = spring dipping below rest). */
  swell: number;
  /** Brightness / opacity energy, 0 … 1. */
  energy: number;
}

const REST: CircleState = { swell: 0, energy: 0 };

/**
 * Holds the sound events scheduled on the AudioContext timeline and turns
 * them into the state of each instrument circle at any audio time.
 *
 * - A circle only responds to events of its own instrument channel.
 * - Strength comes from the instrument's character and its fixed hit level,
 *   never from a volume control.
 * - Overlapping hits add up and are softly limited, so a new hit blends
 *   into a swell in progress instead of restarting it.
 * - With no events it returns rest everywhere; it never animates on its own.
 */
export class DropletAnimator {
  private impulses: Impulse[] = [];
  private wakeListeners = new Set<() => void>();
  private bpm = 120;

  /** Timeline the events are placed on; null means the heard audio time (animation/clock.ts). */
  now(): number | null {
    return null;
  }

  /** Tempo used to shape new hits (faster tempo → quicker return). */
  setTempo(bpm: number) {
    this.bpm = bpm;
  }

  push(e: ScheduledEvent) {
    const channel = channelOf(e.instrument);
    const m = MOTION[channel];
    const decay = m.decay * tempoScale(this.bpm);
    // Kept until both the motion has settled and the sound itself has died away.
    const sound = e.envelope ? e.envelope.level.length * e.envelope.hop : 0;
    const end = e.time + Math.max(envelopeLength(m.attack, decay), sound);
    this.impulses.push({ e, channel, decay, cutAt: null, end });
    this.wakeListeners.forEach((fn) => fn());
  }

  /**
   * Playback stopped at `now`: events that have not sounded yet are dropped,
   * and swells already in progress glide back to rest instead of snapping.
   */
  stop(now: number) {
    this.impulses = this.impulses.filter((i) => i.e.time <= now);
    for (const i of this.impulses) {
      if (i.cutAt === null) {
        i.cutAt = now;
        i.end = Math.min(i.end, now + RELEASE_S * 8);
      }
    }
  }

  clear() {
    this.impulses = [];
  }

  onWake(fn: () => void): () => void {
    this.wakeListeners.add(fn);
    return () => this.wakeListeners.delete(fn);
  }

  /** True while anything is pending or still moving at audio time `t`. */
  isActive(t: number): boolean {
    this.impulses = this.impulses.filter((i) => i.end > t);
    return this.impulses.length > 0;
  }

  /** State of one instrument's circle at audio time t. */
  sample(t: number, channel: Channel): CircleState {
    const m = MOTION[channel];
    let swell = 0;
    let energy = 0;
    let any = false;
    for (const { e, channel: ch, decay, cutAt } of this.impulses) {
      if (ch !== channel) continue;
      const tau = t - e.time;
      if (tau <= 0) continue;
      any = true;
      let v = hitEnvelope(tau, m.attack, decay, m.spring);
      if (cutAt !== null && t > cutAt) {
        const u = (t - cutAt) / RELEASE_S;
        v *= (1 + u) * Math.exp(-u);
      }
      swell += v * e.velocity;
      energy += Math.max(0, v) * e.velocity;
    }
    if (!any) return REST;
    return { swell: softLimit(swell, SATURATION), energy: Math.min(1, energy) };
  }

  /**
   * How strongly an instrument is sounding at audio time t, 0–1, from the
   * actual loudness of its samples (their envelopes): rises with the hit,
   * follows the sound as it rings out, and fades quickly if playback is
   * stopped. Several hits of one instrument count by the loudest.
   */
  presence(t: number, channel: Channel): number {
    let p = 0;
    for (const { e, channel: ch, cutAt } of this.impulses) {
      if (ch !== channel || !e.envelope) continue;
      const tau = t - e.time;
      if (tau < 0) continue;
      const { hop, level } = e.envelope;
      const x = tau / hop;
      const i = Math.floor(x);
      if (i >= level.length) continue;
      const a = level[i];
      const b = i + 1 < level.length ? level[i + 1] : 0;
      let v = a + (b - a) * (x - i);
      if (cutAt !== null && t > cutAt) v *= Math.exp(-(t - cutAt) / (RELEASE_S / 3));
      p = Math.max(p, v);
    }
    return p;
  }
}
