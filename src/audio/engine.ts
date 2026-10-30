import type { Channel, ColorId, Instrument, SampleInfo, SoundEnvelope } from '../types';
import { CHANNELS } from './channels';
import { activeSoundTheme, sampleForSlot, sampleMapFor, type SoundTheme } from './sampleMap';
import { getSettings, subscribeSettings } from '../storage/settingsStore';

export type SampleState = 'loading' | 'ready' | 'missing';

export interface MissingSample {
  file: string;
  color: ColorId;
  instrument: Instrument;
  reason: string;
}

type Listener = () => void;

/**
 * Owns the AudioContext, the decoded sample buffers and the mixer:
 *
 *   sample voice → channel bus (Kick | Snare | Hi-hat | Clap) → master → output
 *
 * The buses run at fixed levels, so the balance between instruments never
 * changes. The only user control is the global volume, which scales the
 * master: 100 % is the original level (a little below 1 so stacked hits do
 * not clip) and 0 % is silence. Browsers only let the context run after a
 * user gesture (click, tap or key), so the first sound needs one.
 */
const ENVELOPE_HOP_S = 0.01;
const ENVELOPE_FLOOR_DB = 36;

/**
 * RMS loudness of a buffer in 10 ms steps, relative to its loudest step, on a
 * 36 dB scale (1 = loudest, 0 = 36 dB down or silence). Trailing silence is
 * dropped, so the envelope ends when the sound has actually died away.
 */
function measureEnvelope(buf: AudioBuffer): SoundEnvelope {
  const hop = Math.max(1, Math.round(buf.sampleRate * ENVELOPE_HOP_S));
  const n = Math.ceil(buf.length / hop);
  const rms = new Float32Array(n);
  const data = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c));
  let peak = 0;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (const d of data) {
      for (let j = i * hop; j < Math.min(d.length, (i + 1) * hop); j++) {
        sum += d[j] * d[j];
        count++;
      }
    }
    rms[i] = Math.sqrt(sum / Math.max(1, count));
    peak = Math.max(peak, rms[i]);
  }
  const level = new Float32Array(n);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const db = peak > 0 && rms[i] > 0 ? 20 * Math.log10(rms[i] / peak) : -Infinity;
    level[i] = Math.min(1, Math.max(0, (db + ENVELOPE_FLOOR_DB) / ENVELOPE_FLOOR_DB));
    if (level[i] > 0) last = i + 1;
  }
  return { hop: hop / buf.sampleRate, level: level.slice(0, last) };
}

