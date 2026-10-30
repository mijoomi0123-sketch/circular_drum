import { describe, expect, it } from 'vitest';
import {
  defaultLayout,
  freeCells,
  occupant,
  placeCircle,
  randomize,
  resizeGrid,
  restoreManual,
  setChosen,
  clickCircle,
  oneSound,
  setCircle,
  soloSound,
  settingsOf,
  soundColors,
  unplaced,
  type FullscreenLayout,
} from '../components/fullscreenLayout';

const ids = ['a', 'b', 'c', 'd', 'e'];
const base = (): FullscreenLayout => ({ ids: ['a', 'b', 'c'], cols: 3, rows: 2, cells: { a: { row: 0, col: 0 }, b: { row: 1, col: 2 } }, mode: 'manual', manualCells: null, settings: {} });
const noSharedCells = (l: FullscreenLayout) => {
  const placed = l.ids.filter((id) => l.cells[id] && l.cells[id].row < l.rows && l.cells[id].col < l.cols).map((id) => `${l.cells[id].row},${l.cells[id].col}`);
  return new Set(placed).size === placed.length;
};

describe('fullscreen layout', () => {
  it('places a circle in an exact cell and leaves the other cells empty', () => {
    const l = placeCircle(base(), 'c', { row: 1, col: 0 });
    expect(l.cells.c).toEqual({ row: 1, col: 0 });
    expect(occupant(l, { row: 0, col: 1 })).toBeNull();
    expect(freeCells(l)).toHaveLength(3);
  });

  it('dropping on a taken cell swaps the two circles, never stacks them', () => {
    const l = placeCircle(base(), 'a', { row: 1, col: 2 });
    expect(l.cells.a).toEqual({ row: 1, col: 2 });
    expect(l.cells.b).toEqual({ row: 0, col: 0 });
    expect(noSharedCells(l)).toBe(true);
  });

  it('a circle dropped from the tray onto a taken cell sends that one to the tray', () => {
    const l = placeCircle(base(), 'c', { row: 0, col: 0 });
    expect(l.cells.c).toEqual({ row: 0, col: 0 });
    expect(unplaced(l)).toEqual(['a']);
  });

  it('shrinking the grid keeps positions; growing it back restores them', () => {
    const small = resizeGrid(base(), 2, 1);
    expect(unplaced(small)).toEqual(['b', 'c']);
    expect(small.cells.b).toEqual({ row: 1, col: 2 });
    expect(resizeGrid(small, 3, 2).cells.b).toEqual({ row: 1, col: 2 });
  });

  it('choosing more circles never moves the ones already placed', () => {
    const l = setChosen(base(), ids, new Set(['a', 'b', 'c', 'd']));
    expect(l.cells.a).toEqual({ row: 0, col: 0 });
    expect(l.cells.b).toEqual({ row: 1, col: 2 });
    expect(noSharedCells(l)).toBe(true);
    expect(unplaced(l)).toEqual([]);
  });

  it('randomize uses distinct cells, can repeat, and the manual layout can be restored', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const r1 = randomize(base(), rnd);
    const r2 = randomize(r1, rnd);
    for (const r of [r1, r2]) {
      expect(r.mode).toBe('random');
      expect(unplaced(r)).toEqual([]);
      expect(noSharedCells(r)).toBe(true);
    }
    const back = restoreManual(r2);
    expect(back.mode).toBe('manual');
    expect(back.cells).toEqual(base().cells);
  });

  it('a manual move after randomizing makes the layout manual again', () => {
    const r = randomize(base());
    expect(placeCircle(r, 'a', { row: 0, col: 0 }).mode).toBe('manual');
  });

  it('randomize keeps the chosen grid size, whatever it is', () => {
    const many = Array.from({ length: 30 }, (_, i) => `c${i}`);
    for (const [cols, rows] of [[3, 3], [4, 4], [6, 6], [8, 8], [3, 6], [5, 8], [2, 2]]) {
      const l = randomize({ ...defaultLayout(many, 1.6), cols, rows });
      expect([l.cols, l.rows]).toEqual([cols, rows]);
      const placed = l.ids.filter((id) => l.cells[id] && l.cells[id].row < rows && l.cells[id].col < cols);
      expect(placed.length).toBe(Math.min(30, cols * rows)); // every cell used when there are enough circles
      expect(Object.values(l.cells).every((c) => c.row >= 0 && c.row < rows && c.col >= 0 && c.col < cols)).toBe(true);
      expect(noSharedCells(l)).toBe(true);
      expect(unplaced(l).length).toBe(Math.max(0, 30 - cols * rows)); // the rest wait in the tray
    }
  });
});

