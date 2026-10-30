import { describe, expect, it } from 'vitest';
import { buildSampleMap, LIGHT_SAMPLE_MAP, parseGroupNumber, parseInstrument, resolveSample, SAMPLE_MAP, sampleForSlot, setSoundTheme } from '../audio/sampleMap';
import { COLORS } from '../presets/colors';

describe('filename → color group', () => {
  it('treats 01 and 1 as the same group', () => {
    expect(parseGroupNumber('01-1-kick_1.wav')).toBe(1);
    expect(parseGroupNumber('1-1-kick_1.wav')).toBe(1);
    expect(parseGroupNumber('007-snare.wav')).toBe(7);
    expect(parseGroupNumber('kick.wav')).toBeNull();
  });

  it('maps 01–07 to orange, yellow, green, blue, pink, purple, brown', () => {
    const expected = ['orange', 'yellow', 'green', 'blue', 'pink', 'purple', 'brown'];
    expected.forEach((color, i) => {
      const map = buildSampleMap([`0${i + 1}-1-킥.wav`]);
      expect(map.byColor[color as (typeof COLORS)[number]['id']].kick?.file).toBe(`0${i + 1}-1-킥.wav`);
    });
  });
});

describe('filename → instrument', () => {
  it('reads Korean and English words', () => {
    expect(parseInstrument('01-1-킥.wav')).toBe('kick');
    expect(parseInstrument('01-2-스네어.wav')).toBe('snare');
    expect(parseInstrument('01-3-하이햇.wav')).toBe('hihat');
    expect(parseInstrument('01-4-클랩.wav')).toBe('clap');
    expect(parseInstrument('03-4-심벌.wav')).toBe('cymbal');
    expect(parseInstrument('01-1-kick_1.wav')).toBe('kick');
  });

  it('does not guess when unclear', () => {
    expect(parseInstrument('02-5-perc.wav')).toBeNull();
    expect(parseInstrument('02-5-kick-snare.wav')).toBeNull();
    const map = buildSampleMap(['02-5-perc.wav', '09-1-kick.wav']);
    expect(map.problems.map((p) => p.file)).toEqual(['02-5-perc.wav', '09-1-kick.wav']);
  });
});

describe('project sample configuration', () => {
  it('assigns every configured file with no problems', () => {
    expect(SAMPLE_MAP.problems).toEqual([]);
  });

  it('gives every color a kick, snare, hihat and a clap or cymbal', () => {
    for (const c of COLORS) {
      const s = SAMPLE_MAP.byColor[c.id];
      expect(s.kick && s.snare && s.hihat, c.id).toBeTruthy();
      expect(Boolean(s.clap) !== Boolean(s.cymbal), c.id).toBe(true);
      for (const info of Object.values(s)) expect(info!.file.startsWith(String(c.groupNumber).padStart(2, '0'))).toBe(true);
    }
  });
});

describe('color number + instrument number → file', () => {
  it('resolves the examples from the brief', async () => {
    const { sampleForSlot, MISSING_SLOTS } = await import('../audio/sampleMap');
    expect(sampleForSlot('kick', 'purple', 'dark')?.file).toBe('06-1-킥.wav');
    expect(sampleForSlot('snare', 'brown', 'dark')?.file).toBe('07-2-스네어.wav');
    expect(sampleForSlot('hihat', 'orange', 'dark')?.file).toBe('01-3-하이햇.wav');
    expect(sampleForSlot('clap', 'pink', 'dark')?.file).toBe('05-4-클랩.wav');
    // groups whose 4th file is a cymbal still resolve to their own "-4-" file
    expect(sampleForSlot('clap', 'green', 'dark')?.file).toBe('03-4-심벌.wav');
    expect(sampleForSlot('clap', 'blue', 'dark')?.file).toBe('04-4-심벌.wav');
    expect(sampleForSlot('clap', 'purple', 'dark')?.file).toBe('06-4-심벌.wav');
    expect(MISSING_SLOTS).toEqual([]);
  });

  it('every one of the 28 color × instrument combinations has its own file', async () => {
    const { sampleForSlot, CHANNEL_SLOT } = await import('../audio/sampleMap');
    const files = new Set<string>();
    for (const c of COLORS) for (const ch of ['kick', 'snare', 'hihat', 'clap'] as const) {
      const f = sampleForSlot(ch, c.id, 'dark')!.file;
      expect(f.startsWith(`${String(c.groupNumber).padStart(2, '0')}-${CHANNEL_SLOT[ch]}-`)).toBe(true);
      files.add(f);
    }
    expect(files.size).toBe(28);
  });
});

describe('theme-dependent samples', () => {
  const CH = ['kick', 'snare', 'hihat', 'clap'] as const;

  it('Light Mode: 28 new files, each in the same group and slot as its Dark Mode original', () => {
    expect(LIGHT_SAMPLE_MAP.problems).toEqual([]);
    const files = new Set<string>();
    for (const c of COLORS) for (const ch of CH) {
      const dark = sampleForSlot(ch, c.id, 'dark')!;
      const light = sampleForSlot(ch, c.id, 'light')!;
      expect(light.file).toBe(`light/${dark.file.replace('.wav', '(화이트 모드).wav')}`);
      expect([light.groupNumber, light.slotNumber, light.instrument, light.color]).toEqual([dark.groupNumber, dark.slotNumber, dark.instrument, dark.color]);
      files.add(light.file);
    }
    expect(files.size).toBe(28);
  });

  it('Dark Mode keeps the original files and URLs exactly', () => {
    expect(sampleForSlot('kick', 'purple', 'dark')!.url).toBe(resolveSample('06-1-킥.wav').url);
    expect(sampleForSlot('kick', 'purple', 'dark')!.url.endsWith('/audio/' + encodeURIComponent('06-1-킥.wav'))).toBe(true);
    expect(sampleForSlot('clap', 'green', 'light')!.url.endsWith('/audio/light/' + encodeURIComponent('03-4-심벌(화이트 모드).wav'))).toBe(true);
  });

  it('follows the active theme', () => {
    setSoundTheme('dark');
    expect(sampleForSlot('snare', 'brown')!.file).toBe('07-2-스네어.wav');
    setSoundTheme('light');
    expect(sampleForSlot('snare', 'brown')!.file).toBe('light/07-2-스네어(화이트 모드).wav');
  });
});