/** Output level at 100 % global volume, leaving headroom when several samples overlap. */
const MASTER_GAIN = 0.8;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private channels = new Map<Channel, GainNode>();
  private buffers = new Map<string, AudioBuffer>();
  private pending = new Map<string, Promise<AudioBuffer | null>>();
  private state = new Map<string, SampleState>();
  private missingList: MissingSample[] = [];
  private listeners = new Set<Listener>();
  private envelopes = new Map<string, SoundEnvelope>();
  private volume = getSettings().volume;
  /** Every channel/color pair asked for so far, so a theme switch can load the other set's files for them. */
  private slots = new Map<string, [Channel, ColorId]>();
  private theme: SoundTheme = activeSoundTheme();
  private themeListeners = new Set<Listener>();

  constructor() {
    subscribeSettings(() => {
      this.setVolume(getSettings().volume);
      const theme = activeSoundTheme();
      if (theme === this.theme) return;
      this.theme = theme;
      // Sounds follow the theme from the next hit on: load the new set's files for what is in use, then tell players.
      if (this.ctx) void this.loadSlots([...this.slots.values()], theme, false);
      this.themeListeners.forEach((fn) => fn());
    });
  }

  /** Called when the theme (and so the sample set) changes. */
  onSoundTheme(fn: Listener): () => void {
    this.themeListeners.add(fn);
    return () => this.themeListeners.delete(fn);
  }

  /** Global volume 0–1, applied to everything through the master, with a short glide. */
  setVolume(v: number) {
    this.volume = Math.min(1, Math.max(0, v));
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(MASTER_GAIN * this.volume, now, 0.03);
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  get output(): GainNode | null {
    return this.master;
  }

  /** Create or resume the AudioContext. Call only from a user interaction. */
  async ensureRunning(): Promise<AudioContext> {
    unlockMobileAudio();
    const ctx = this.ensureContext();
    if (ctx.state !== 'running') {
      const resumed = ctx.resume();
      // Older iOS only starts output once a sound is started inside the tap itself.
      const tick = ctx.createBufferSource();
      tick.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      tick.connect(ctx.destination);
      tick.start(0);
      await resumed;
    }
    return ctx;
  }

  /** The AudioContext and mixer, created if needed but not resumed (decoding works while suspended). */
  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const Ctor: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain();
      this.master.gain.value = MASTER_GAIN * this.volume;
      this.master.connect(this.ctx.destination);
      for (const ch of CHANNELS) {
        const g = this.ctx.createGain();
        g.connect(this.master);
        this.channels.set(ch, g);
      }
    }
    return this.ctx;
  }

  /** Input node of an instrument channel (null before the first user gesture). */
  channel(ch: Channel): GainNode | null {
    return this.channels.get(ch) ?? null;
  }

  /** Seconds between "scheduled at currentTime" and actually heard. */
  outputLatency(): number {
    if (!this.ctx) return 0;
    const c = this.ctx as AudioContext & { outputLatency?: number };
    return (c.outputLatency || 0) + (c.baseLatency || 0);
  }

  samplesFor(color: ColorId): Partial<Record<Instrument, SampleInfo>> {
    return sampleMapFor().byColor[color];
  }

  getBuffer(file: string): AudioBuffer | undefined {
    return this.buffers.get(file);
  }

  /** Loudness over time of a decoded sample (computed once, then cached). */
  envelopeOf(file: string): SoundEnvelope | undefined {
    const hit = this.envelopes.get(file);
    if (hit) return hit;
    const buf = this.buffers.get(file);
    if (!buf) return undefined;
    const env = measureEnvelope(buf);
    this.envelopes.set(file, env);
    return env;
  }

  sampleState(file: string): SampleState | undefined {
    return this.state.get(file);
  }

  get missing(): readonly MissingSample[] {
    return this.missingList;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  /** The file a channel plays when set to `color` (color number + instrument number). */
  sampleFor(channel: Channel, color: ColorId): SampleInfo | undefined {
    return sampleForSlot(channel, color);
  }

  /**
   * Load the four samples picked by per-instrument colors, for the active
   * theme. The other theme's four follow quietly afterwards, so switching the
   * theme while playing needs no wait.
   */
  async loadChannels(colors: Record<Channel, ColorId>): Promise<void> {
    const pairs = CHANNELS.map((ch): [Channel, ColorId] => [ch, colors[ch]]);
    for (const [ch, c] of pairs) this.slots.set(`${ch}|${c}`, [ch, c]);
    const theme = activeSoundTheme();
    await this.loadSlots(pairs, theme);
    void this.loadSlots(pairs, theme === 'dark' ? 'light' : 'dark');
  }

  /**
   * Fetch and decode, ahead of time, the samples of every circle on screen
   * (active theme only), so a click plays at once even on a slow connection.
   * Needs no user gesture; nothing is played.
   */
  preload(colorSets: Record<Channel, ColorId>[]): Promise<void> {
    const pairs = colorSets.flatMap((colors) => CHANNELS.map((ch): [Channel, ColorId] => [ch, colors[ch]]));
    for (const [ch, c] of pairs) this.slots.set(`${ch}|${c}`, [ch, c]);
    return this.loadSlots(pairs, activeSoundTheme(), false);
  }

  private async loadSlots(pairs: [Channel, ColorId][], theme: SoundTheme, resume = true): Promise<void> {
    const ctx = resume ? await this.ensureRunning() : this.ensureContext();
    await Promise.all(
      pairs.map(([ch, color]) => {
        const s = sampleForSlot(ch, color, theme);
        return s?.instrument ? this.load(ctx, s, color, s.instrument) : Promise.resolve(null);
      }),
    );
  }

  /** Load and decode every sample of a color group. Resolves when all settled. */
  async loadColor(color: ColorId): Promise<void> {
    const ctx = await this.ensureRunning();
    const entries = Object.entries(this.samplesFor(color)) as [Instrument, SampleInfo][];
    await Promise.all(entries.map(([instrument, s]) => this.load(ctx, s, color, instrument)));
  }

  private load(ctx: AudioContext, s: SampleInfo, color: ColorId, instrument: Instrument): Promise<AudioBuffer | null> {
    const existing = this.pending.get(s.file);
    if (existing) return existing;
    this.state.set(s.file, 'loading');
    const p = (async () => {
      try {
        const data = await fetchSample(s.url);
        const buf = await ctx.decodeAudioData(data);
        this.buffers.set(s.file, buf);
        this.state.set(s.file, 'ready');
        return buf;
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        this.state.set(s.file, 'missing');
        this.missingList = [...this.missingList, { file: s.file, color, instrument, reason }];
        console.error(`[Circular Drum] Missing sample "${s.file}" (${color} ${instrument}): ${reason}`);
        return null;
      } finally {
        this.emit();
      }
    })();
    this.pending.set(s.file, p);
    return p;
  }
}

