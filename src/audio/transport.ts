import type { Channel, ChannelColors, ChannelPatterns, Instrument, ScheduledEvent } from '../types';
import { CHANNEL_VELOCITY, channelOf } from './channels';
import { audioEngine } from './engine';
import { buildPattern, clampBpm, clampSteps, stepDuration } from './pattern';

export interface PlaySettings {
  /** Each instrument's color, which also picks its sample group. */
  colors: ChannelColors;
  /** One tempo for all four instruments. */
  bpm: number;
  steps: number;
  loop: boolean;
  /** The four independent step rows. */
  patterns: ChannelPatterns;
}

/** A step boundary on the audio clock, used by the playhead. */
export interface StepMark {
  time: number;
  step: number;
}

export type PlayMode = 'edit' | 'preview';

export interface TransportState {
  playing: boolean;
  /** Artwork id that currently owns playback. */
  owner: string | null;
  mode: PlayMode | null;
}

interface Voice {
  src: AudioBufferSourceNode;
  gain: GainNode;
  start: number;
}

type EventListener = (e: ScheduledEvent) => void;
type StopListener = (hard: boolean) => void;

/** How often the scheduler wakes up, and how far ahead it schedules. */
const TICK_MS = 25;
const LOOKAHEAD_S = 0.12;
/** Background tabs throttle timers to ~1 s, so schedule further ahead there. */
const HIDDEN_LOOKAHEAD_S = 1.6;
const MAX_VOICES_PER_INSTRUMENT = 4;
/** Small delay before the first step so the first hit is never late. */
const START_DELAY_S = 0.06;

/**
 * Lookahead scheduler. A timer wakes every 25 ms and schedules every step
 * whose time falls within the next 120 ms on the AudioContext clock. Each
 * scheduled sound is also published as a ScheduledEvent carrying the same
 * AudioContext time, which the animation uses as its trigger, so sound and
 * picture share one timeline and cannot drift apart.
 */
