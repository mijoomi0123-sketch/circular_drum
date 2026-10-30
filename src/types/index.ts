/** The seven color groups. The order matches filename numbers 01–07. */
export type ColorId = 'orange' | 'yellow' | 'green' | 'blue' | 'pink' | 'purple' | 'brown';

/** Instrument types that can be recognised from a sample filename. */
export type Instrument = 'kick' | 'snare' | 'hihat' | 'clap' | 'cymbal';

/**
 * The four user-facing instrument channels. Each has its own volume slider,
 * its own GainNode and its own circle in the artwork (see audio/channels.ts).
 */
export type Channel = 'kick' | 'snare' | 'hihat' | 'clap';

/**
 * One on/off row per instrument, always MAX_STEPS (32) long. The artwork's
 * step count says how many of them play, so shortening and lengthening the
 * cycle never loses edits.
 */
export type ChannelPatterns = Record<Channel, boolean[]>;

/**
 * Color chosen for each instrument. It picks the circle's color and which
 * color group's sample that instrument plays (01 orange … 07 brown).
 */
export type ChannelColors = Record<Channel, ColorId>;

export interface ColorPreset {
  id: ColorId;
  label: string;
  /** Filename number that selects this color's sample group (1 = "01"). */
  groupNumber: number;
  hex: string;
}

/** A sample file resolved from the configuration. */
export interface SampleInfo {
  file: string;
  url: string;
  groupNumber: number;
  /** Second number of the filename: 1 kick, 2 snare, 3 hi-hat, 4 clap slot. */
  slotNumber: number | null;
  color: ColorId | null;
  instrument: Instrument | null;
}

/** One of the four circles of an artwork, in a 100-unit radius space. */
export interface Ring {
  /** Base radius, from the instrument's active steps (presets/sizing.ts). */
  r: number;
  /** The instrument this circle belongs to. */
  zone: Channel;
  /** Body opacity at rest; below 1 for the translucent Hi-hat membrane. */
  opacity: number;
  /** Turn of the gradient core about the centre, in degrees (the form itself stays a circle). */
  tilt: number;
  /** Where the gradient's core sits, as a 0–1 offset inside the circle. */
  coreX: number;
  coreY: number;
}

/** Predefined, non-user-editable graphic settings for an artwork. */
export interface ArtworkDesign {
  /** Seed for the deterministic ring layout. */
  seed: number;
  /** Relative size of the artwork inside its library cell (0.55–1). */
  scale: number;
  /** Which rhythm preset drives this artwork (see presets/rhythms.ts). */
  rhythm: string;
}

export interface Artwork {
  id: string;
  name: string;
  /** Main color: kept for older data and used as the editor accent. Mirrors the Kick color. */
  color: ColorId;
  /** Kick / Snare / Hi-hat / Clap colors, each chosen independently. */
  colors: ChannelColors;
  bpm: number;
  steps: number;
  loop: boolean;
  /** Independent Kick / Snare / Hi-hat / Clap step rows. */
  patterns: ChannelPatterns;
  design: ArtworkDesign;
  createdAt: number;
  updatedAt: number;
}

/** A single sound event placed on the AudioContext timeline. */
/**
 * How loud a sample is over its length, sampled every `hop` seconds, as
 * 0–1 (1 = its loudest moment, 0 = 36 dB below it or silent). Lets visuals
 * follow how long a sound really rings rather than a fixed time.
 */
export interface SoundEnvelope {
  hop: number;
  level: Float32Array;
}

export interface ScheduledEvent {
  /** AudioContext time (seconds) at which the sample starts. */
  time: number;
  step: number;
  instrument: Instrument;
  sample: string;
  color: ColorId;
  /** Fixed per instrument (see audio/channels.ts); not user adjustable. */
  velocity: number;
  /** Loudness of the sample over time, when its audio is decoded. */
  envelope?: SoundEnvelope;
}
