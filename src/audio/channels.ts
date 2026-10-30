import type { Channel, Instrument } from '../types';

/**
 * Instrument → channel → circle mapping, in one place.
 *
 * | Channel | Step row | Circle in the artwork              | Samples routed here |
 * |---------|----------|------------------------------------|---------------------|
 * | kick    | Kick     | large filled disc                  | 킥                  |
 * | snare   | Snare    | middle filled disc                 | 스네어              |
 * | hihat   | Hi-hat   | thin open circle floating outside  | 하이햇              |
 * | clap    | Clap     | small filled disc at the centre    | 클랩, or 심벌 in colors that have a cymbal instead of a clap (03 green, 04 blue, 06 purple) |
 *
 * Every color group has exactly four samples: kick, snare, hi-hat and either
 * a clap or a cymbal, so the fourth sample always goes to the Clap channel.
 */
export const CHANNELS: readonly Channel[] = ['kick', 'snare', 'hihat', 'clap'];

export const CHANNEL_LABELS: Readonly<Record<Channel, string>> = {
  kick: 'Kick',
  snare: 'Snare',
  hihat: 'Hi-hat',
  clap: 'Clap',
};

const INSTRUMENT_CHANNEL: Readonly<Record<Instrument, Channel>> = {
  kick: 'kick',
  snare: 'snare',
  hihat: 'hihat',
  clap: 'clap',
  cymbal: 'clap',
};

export function channelOf(instrument: Instrument): Channel {
  return INSTRUMENT_CHANNEL[instrument];
}

/**
 * Fixed playback level of each instrument's hits (sample gain). These are
 * not user controls; they only keep the mix balanced and are shared with the
 * animation so a hi-hat tick is lighter than a kick.
 */
export const CHANNEL_VELOCITY: Readonly<Record<Channel, number>> = {
  kick: 1,
  snare: 0.85,
  hihat: 0.55,
  clap: 0.7,
};