describe('per-circle fullscreen settings', () => {
  it('default to still and silent with the circle’s own sounds', () => {
    expect(settingsOf(base(), 'a')).toEqual({ animate: false, audible: false, sound: null });
  });
  it('change one circle only and follow it through moves, swaps, resizes and shuffles', () => {
    let l = setCircle(setCircle(base(), 'a', { animate: false }), 'b', { sound: 'purple' });
    expect(settingsOf(l, 'c')).toEqual({ animate: false, audible: false, sound: null });
    l = placeCircle(l, 'a', { row: 1, col: 2 }); // swaps with b
    l = resizeGrid(l, 4, 4);
    l = randomize(l, () => 0.3);
    expect(settingsOf(l, 'a')).toEqual({ animate: false, audible: false, sound: null });
    expect(settingsOf(l, 'b')).toEqual({ animate: false, audible: false, sound: 'purple' });
  });
  it('a chosen sound group drives all four instruments; none keeps the circle’s own', () => {
    const colors = { kick: 'blue', snare: 'pink', hihat: 'yellow', clap: 'green' } as const;
    expect(soundColors({ colors }, null)).toBe(colors);
    expect(soundColors({ colors }, 'brown')).toEqual({ kick: 'brown', snare: 'brown', hihat: 'brown', clap: 'brown' });
  });
});

describe('one sound at a time', () => {
  it('turning one circle on turns the others off and keeps every animation setting', () => {
    let l = setCircle(base(), 'a', { audible: true, animate: false });
    l = soloSound(l, 'b');
    expect(settingsOf(l, 'a')).toEqual({ animate: false, audible: false, sound: null });
    expect(settingsOf(l, 'b').audible).toBe(true);
    l = soloSound(l, 'c');
    expect(['a', 'b', 'c'].map((id) => settingsOf(l, id).audible)).toEqual([false, false, true]);
  });
  it('a layout saved with several sounding circles keeps only the first', () => {
    const l = oneSound(setCircle(setCircle(base(), 'c', { audible: true }), 'b', { audible: true }));
    expect(['a', 'b', 'c'].map((id) => settingsOf(l, id).audible)).toEqual([false, true, false]);
  });
});

describe('clicking circles in fullscreen', () => {
  const on = (l: FullscreenLayout) => ['a', 'b', 'c'].map((id) => `${settingsOf(l, id).animate ? 'A' : '-'}${settingsOf(l, id).audible ? 'S' : '-'}`).join(' ');
  it('animation adds up, sound moves to the last clicked; clicking a moving circle stops only it', () => {
    let l = clickCircle(base(), 'a');
    expect(on(l)).toBe('AS -- --');
    l = clickCircle(l, 'b');
    expect(on(l)).toBe('A- AS --');
    l = clickCircle(l, 'c');
    expect(on(l)).toBe('A- A- AS');
    l = clickCircle(l, 'a'); // moving but silent: stops; C keeps the sound
    expect(on(l)).toBe('-- A- AS');
    l = clickCircle(l, 'c'); // the sounding one: still and silent, no other sound starts
    expect(on(l)).toBe('-- A- --');
  });
});

describe('saved circle settings: one source for Library and Fullscreen', () => {
  it('every save reaches subscribers with the new settings by id; nothing else changes them', async () => {
    const m = await import('../components/fullscreenLayout');
    let calls = 0;
    const off = m.subscribeSaved(() => calls++);
    const base = m.defaultLayout(['x', 'y'], 1.6);
    const on = m.clickCircle(base, 'y');
    m.saveLayout(on);
    expect(calls).toBe(1);
    const first = m.savedCircleSettings();
    expect(first.y.animate).toBe(true);
    expect(first.x?.animate ?? false).toBe(false);
    expect(m.savedCircleSettings()).toBe(first); // stable until the next save
    m.saveLayout(m.clickCircle(on, 'y'));
    expect(m.savedCircleSettings().y.animate).toBe(false);
    off();
  });
});
