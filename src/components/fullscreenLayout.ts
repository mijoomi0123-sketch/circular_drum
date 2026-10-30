/**
 * The Fullscreen View composition: which circles are shown, the grid, and the
 * cell each circle sits in. It is kept apart from the artworks (its own
 * localStorage key), so arranging the composition never touches saved
 * circles, colors, patterns or sounds.
 */
import type { Artwork, ChannelColors, ColorId } from '../types';
import { COLOR_IDS } from '../presets/colors';

export interface Cell {
  row: number;
  col: number;
}

/** How one circle behaves in Fullscreen View. */
export interface CircleSettings {
  /** Its motion in fullscreen, switched by clicking the circle (All Animations Off still overrides it). */
  animate: boolean;
  /** Whether it plays its beat in fullscreen; independent of `animate`. */
  audible: boolean;
  /** Sample group (01–07, by color) it plays in fullscreen; null = its own sounds. */
  sound: ColorId | null;
}

/** A circle starts still and silent in fullscreen until it is clicked. */
export const DEFAULT_CIRCLE: CircleSettings = { animate: false, audible: false, sound: null };

export interface FullscreenLayout {
  /** Chosen circles, in library order. */
  ids: string[];
  cols: number;
  rows: number;
  /** Cell of each placed circle. A position outside the grid is kept (the circle waits in the tray) and comes back if the grid grows again. */
  cells: Record<string, Cell>;
  /** 'random' right after Randomize Layout; any manual move makes it 'manual' again. */
  mode: 'manual' | 'random';
  /** The manual arrangement from before the last Randomize, so it can be restored. */
  manualCells: Record<string, Cell> | null;
  /** Each circle's fullscreen settings, by circle id (never by cell), so they follow it wherever it moves. */
  settings: Record<string, CircleSettings>;
}

export function settingsOf(layout: FullscreenLayout, id: string): CircleSettings {
  return { ...DEFAULT_CIRCLE, ...layout.settings?.[id] };
}

/** Changes one circle's settings; every other circle keeps its own. */
export function setCircle(layout: FullscreenLayout, id: string, patch: Partial<CircleSettings>): FullscreenLayout {
  return { ...layout, settings: { ...layout.settings, [id]: { ...settingsOf(layout, id), ...patch } } };
}

/**
 * Fullscreen plays one circle's sound at a time: turning one on turns every
 * other circle's sound off. Animation settings are left exactly as they are.
 */
export function soloSound(layout: FullscreenLayout, id: string): FullscreenLayout {
  const settings: Record<string, CircleSettings> = {};
  for (const [k, v] of Object.entries(layout.settings ?? {})) settings[k] = v.audible && k !== id ? { ...v, audible: false } : v;
  settings[id] = { ...settingsOf(layout, id), audible: true };
  return { ...layout, settings };
}

/**
 * A click on a circle in fullscreen. A still circle starts moving and takes
 * the one sound (every other circle keeps its own animation). A moving circle
 * stops, and goes silent if it was the one sounding; no other sound starts.
 */
export function clickCircle(layout: FullscreenLayout, id: string): FullscreenLayout {
  if (settingsOf(layout, id).animate) return setCircle(layout, id, { animate: false, audible: false });
  return soloSound(setCircle(layout, id, { animate: true }), id);
}

/** At most one sounding circle (the first in library order), e.g. for layouts saved when several could sound. */
export function oneSound(layout: FullscreenLayout): FullscreenLayout {
  const first = layout.ids.find((id) => settingsOf(layout, id).audible);
  if (!first) return layout;
  const settings: Record<string, CircleSettings> = {};
  for (const [k, v] of Object.entries(layout.settings ?? {})) settings[k] = v.audible && k !== first ? { ...v, audible: false } : v;
  return { ...layout, settings };
}

/** The sample colors a circle plays with: its own, or all four instruments from one chosen group. */
export function soundColors(a: Pick<Artwork, 'colors'>, sound: ColorId | null): ChannelColors {
  return sound ? { kick: sound, snare: sound, hihat: sound, clap: sound } : a.colors;
}

const readSettings = (v: unknown, ids: Set<string>): Record<string, CircleSettings> => {
  const out: Record<string, CircleSettings> = {};
  if (!v || typeof v !== 'object') return out;
  for (const [id, x] of Object.entries(v as Record<string, Partial<CircleSettings>>)) {
    if (!ids.has(id) || !x || typeof x !== 'object') continue;
    out[id] = { animate: x.animate !== false, audible: x.audible === true, sound: COLOR_IDS.includes(x.sound as ColorId) ? (x.sound as ColorId) : null };
  }
  return out;
};

