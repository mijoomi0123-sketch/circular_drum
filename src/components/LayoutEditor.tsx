import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Artwork } from '../types';
import { ArtworkGraphic } from './ArtworkGraphic';
import { SearchIcon, ShuffleIcon } from './PlayIcons';
import {
  MAX_GRID,
  occupant,
  placeCircle,
  randomize,
  resizeGrid,
  setChosen,
  unplaced,
  type Cell,
  type FullscreenLayout,
} from './fullscreenLayout';

interface Props {
  artworks: Artwork[];
  initial: FullscreenLayout;
  onCancel: () => void;
  onApply: (layout: FullscreenLayout, show: boolean) => void;
}

interface Drag {
  id: string;
  pointer: number;
  x0: number;
  y0: number;
  x: number;
  y: number;
  moved: boolean;
  /** Cell under the pointer, 'tray', or null. */
  over: Cell | 'tray' | null;
}

const cellOf = (el: Element | null): Cell | 'tray' | null => {
  const c = el?.closest('[data-cell]') as HTMLElement | null;
  if (c) return { row: Number(c.dataset.row), col: Number(c.dataset.col) };
  return el?.closest('[data-tray]') ? 'tray' : null;
};

/**
 * Composes the Fullscreen View: choose circles, set the grid by dragging on
 * the size picker, and place each circle in an exact cell by dragging it
 * (or selecting it and choosing its row and column). Empty cells stay empty;
 * nothing moves unless the user moves it or presses Randomize Layout.
 * Works on a draft: Apply keeps it, Cancel drops it.
 */