export class Transport {
  private settings: PlaySettings | null = null;
  private pattern: Channel[][] = [];
  private stepMarks: StepMark[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextStepTime = 0;
  private stepIndex = 0;
  private cyclesLeft = Infinity;
  private endTime: number | null = null;
  private voices = new Map<Instrument, Voice[]>();
  private generation = 0;
  private eventListeners = new Set<EventListener>();
  private stopListeners = new Set<StopListener>();
  private stateListeners = new Set<() => void>();
  private snapshot: TransportState = { playing: false, owner: null, mode: null };
  /** While playing: on a theme switch, the old set's ringing sounds fade out and the next hits use the new set. */
  private offTheme: (() => void) | null = null;

  /** Running counters, exposed for debugging and automated tests. */
  readonly debug = { scheduled: 0, recent: [] as ScheduledEvent[] };

  getState = (): TransportState => this.snapshot;

  subscribe = (fn: () => void): (() => void) => {
    this.stateListeners.add(fn);
    return () => this.stateListeners.delete(fn);
  };

  onEvent(fn: EventListener): () => void {
    this.eventListeners.add(fn);
    return () => this.eventListeners.delete(fn);
  }

  onStop(fn: StopListener): () => void {
    this.stopListeners.add(fn);
    return () => this.stopListeners.delete(fn);
  }

  private setState(next: TransportState) {
    this.snapshot = next;
    this.stateListeners.forEach((fn) => fn());
  }

  isPlaying(owner?: string): boolean {
    return this.snapshot.playing && (owner === undefined || this.snapshot.owner === owner);
  }

  /**
   * Start playback. `cycles` limits how many passes of the pattern play
   * (ignored while `settings.loop` is true in edit mode).
   */
  async start(owner: string, mode: PlayMode, settings: PlaySettings, cycles = 1): Promise<void> {
    this.stop();
    const gen = ++this.generation;
    const ctx = await audioEngine.ensureRunning();
    await audioEngine.loadChannels(settings.colors);
    if (gen !== this.generation) return; // stopped or restarted while loading

    this.settings = { ...settings, bpm: clampBpm(settings.bpm), steps: clampSteps(settings.steps) };
    this.pattern = buildPattern(this.settings.patterns, this.settings.steps);
    this.stepMarks = [];
    this.stepIndex = 0;
    this.cyclesLeft = mode === 'edit' && settings.loop ? Infinity : Math.max(1, cycles);
    this.endTime = null;
    this.nextStepTime = ctx.currentTime + START_DELAY_S;

    this.offTheme ??= audioEngine.onSoundTheme(() => this.releaseVoices());
    this.setState({ playing: true, owner, mode });
    this.tick();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  /** Apply new settings while playing without restarting the rhythm. */
  update(patch: Partial<PlaySettings>) {
    if (!this.settings) return;
    const prev = this.settings;
    const next: PlaySettings = { ...prev, ...patch };
    next.bpm = clampBpm(next.bpm);
    next.steps = clampSteps(next.steps);
    this.settings = next;
    if (next.steps !== prev.steps || next.patterns !== prev.patterns) {
      // Same clock and position; only which channels sound on each step
      // changes. A step already scheduled (≤120 ms ahead) keeps its sound.
      // If the cycle got shorter than where we are, the scheduler starts the
      // next cycle at step 0 on its next step.
      this.pattern = buildPattern(next.patterns, next.steps);
    }
    if (patch.loop !== undefined && this.snapshot.mode === 'edit') {
      this.cyclesLeft = next.loop ? Infinity : 1; // loop off: finish the current cycle
      if (next.loop) this.endTime = null;
    }
    if (patch.colors) void audioEngine.loadChannels(patch.colors);
  }

  /**
   * The step being heard at audio time `t` (or null). Used by the playhead,
   * so it follows the exact same timeline as sound and animation.
   */
  stepAt(t: number): number | null {
    if (!this.snapshot.playing) return null;
    let found: number | null = null;
    for (const m of this.stepMarks) {
      if (m.time <= t) found = m.step;
      else break;
    }
    return found;
  }

  stop() {
    this.generation++;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.unwatchTheme();
    this.releaseVoices();
    this.stepMarks = [];
    this.settings = null;
    if (this.snapshot.playing) {
      this.stopListeners.forEach((fn) => fn(true));
      this.setState({ playing: false, owner: null, mode: null });
    }
  }

  private unwatchTheme() {
    this.offTheme?.();
    this.offTheme = null;
  }

  /**
   * Short fade on every voice so cut sounds do not click, then release
   * them. Voices scheduled for the future are cancelled the same way.
   */
  private releaseVoices() {
    const ctx = audioEngine.context;
    if (ctx) {
      const now = ctx.currentTime;
      this.voices.forEach((list) =>
        list.forEach((v) => {
          v.gain.gain.cancelScheduledValues(now);
          v.gain.gain.setValueAtTime(v.gain.gain.value, now);
          v.gain.gain.linearRampToValueAtTime(0, now + 0.04);
          try {
            v.src.stop(now + 0.05);
          } catch {
            /* already stopped */
          }
        }),
      );
    }
    this.voices.clear();
  }

  private finish() {
    // Natural end: let the last sounds ring out, no hard cut.
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.unwatchTheme();
    this.generation++;
    this.settings = null;
    this.stopListeners.forEach((fn) => fn(false));
    this.setState({ playing: false, owner: null, mode: null });
  }

  private tick() {
    const ctx = audioEngine.context;
    if (!ctx || !this.settings) return;
    if (this.endTime !== null) {
      if (ctx.currentTime >= this.endTime) this.finish();
      return;
    }
    const ahead = document.hidden ? HIDDEN_LOOKAHEAD_S : LOOKAHEAD_S;
    while (this.nextStepTime < ctx.currentTime + ahead) {
      const s = this.settings;
      if (this.stepIndex >= s.steps) {
        this.cyclesLeft -= 1;
        if (this.cyclesLeft <= 0) {
          this.endTime = this.nextStepTime;
          return;
        }
        this.stepIndex = 0;
      }
      this.scheduleStep(ctx, this.stepIndex, this.nextStepTime);
      // Timing comes from the current BPM, so BPM changes apply from the
      // next step on, measured on the audio clock (no cumulative drift).
      this.nextStepTime += stepDuration(s.bpm);
      this.stepIndex += 1;
    }
  }

  private scheduleStep(ctx: AudioContext, step: number, time: number) {
    const s = this.settings!;
    this.stepMarks.push({ time, step });
    if (this.stepMarks.length > 64) this.stepMarks.shift();
    for (const ch of this.pattern[step] ?? []) {
      // Each row plays the sample of its own color group; the Clap row takes
      // the group's cymbal where that group has no clap.
      const info = audioEngine.sampleFor(ch, s.colors[ch]);
      if (!info?.instrument) continue;
      const buffer = audioEngine.getBuffer(info.file);
      if (!buffer) continue; // still loading or missing (reported by the engine)
      const velocity = CHANNEL_VELOCITY[ch];
      this.playVoice(ctx, info.instrument, buffer, time, velocity);
      const event: ScheduledEvent = {
        time,
        step,
        instrument: info.instrument,
        sample: info.file,
        color: s.colors[ch],
        velocity,
        envelope: audioEngine.envelopeOf(info.file),
      };
      this.debug.scheduled += 1;
      this.debug.recent.push(event);
      if (this.debug.recent.length > 200) this.debug.recent.shift();
      this.eventListeners.forEach((fn) => fn(event));
    }
  }

  private playVoice(ctx: AudioContext, instrument: Instrument, buffer: AudioBuffer, time: number, velocity: number) {
    const channel = audioEngine.channel(channelOf(instrument));
    if (!channel) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = velocity;
    // voice → its instrument's channel gain → master
    src.connect(gain).connect(channel);
    src.start(time);

    const list = this.voices.get(instrument) ?? [];
    const voice: Voice = { src, gain, start: time };
    list.push(voice);
    // Keep long samples from piling up endlessly: fade the oldest voice of
    // the same instrument once too many overlap.
    while (list.length > MAX_VOICES_PER_INSTRUMENT) {
      const old = list.shift()!;
      old.gain.gain.setTargetAtTime(0, time, 0.03);
      try {
        old.src.stop(time + 0.25);
      } catch {
        /* already stopped */
      }
    }
    this.voices.set(instrument, list);
    src.onended = () => {
      const l = this.voices.get(instrument);
      if (l) {
        const i = l.indexOf(voice);
        if (i >= 0) l.splice(i, 1);
      }
      gain.disconnect();
    };
  }
}

export const transport = new Transport();

declare global {
  interface Window {
    __circularDrum?: { transport: Transport; engine: typeof audioEngine };
  }
}
if (typeof window !== 'undefined') window.__circularDrum = { transport, engine: audioEngine };