export const MIN_GRID = 1;
export const MAX_GRID = 8;
const STORE_KEY = 'circular-drum.fullscreen.v2';
const OLD_KEY = 'circular-drum.fullscreen.v1';

const clampGrid = (n: number) => Math.max(MIN_GRID, Math.min(MAX_GRID, Math.round(n) || MIN_GRID));
const key = (c: Cell) => `${c.row},${c.col}`;

export function inGrid(layout: Pick<FullscreenLayout, 'cols' | 'rows'>, c: Cell | undefined): c is Cell {
  return !!c && c.row >= 0 && c.col >= 0 && c.row < layout.rows && c.col < layout.cols;
}

/** Columns and rows for `n` circles on a screen of the given shape: the layout with the largest cells. */
export function autoGrid(n: number, aspect: number): { cols: number; rows: number } {
  if (n <= 1) return { cols: 1, rows: 1 };
  let best = { cols: n, rows: 1, size: 0 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const size = Math.min(aspect / cols, 1 / rows);
    if (size > best.size + 1e-9) best = { cols, rows, size };
  }
  return { cols: Math.min(MAX_GRID, best.cols), rows: Math.min(MAX_GRID, best.rows) };
}

/** Circle in a cell, if any (only circles that are chosen and inside the grid count). */
export function occupant(layout: FullscreenLayout, c: Cell): string | null {
  for (const id of layout.ids) {
    const p = layout.cells[id];
    if (inGrid(layout, p) && p.row === c.row && p.col === c.col) return id;
  }
  return null;
}

/** Chosen circles with no cell inside the grid (they wait in the tray and are not shown). */
export function unplaced(layout: FullscreenLayout): string[] {
  return layout.ids.filter((id) => !inGrid(layout, layout.cells[id]));
}

export function freeCells(layout: FullscreenLayout): Cell[] {
  const taken = new Set(layout.ids.filter((id) => inGrid(layout, layout.cells[id])).map((id) => key(layout.cells[id])));
  const out: Cell[] = [];
  for (let row = 0; row < layout.rows; row++) for (let col = 0; col < layout.cols; col++) if (!taken.has(key({ row, col }))) out.push({ row, col });
  return out;
}

/**
 * Moves a circle to a cell (or to the tray with `null`). If another circle is
 * there, the two swap places, so two circles never share a cell. Manual edits
 * switch the layout back to manual.
 */
export function placeCircle(layout: FullscreenLayout, id: string, to: Cell | null): FullscreenLayout {
  const cells = { ...layout.cells };
  const from = inGrid(layout, cells[id]) ? cells[id] : null;
  if (to) {
    const other = occupant(layout, to);
    if (other && other !== id) {
      if (from) cells[other] = from;
      else delete cells[other]; // the displaced circle goes to the tray
    }
    cells[id] = { row: to.row, col: to.col };
  } else {
    delete cells[id];
  }
  return { ...layout, cells, mode: 'manual' };
}

/** Grid size change: positions are kept as they are (outside ones wait in the tray), nothing is shuffled. */
export function resizeGrid(layout: FullscreenLayout, cols: number, rows: number): FullscreenLayout {
  return { ...layout, cols: clampGrid(cols), rows: clampGrid(rows) };
}

/**
 * Chooses or drops a circle. A newly chosen circle without a cell takes the
 * first free one (if any); circles already placed never move.
 */
export function setChosen(layout: FullscreenLayout, allIds: string[], chosen: Set<string>): FullscreenLayout {
  const ids = allIds.filter((id) => chosen.has(id));
  let next: FullscreenLayout = { ...layout, ids, cells: { ...layout.cells } };
  for (const id of ids) {
    // Placed circles keep their cell, even one outside the grid right now.
    if (next.cells[id] && (!inGrid(next, next.cells[id]) || occupant(next, next.cells[id]) === id)) continue;
    const free = freeCells({ ...next, ids: ids.filter((x) => x !== id) });
    if (free.length) next.cells[id] = free[0];
    else delete next.cells[id];
  }
  // A dropped circle forgets its cell, so choosing it again starts fresh.
  for (const id of Object.keys(next.cells)) if (!chosen.has(id)) delete next.cells[id];
  next = { ...next };
  return next;
}

