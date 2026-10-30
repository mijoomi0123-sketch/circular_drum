import { describe, expect, it } from 'vitest';
import { patternsFromRhythm, toggleStep } from '../audio/pattern';
import { createArtwork, duplicateArtwork, loadArtworks, sanitizeArtwork, saveArtworks, STORAGE_KEY } from '../storage/artworkStore';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

describe('artwork storage', () => {
  it('seeds defaults on first launch and persists them', () => {
    const s = new MemoryStorage() as unknown as Storage;
    const list = loadArtworks(s);
    expect(list.length).toBeGreaterThan(3);
    expect(list.every((a) => a.bpm === 120 && a.steps === 16)).toBe(true);
    expect(JSON.parse(s.getItem(STORAGE_KEY)!)).toHaveLength(list.length);
  });

  it('round-trips saved settings', () => {
    const s = new MemoryStorage() as unknown as Storage;
    const list = loadArtworks(s);
    const colors = { kick: 'purple', snare: 'green', hihat: 'yellow', clap: 'blue' } as const;
    const patterns = toggleStep(list[0].patterns, 'snare', 1);
    list[0] = { ...list[0], color: 'purple', colors: { ...colors }, patterns, bpm: 87, steps: 11, loop: false };
    saveArtworks(list, s);
    const again = loadArtworks(s);
    expect(again[0]).toMatchObject({ color: 'purple', colors, bpm: 87, steps: 11, loop: false });
    expect(again[0].patterns).toEqual(patterns);
    expect(again[1].colors).toEqual(list[1].colors);
  });

  it('repairs out-of-range values', () => {
    const a = sanitizeArtwork({ id: 'x', color: 'teal', bpm: 999, steps: 0, volume: 4, design: {}, colors: { kick: 'teal' } })!;
    expect(a).toMatchObject({ color: 'orange', bpm: 200, steps: 1 });
    expect(a.colors.kick).toBe('orange');
    expect('volume' in a).toBe(false);
  });

  it('migrates older records: rows from their rhythm, one color on all four, volumes dropped', () => {
    const a = sanitizeArtwork({ id: 'old', name: 'Old', color: 'blue', bpm: 90, steps: 12, loop: false, volume: 0.5, levels: { kick: 0.1 }, design: { seed: 7, scale: 0.8, rhythm: 'drift' } })!;
    expect(a).toMatchObject({ name: 'Old', color: 'blue', bpm: 90, steps: 12, loop: false });
    expect(a.colors).toEqual({ kick: 'blue', snare: 'blue', hihat: 'blue', clap: 'blue' });
    expect(a.patterns).toEqual(patternsFromRhythm('drift', 12));
    expect('volume' in a || 'levels' in a).toBe(false);
  });

  it('keeps stored rows exactly', () => {
    const row = Array.from({ length: 32 }, (_, i) => i % 3 === 0);
    const a = sanitizeArtwork({ id: 'p', design: { rhythm: 'pulse' }, patterns: { kick: row } })!;
    expect(a.patterns.kick).toEqual(row);
    expect(a.patterns.snare).toEqual(patternsFromRhythm('pulse', 16).snare);
  });

  it('new artworks are separate records with their own levels', () => {
    const a = createArtwork(0);
    const b = createArtwork(1);
    expect(a.id).not.toBe(b.id);
    expect(a.color).not.toBe(b.color);
    expect(new Set(Object.values(a.colors)).size).toBe(4);
    a.colors.kick = 'brown';
    a.patterns.kick[1] = !a.patterns.kick[1];
    expect(b.colors.kick).not.toBe('brown');
  });

  it('duplicates into an independent artwork', () => {
    const s = new MemoryStorage() as unknown as Storage;
    const [a] = loadArtworks(s);
    const b = duplicateArtwork(a);
    b.design.seed = 1;
    b.colors.snare = 'brown';
    b.patterns.snare[0] = !b.patterns.snare[0];
    expect(b.id).not.toBe(a.id);
    expect(a.design.seed).not.toBe(1);
    expect(a.colors.snare).not.toBe('brown');
    expect(a.patterns.snare[0]).not.toBe(b.patterns.snare[0]);
  });
});
