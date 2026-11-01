import { CHANNEL_VELOCITY } from '../audio/channels';
import { audioEngine } from '../audio/engine';
import { CHANNELS } from '../audio/channels';
import type { Channel, ChannelColors, ChannelPatterns, Instrument } from '../types';
import { DropletAnimator } from './droplet';

/** How far ahead hits are placed, and how often the schedule is topped up. */
const LOOKAHEAD_S = 0.25;
const TICK_MS = 60;

const INSTRUMENT: Readonly<Record<Channel, Instrument>> = { kick: 'kick', snare: 'snare', hihat: 'hihat', clap: 'clap' };

export interface RhythmSource {
  patterns: ChannelPatterns;
  steps: number;
  bpm: number;
  colors: ChannelColors;
  /** The sound groups the circle plays (a Fullscreen sound override), if not its own colors. */
  sounds?: ChannelColors;
}

/**
 * The library's silent motion: an artwork's own pattern played on a visual
 * clock, so every form moves exactly as it does in the editor (same steps,
 * same tempo, same per-instrument motion) without any sound. Each hit carries
 * the loudness envelope of the very sample real playback would play, so the
 * hit growth, rings, glow and overlap mixing are the same as when it sounds.
 */
export class SilentRhythm extends DropletAnimator {
  private timer = 0;
  private nextTime = 0;
  private step = 0;

  constructor(private source: RhythmSource) {
    super();
    this.setTempo(source.bpm);
  }

  override now(): number {
    return performance.now() / 1000;
  }

  get running(): boolean {
    return this.timer !== 0;
  }

  start() {
    if (this.timer) return;
    this.nextTime = this.now() + 0.05;
    this.step = 0;
    this.schedule();
    this.timer = window.setInterval(() => this.schedule(), TICK_MS);
  }

  /** Freezes the rhythm; forms glide back to rest. */
  halt() {
    window.clearInterval(this.timer);
    this.timer = 0;
    this.stop(this.now());
  }

  private schedule() {
    const { patterns, steps, bpm, colors } = this.source;
    const sounds = this.source.sounds ?? colors;
    const stepDur = 60 / bpm / 4; // one step is a sixteenth note
    const now = this.now();
    // A hidden tab pauses timers: skip ahead instead of firing a burst of old hits.
    if (this.nextTime < now - 0.5) this.nextTime = now + 0.05;
    while (this.nextTime < now + LOOKAHEAD_S) {
      for (const ch of CHANNELS) {
        if (!patterns[ch][this.step]) continue;
        // Same event as real playback (transport.scheduleStep), minus the sound itself.
        const info = audioEngine.sampleFor(ch, sounds[ch]);
        this.push({
          time: this.nextTime,
          step: this.step,
          instrument: info?.instrument ?? INSTRUMENT[ch],
          sample: info?.file ?? '',
          color: colors[ch],
          velocity: CHANNEL_VELOCITY[ch],
          envelope: info ? audioEngine.envelopeOf(info.file) : undefined,
        });
      }
      this.step = (this.step + 1) % steps;
      this.nextTime += stepDur;
    }
  }
}