let silentKeeper: HTMLAudioElement | null = null;

/**
 * Phones: iPhones mute Web Audio while the ring/silent switch is on silent.
 * Declaring the page a playback app (iOS 17+), or keeping a silent HTML audio
 * element playing (older iOS), moves it to the media channel so the drums are
 * heard like a video would be. Must run inside a tap; harmless elsewhere.
 */
function unlockMobileAudio() {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) {
    try {
      session.type = 'playback';
    } catch {
      /* not allowed here; the HTML audio fallback below still applies */
    }
  }
  if (!silentKeeper && /iP(hone|ad|od)|Macintosh.*Mobile/.test(navigator.userAgent) && typeof Audio === 'function') {
    silentKeeper = new Audio(SILENT_WAV);
    silentKeeper.loop = true;
    silentKeeper.setAttribute('playsinline', '');
    silentKeeper.volume = 0;
    void silentKeeper.play().catch(() => {
      silentKeeper = null; // try again on the next tap
    });
  }
}

/** 0.1 s of silence, 8 kHz mono 8-bit. */
const SILENT_WAV = (() => {
  const n = 800;
  const bytes = new Uint8Array(44 + n);
  const v = new DataView(bytes.buffer);
  const str = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n, true);
  str(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true);
  v.setUint32(28, 8000, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  str(36, 'data');
  v.setUint32(40, n, true);
  bytes.fill(128, 44);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return `data:audio/wav;base64,${btoa(bin)}`;
})();

/**
 * Fetches a sample file. Korean filenames can be stored in composed (NFC)
 * or decomposed (NFD, common on macOS) Unicode form; both spell the same
 * name, so the other form is tried before the file is declared missing.
 */
async function fetchSample(url: string): Promise<ArrayBuffer> {
  const decoded = decodeURIComponent(url);
  const forms = [...new Set([url, encodeURI(decoded.normalize('NFC')), encodeURI(decoded.normalize('NFD'))])];
  let lastError = 'file not found';
  for (const u of forms) {
    const res = await fetch(u);
    const type = res.headers.get('content-type') ?? '';
    // Vite answers unknown paths with index.html; treat that as missing.
    if (res.ok && !type.includes('text/html')) return res.arrayBuffer();
    lastError = res.ok ? 'file not found' : `HTTP ${res.status}`;
  }
  throw new Error(lastError);
}

export const audioEngine = new AudioEngine();