export function LayoutEditor({ artworks, initial, onCancel, onApply }: Props) {
  const [layout, setLayout] = useState<FullscreenLayout>(initial);
  const [drag, setDrag] = useState<Drag | null>(null);
  // Search saved beats by name (case-insensitive, as you type); choosing a result adds it to the layout.
  const [query, setQuery] = useState('');
  const q = query.trim().toLocaleLowerCase();
  const found = q ? artworks.filter((a) => a.name.toLocaleLowerCase().includes(q)) : artworks;
  const [sizing, setSizing] = useState<{ cols: number; rows: number } | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const byId = new Map(artworks.map((a) => [a.id, a]));
  const chosen = new Set(layout.ids);
  // While the size picker is dragged, the preview already shows the new grid.
  const view = sizing ? resizeGrid(layout, sizing.cols, sizing.rows) : layout;
  const tray = unplaced(view);
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);

  useEffect(() => {
    dialog.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Escape in a filled search box only clears the search.
        if (e.target instanceof HTMLInputElement && e.target.type === 'search' && e.target.value) return;
        e.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, [onCancel]);

  const choose = (next: Set<string>) =>
    setLayout((l) =>
      setChosen(
        l,
        artworks.map((a) => a.id),
        next,
      ),
    );

  const move = (id: string, to: Cell | null) => setLayout((l) => placeCircle(l, id, to));

  // ── Dragging circles between cells (mouse, pen and touch) ──
  const startDrag = (e: ReactPointerEvent<HTMLElement>, id: string) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ id, pointer: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: false, over: null });
  };
  const moveDrag = (e: ReactPointerEvent<HTMLElement>) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    const moved = drag.moved || Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 5;
    setDrag({ ...drag, x: e.clientX, y: e.clientY, moved, over: moved ? cellOf(document.elementFromPoint(e.clientX, e.clientY)) : null });
  };
  const endDrag = (e: ReactPointerEvent<HTMLElement>) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    if (drag.moved) {
      if (drag.over === 'tray') move(drag.id, null);
      else if (drag.over) move(drag.id, drag.over);
    }
    setDrag(null);
  };

  // ── Grid size: press and drag across the picker ──
  // The picker's box is taken once when the press starts: the live preview can
  // change the dialog's height (and so move the picker) during the gesture, and
  // reading it again would shift the chosen size by a row (e.g. 6 × 6 → 6 × 5).
  const padBox = useRef<DOMRect | null>(null);
  const sizeAt = (e: ReactPointerEvent<HTMLElement>) => {
    const r = padBox.current ?? e.currentTarget.getBoundingClientRect();
    const cols = Math.min(MAX_GRID, Math.max(1, Math.ceil(((e.clientX - r.left) / r.width) * MAX_GRID)));
    const rows = Math.min(MAX_GRID, Math.max(1, Math.ceil(((e.clientY - r.top) / r.height) * MAX_GRID)));
    return { cols, rows };
  };
  const shown = sizing ?? { cols: layout.cols, rows: layout.rows };

  const circle = (id: string, where: 'cell' | 'tray') => {
    const a = byId.get(id);
    if (!a) return null;
    const dragging = drag?.id === id && drag.moved;
    return (
      <button
        type="button"
        key={id}
        className={`le-circle${dragging ? ' is-dragging' : ''}`}
        data-artwork-id={id}
        aria-label={`${a.name}${where === 'tray' ? ', not placed' : ''}`}
        onPointerDown={(e) => startDrag(e, id)}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={() => setDrag(null)}
        style={dragging ? ({ transform: `translate(${drag!.x - drag!.x0}px, ${drag!.y - drag!.y0}px)` } as CSSProperties) : undefined}
      >
        <ArtworkGraphic design={a.design} colors={a.colors} patterns={a.patterns} steps={a.steps} className="le-art" />
      </button>
    );
  };

  return createPortal(
    <div className="le-backdrop">
      <div ref={dialog} className="le-dialog" role="dialog" aria-modal="true" aria-label="Fullscreen layout" tabIndex={-1}>
        <header className="le-head">
          <span>Fullscreen layout</span>
        </header>

        <div className="le-body">
          <section className="le-side" aria-label="Circles">
            <div className="settings-row">
              <span>Circles</span>
              <span className="settings-value">
                {layout.ids.length} of {artworks.length}
              </span>
            </div>
            <div className="beat-search" role="search">
              <SearchIcon />
              <input
                type="search"
                value={query}
                placeholder="Search saved beats"
                aria-label="Search saved beats by name"
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => setQuery(e.currentTarget.value)}
                onKeyDown={(e) => {
                  // Enter adds the first match to the layout.
                  if (e.key === 'Enter' && q && found.length && !chosen.has(found[0].id)) choose(new Set([...chosen, found[0].id]));
                  if (e.key === 'Escape' && query) setQuery('');
                }}
              />
            </div>
            <div className="fs-picker-actions">
              <button type="button" className="text-btn" onClick={() => choose(new Set(artworks.map((a) => a.id)))}>
                Select All
              </button>
              <button type="button" className="text-btn" onClick={() => choose(new Set())}>
                Deselect All
              </button>
            </div>
            {q && !found.length && (
              <p className="le-hint" role="status">
                No saved beats match “{query.trim()}”.
              </p>
            )}
            <ul className="fs-pick-list" aria-label="Choose circles">
              {found.map((a) => {
                const on = chosen.has(a.id);
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      className={`fs-pick${on ? ' is-on' : ''}`}
                      data-artwork-id={a.id}
                      title={a.name}
                      onClick={() => {
                        const next = new Set(chosen);
                        if (on) next.delete(a.id);
                        else next.add(a.id);
                        choose(next);
                      }}
                    >
                      <ArtworkGraphic design={a.design} colors={a.colors} patterns={a.patterns} steps={a.steps} className="fs-pick-art" />
                      <span className="fs-pick-name">{a.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="le-size">
              <div className="settings-row">
                <span>Grid</span>
                <span className="settings-value" aria-live="polite">
                  {shown.cols} × {shown.rows}
                </span>
              </div>
              {/* Press and drag across this field: the highlighted block is the grid. */}
              <div
                className="le-size-pad"
                role="slider"
                aria-label="Grid size"
                aria-valuetext={`${shown.cols} columns, ${shown.rows} rows`}
                aria-valuenow={shown.cols * shown.rows}
                tabIndex={0}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  padBox.current = e.currentTarget.getBoundingClientRect();
                  setSizing(sizeAt(e));
                }}
                onPointerMove={(e) => {
                  if (sizing) setSizing(sizeAt(e));
                }}
                onPointerUp={(e) => {
                  if (!sizing) return;
                  const s = sizeAt(e);
                  padBox.current = null;
                  setLayout((l) => resizeGrid(l, s.cols, s.rows));
                  setSizing(null);
                }}
                onPointerCancel={() => {
                  padBox.current = null;
                  setSizing(null);
                }}
                onKeyDown={(e) => {
                  const d = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[e.key];
                  if (!d) return;
                  e.preventDefault();
                  setLayout((l) => resizeGrid(l, l.cols + d[0], l.rows + d[1]));
                }}
              >
                {Array.from({ length: MAX_GRID * MAX_GRID }, (_, i) => {
                  const c = i % MAX_GRID;
                  const r = Math.floor(i / MAX_GRID);
                  return <i key={i} className={c < shown.cols && r < shown.rows ? 'is-on' : undefined} />;
                })}
              </div>
            </div>
          </section>

          <section className="le-main" aria-label="Arrangement">
            <div className="le-stage" style={{ '--aspect': aspect } as CSSProperties}>
              <div className="le-grid" style={{ '--cols': view.cols, '--rows': view.rows } as CSSProperties}>
                {Array.from({ length: view.rows * view.cols }, (_, i) => {
                  const cell = { row: Math.floor(i / view.cols), col: i % view.cols };
                  const id = occupant(view, cell);
                  const over = drag?.moved && drag.over && drag.over !== 'tray' && drag.over.row === cell.row && drag.over.col === cell.col;
                  return (
                    <div
                      key={i}
                      className={`le-cell${over ? ' is-over' : ''}${id ? ' is-full' : ''}`}
                      data-cell=""
                      data-row={cell.row}
                      data-col={cell.col}
                      aria-label={`Row ${cell.row + 1}, column ${cell.col + 1}${id ? `: ${byId.get(id)?.name}` : ', empty'}`}
                    >
                      {id && circle(id, 'cell')}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`le-tray${drag?.moved && drag.over === 'tray' ? ' is-over' : ''}`} data-tray="" aria-label="Not placed">
              {tray.length ? tray.map((id) => circle(id, 'tray')) : <span className="le-hint">Drag a circle here to take it off the grid.</span>}
            </div>

            <div className="le-tools">
              <button type="button" className="le-random" onClick={() => setLayout((l) => randomize(l))} disabled={!layout.ids.length}>
                <ShuffleIcon />
                <span>Randomize Layout</span>
              </button>
            </div>
            <p className="le-hint">Drag circles between cells. Cells can stay empty.</p>
          </section>
        </div>

        <footer className="le-foot">
          <button type="button" className="text-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="fs-show" onClick={() => onApply(layout, true)} disabled={layout.ids.length === tray.length}>
            Apply &amp; Show Fullscreen
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