/**
 * Shuffles the chosen circles over distinct cells of the current grid (its
 * columns × rows, never changed here). If more circles are chosen than the
 * grid has cells, a random selection fills every cell and the rest wait in
 * the tray. Only positions change; settings stay with each circle's id.
 */
export function randomize(layout: FullscreenLayout, rnd: () => number = Math.random): FullscreenLayout {
  const { cols, rows } = layout;
  const shuffle = <T,>(list: T[]) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };
  const all: Cell[] = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) all.push({ row, col });
  shuffle(all);
  const order = layout.ids.length > all.length ? shuffle([...layout.ids]) : layout.ids;
  const cells: Record<string, Cell> = {};
  order.forEach((id, i) => {
    if (i < all.length) cells[id] = all[i];
  });
  return {
    ...layout,
    cols,
    rows,
    cells,
    mode: 'random',
    // Keep the arrangement made by hand, not an earlier random one.
    manualCells: layout.mode === 'manual' ? layout.cells : layout.manualCells,
  };
}

/** Back to the arrangement from before randomizing. */
export function restoreManual(layout: FullscreenLayout): FullscreenLayout {
  if (!layout.manualCells) return { ...layout, mode: 'manual' };
  const cells: Record<string, Cell> = {};
  for (const id of layout.ids) if (layout.manualCells[id]) cells[id] = layout.manualCells[id];
  return { ...layout, cells, mode: 'manual', manualCells: null };
}

/** A first layout: every circle (in library order) on the grid that suits the screen. */
export function defaultLayout(allIds: string[], aspect: number): FullscreenLayout {
  const { cols, rows } = autoGrid(allIds.length, aspect);
  const cells: Record<string, Cell> = {};
  allIds.forEach((id, i) => {
    if (i < cols * rows) cells[id] = { row: Math.floor(i / cols), col: i % cols };
  });
  return { ids: allIds, cols, rows, cells, mode: 'manual', manualCells: null, settings: {} };
}

export function loadLayout(allIds: string[], aspect: number): FullscreenLayout {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    if (v && Array.isArray(v.ids) && typeof v.cols === 'number' && typeof v.rows === 'number' && v.cells && typeof v.cells === 'object') {
      const known = new Set(allIds);
      const ids = allIds.filter((id) => v.ids.includes(id));
      const cells: Record<string, Cell> = {};
      for (const id of ids) if (v.cells[id] && known.has(id)) cells[id] = { row: v.cells[id].row | 0, col: v.cells[id].col | 0 };
      return { ids, cols: clampGrid(v.cols), rows: clampGrid(v.rows), cells, mode: v.mode === 'random' ? 'random' : 'manual', manualCells: v.manualCells ?? null, settings: readSettings(v.settings, known) };
    }
    // The earlier version only remembered which circles were chosen.
    const old = JSON.parse(localStorage.getItem(OLD_KEY) ?? 'null');
    if (old && Array.isArray(old.ids)) return defaultLayout(allIds.filter((id) => old.ids.includes(id)), aspect);
  } catch {
    /* unreadable or unavailable: what was saved this visit, else start fresh */
    if (lastSaved) return lastSaved;
  }
  return defaultLayout(allIds, aspect);
}

export function saveLayout(layout: FullscreenLayout) {
  lastSaved = layout;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(layout));
  } catch {
    /* fine: the layout is still kept for this visit (lastSaved) */
  }
  savedVersion++;
  savedListeners.forEach((fn) => fn());
}

/*
 * One source of truth for each circle's own animation (and sound) setting:
 * the saved layout, by circle id. The Library and Fullscreen both read it, and
 * every saveLayout tells them, so they never disagree. The global All
 * Animations switch is separate (settingsStore) and never writes here.
 */
let lastSaved: FullscreenLayout | null = null;
let savedVersion = 0;
const savedListeners = new Set<() => void>();
let savedCache: { version: number; settings: Record<string, CircleSettings> } | null = null;

export function subscribeSaved(fn: () => void): () => void {
  savedListeners.add(fn);
  return () => savedListeners.delete(fn);
}

/** Every circle's saved setting by id (a stable object until the next save). */
export function savedCircleSettings(): Record<string, CircleSettings> {
  if (savedCache?.version === savedVersion) return savedCache.settings;
  let settings: Record<string, CircleSettings> = lastSaved?.settings ?? {};
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    if (v?.settings && typeof v.settings === 'object') settings = readSettings(v.settings, new Set(Object.keys(v.settings)));
  } catch {
    /* storage unavailable: what was saved this visit */
  }
  savedCache = { version: savedVersion, settings };
  return settings;
}
