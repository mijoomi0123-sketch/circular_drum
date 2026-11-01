import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { audibleTime } from '../animation/clock';
import { DropletAnimator } from '../animation/droplet';
import { SilentRhythm } from '../animation/silentRhythm';
import { audioEngine } from '../audio/engine';
import { Transport, transport } from '../audio/transport';
import { gradientFor } from '../presets/gradients';
import { updateSettings, useSettings } from '../storage/settingsStore';
import type { Artwork, ChannelColors } from '../types';
import type { CircleSettings } from './fullscreenLayout';
import { ArtworkGraphic } from './ArtworkGraphic';
import { FullscreenView } from './FullscreenView';
import { clickCircle, inGrid, oneSound, saveLayout, settingsOf, soundColors, type FullscreenLayout } from './fullscreenLayout';
import { GridFullscreenButton } from './GridFullscreen';
import { outerForm, playBoost } from './playEmphasis';
import { askConfirm } from './confirm';
import { AnimOffIcon, AnimOnIcon, PlusIcon } from './PlayIcons';
import { SampleNotice } from './SampleNotice';
import { SettingsMenu, VolumeMenu } from './SettingsPanel';
import { useTransport } from './useTransport';

interface Props {
  artworks: Artwork[];
  onOpen: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

/** Holding a finger on a circle this long shows its menu (touch screens have no hover). */
const LONG_PRESS_MS = 480;
/** 8 columns × 8 rows on desktop. */
export const PAGE_SIZE = 64;

/** Remembered while the app is open, so returning from an artwork keeps the page. */
let rememberedPage = 0;
/** Circles switched by their own Preview / Stop Preview since the last All Animations click (kept while the app is open). */
let rememberedMoving: Record<string, boolean> = {};

/**
 * The library: a full-screen gallery of artworks that move silently, each to
 * its own pattern and tempo exactly as in the editor.
 *
 * - Hover (mouse) or keyboard focus: shows a small menu on that circle —
 *   Preview / Stop Preview (loops its own beat until stopped), Stop/Resume
 *   Animation and Delete. Hovering alone never plays sound.
 * - Click, tap or Enter: opens the circle in the editor.
 * - Touch: press and hold shows the menu.
 * - Keyboard: Tab moves from a circle into its menu; Space starts or stops
 *   the focused circle's preview.
 * - The icons at the bottom open the global settings and Fullscreen View.
 */
export function LibraryScreen({ artworks, onOpen, onCreate, onDelete }: Props) {
  // The theme's palette, and the saved All Animations switch.
  const { animations } = useSettings();
  const state = useTransport();
  /**
   * A circle's own Preview / Stop Preview, by id, over the All Animations
   * switch: a circle moves when its own choice says so, otherwise when All
   * Animations is on. All Animations clears every own choice, so it always
   * reaches every circle. (Fullscreen keeps its own per-circle settings.)
   */
  const [moving, setMovingState] = useState<Record<string, boolean>>(() => rememberedMoving);
  const setMoving = (next: Record<string, boolean>) => {
    rememberedMoving = next;
    setMovingState(next);
  };
  // The previewed artwork's forms follow the preview's real sound events.
  const [animatedId, setAnimatedId] = useState<string | null>(null);
  /** Menu held open by a long press on a touch screen (mouse and keyboard show it by hover / focus). */
  const [held, setHeld] = useState<string | null>(null);
  /** The circles (and grid) shown in fullscreen while it is open. */
  const [full, setFull] = useState<FullscreenLayout | null>(null);
  /** All Animations Off: holds every circle still without changing any circle's own setting. */
  const allStill = !animations;
  const pageCount = Math.max(1, Math.ceil(artworks.length / PAGE_SIZE));
  const [page, setPage] = useState(() => Math.min(rememberedPage, pageCount - 1));
  const shown = artworks.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const press = useRef<{ timer?: number; long: boolean; space: boolean }>({ long: false, space: false });

  // The previewed thumbnail swells with its own instruments, like the editor.
  const animator = useMemo(() => new DropletAnimator(), []);
  useEffect(() => {
    const offEvent = transport.onEvent((e) => animator.push(e));
    const offStop = transport.onStop((hard) => {
      if (hard) animator.stop(audibleTime() ?? 0);
    });
    return () => {
      offEvent();
      offStop();
      animator.clear();
      window.clearTimeout(press.current.timer);
      transport.stop(); // leaving the library never leaves a preview playing
    };
  }, [animator]);

  useEffect(() => {
    rememberedPage = page;
  }, [page]);

  useEffect(() => {
    if (page > pageCount - 1) setPage(pageCount - 1);
  }, [page, pageCount]);

  const startPreview = useCallback(
    (a: Artwork, cycles: number) => {
      animator.clear();
      animator.setTempo(a.bpm);
      setAnimatedId(a.id);
      void transport.start(a.id, 'preview', { colors: a.colors, bpm: a.bpm, steps: a.steps, loop: false, patterns: a.patterns }, cycles);
    },
    [animator],
  );

  const stopPreview = (id: string) => {
    if (transport.isPlaying(id)) transport.stop();
  };

  // Preview loops the circle's own pattern until Stop Preview (or leaving the
  // library), and its forms move with that sound from the first hit: sound and
  // animation start and stop together. The one transport plays one thing at a
  // time, so starting another circle's preview stops this one first: never two loops.
  const isMoving = (id: string) => (state.playing && state.owner === id) || (moving[id] ?? !allStill);
  // Stop Preview stills this circle (and silences it if it was the one sounding);
  // Preview moves it with its own sound. Other circles are never touched.
  const togglePreview = (a: Artwork) => {
    if (isMoving(a.id)) {
      if (transport.isPlaying(a.id)) transport.stop();
      setMoving({ ...moving, [a.id]: false });
    } else {
      setMoving({ ...moving, [a.id]: true });
      startPreview(a, Infinity);
    }
  };

  // A held (touch) menu closes on a touch elsewhere or Escape.
  useEffect(() => {
    if (!held) return;
    const outside = (e: PointerEvent) => {
      if (!(e.target as Element).closest?.(`[data-artwork-id="${CSS.escape(held)}"] .cell-menu`)) setHeld(null);
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setHeld(null);
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', key);
    };
  }, [held]);

  const remove = async (a: Artwork) => {
    const ok = await askConfirm(
      `Delete “${a.name}”? Only this circle is removed from the library; the others stay. This cannot be undone.`,
      'Delete',
      true,
    );
    if (!ok) return;
    stopPreview(a.id);
    onDelete(a.id);
  };

  return (
    <main className="library">
      <div className="library-scroll">
        <div className="lib-volume">
          <VolumeMenu />
        </div>
        <div className="lib-actions">
          <SettingsMenu />
          <button
            type="button"
            className={`add-btn anim-btn${allStill ? ' is-off' : ''}`}
            aria-pressed={!allStill}
            aria-label={allStill ? 'All Animations Off. Turn on' : 'All Animations On. Turn off'}
            title={allStill ? 'All Animations Off' : 'All Animations On'}
            onClick={() => {
              // Every circle follows: On moves them all, Off stills them all (a sounding preview stops too). Saved.
              if (!allStill) transport.stop();
              setMoving({});
              updateSettings({ animations: allStill });
            }}
          >
            {allStill ? <AnimOffIcon /> : <AnimOnIcon />}
          </button>
        </div>

        {artworks.length === 0 && <p className="empty">No artworks yet. Press + to make one.</p>}

        <ul className="grid" aria-label="Artworks">
          {shown.map((a) => {
            const playing = state.playing && state.owner === a.id;
            // A sounding preview always moves with its sound; otherwise the circle's own
            // Preview / Stop Preview, or else All Animations, decides.
            const isPaused = !(playing && animatedId === a.id) && !isMoving(a.id);
            return (
              <li key={a.id} className={`cell${held === a.id ? ' is-held' : ''}`} data-artwork-id={a.id}>
                <div className="frame" style={{ '--scale': a.design.scale, '--accent': gradientFor(a.colors.kick).ink } as CSSProperties}>
                  <button
                    type="button"
                    className={`thumb${playing ? ' is-previewing' : ''}`}
                    aria-label={`Edit ${a.name}`}
                    aria-description="Space to hear it"
                    data-paused={isPaused || undefined}
                    onPointerDown={(e) => {
                      const p = press.current;
                      p.long = false;
                      window.clearTimeout(p.timer);
                      if (e.pointerType === 'touch') {
                        p.timer = window.setTimeout(() => {
                          p.long = true;
                          setHeld(a.id);
                        }, LONG_PRESS_MS);
                      }
                    }}
                    onPointerUp={() => window.clearTimeout(press.current.timer)}
                    onPointerCancel={() => window.clearTimeout(press.current.timer)}
                    onContextMenu={(e) => {
                      // Long press on touch screens: keep the browser's own menu away.
                      e.preventDefault();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === ' ') press.current.space = true;
                    }}
                    onClick={() => {
                      const p = press.current;
                      if (p.long) {
                        p.long = false; // the hold showed the menu instead
                        return;
                      }
                      if (p.space) {
                        p.space = false;
                        togglePreview(a);
                        return;
                      }
                      onOpen(a.id);
                    }}
                  >
                    <LibraryArt artwork={a} paused={isPaused || full !== null} preview={playing && animatedId === a.id ? animator : undefined} />
                  </button>
                  {/* The circle's title, shown just above it while the pointer rests on it. */}
                  <span className="cell-title" aria-hidden="true">
                    {a.name}
                  </span>
                  {/* Shown on hover, keyboard focus or a long press; a sibling of the circle, so its clicks never open the editor. */}
                  <div className="cell-menu" role="group" aria-label={`${a.name} options`}>
                    <button
                      type="button"
                      className={isMoving(a.id) ? 'is-active' : undefined}
                      aria-pressed={isMoving(a.id)}
                      onClick={() => {
                        togglePreview(a);
                        setHeld(null);
                      }}
                    >
                      {isMoving(a.id) ? 'Stop Preview' : 'Preview'}
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        setHeld(null);
                        void remove(a);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {pageCount > 1 && (
          <nav className="pager" aria-label="Library pages">
            {Array.from({ length: pageCount }, (_, i) => (
              <button
                key={i}
                type="button"
                className={`page-btn${i === page ? ' is-active' : ''}`}
                aria-current={i === page ? 'page' : undefined}
                aria-label={`Page ${i + 1}`}
                onClick={() => setPage(i)}
              >
                {i + 1}
              </button>
            ))}
          </nav>
        )}
        <SampleNotice />
      </div>

      <footer className="library-foot">
        <button type="button" className="add-btn new-btn" onClick={onCreate} aria-label="New artwork" title="New artwork">
          <PlusIcon size={18} />
        </button>
        <GridFullscreenButton
          artworks={artworks}
          onShow={(layout) => {
            // One sound at a time: a circle saved with Sound On takes over from a running preview;
            // with none, the preview keeps playing.
            const one = oneSound(layout);
            if (one.ids.some((id) => settingsOf(one, id).audible)) transport.stop();
            setFull(one);
          }}
        />
      </footer>

      {full && (
        <FullscreenGrid
          artworks={artworks}
          layout={full}
          onToggle={(id) => {
            // One sound at a time in fullscreen: a preview carried over from the library stops too.
            transport.stop();
            setFull((l) => {
              if (!l) return l;
              const next = clickCircle(l, id);
              saveLayout(next); // kept by circle id, for every later fullscreen
              return next;
            });
          }}
          preview={state.playing && state.mode === 'preview' ? { id: state.owner!, animator } : null}
          onExit={() => setFull(null)}
        />
      )}

    </main>
  );
}

/**
 * The composed fullscreen: each chosen circle in the exact cell it was given
 * (empty cells stay empty). The grid only places them; every glow spills
 * freely into its neighbours, so no cell edges show. A preview started in the
 * library keeps playing here, untouched, with its own Stop Preview control.
 */
function FullscreenGrid({
  artworks,
  layout,
  onToggle,
  preview,
  onExit,
}: {
  artworks: Artwork[];
  layout: FullscreenLayout;
  onToggle: (id: string) => void;
  preview: { id: string; animator: DropletAnimator } | null;
  onExit: () => void;
}) {
  const placed = artworks.filter((a) => layout.ids.includes(a.id) && inGrid(layout, layout.cells[a.id]));
  // Every circle's sound is fetched and decoded as soon as the view opens (and again for a new theme),
  // so a click starts its animation and sound together at once, even on a slow connection.
  const { theme } = useSettings();
  const soundKey = placed.map((a) => `${a.id}:${CHANNEL_KEYS.map((ch) => soundColors(a, settingsOf(layout, a.id).sound)[ch]).join()}`).join('|');
  useEffect(() => {
    void audioEngine.preload(placed.map((a) => soundColors(a, settingsOf(layout, a.id).sound)));
  }, [soundKey, theme]);
  const previewName = preview ? artworks.find((a) => a.id === preview.id)?.name : null;
  // The Stop Preview control appears while the pointer moves, then fades so only the circles remain.
  const [awake, setAwake] = useState(true);
  useEffect(() => {
    let t = window.setTimeout(() => setAwake(false), 2600);
    const wake = () => {
      setAwake(true);
      window.clearTimeout(t);
      t = window.setTimeout(() => setAwake(false), 2600);
    };
    window.addEventListener('pointermove', wake);
    window.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', wake);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', wake);
    };
  }, []);
  return (
    <FullscreenView label={`${placed.length} circles`} onExit={onExit}>
      <div className="fs-grid" style={{ '--cols': layout.cols, '--rows': layout.rows } as CSSProperties}>
        {placed.map((a) => {
          const c = layout.cells[a.id];
          return (
            <div key={a.id} className="fs-cell" data-artwork-id={a.id} style={{ gridRow: c.row + 1, gridColumn: c.col + 1 }}>
              <FullscreenCircle
                artwork={a}
                settings={settingsOf(layout, a.id)}
                preview={preview?.id === a.id ? preview.animator : undefined}
                onToggle={() => onToggle(a.id)}
              />
            </div>
          );
        })}
      </div>
      {preview && (
        <button
          type="button"
          className={`fs-stop-preview${awake ? '' : ' is-asleep'}`}
          onClick={() => transport.stop()}
          onFocus={() => setAwake(true)}
        >
          Stop Preview{previewName ? ` · ${previewName}` : ''}
        </button>
      )}
    </FullscreenView>
  );
}

/**
 * One circle in the composed fullscreen. Clicking it (or Enter / Space)
 * switches it on (it moves and plays its beat, taking the one sound from any
 * other circle) or off again (still and silent); other circles keep moving.
 * Its sound runs on its own player. While that player is really playing, the
 * circle grows around its own centre (small circles more, large ones less, see
 * playEmphasis.ts), gets a soft halo in its own outer color and a slightly
 * brighter centre; all of it goes the moment the sound stops or moves on.
 * The Library's All Animations switch does not apply here: each circle is its own control.
 */
function FullscreenCircle({
  artwork: a,
  settings,
  preview,
  onToggle,
}: {
  artwork: Artwork;
  settings: CircleSettings;
  preview?: DropletAnimator;
  onToggle: () => void;
}) {
  const voice = useMemo(() => ({ player: new Transport(), animator: new DropletAnimator() }), []);
  useEffect(() => {
    const offEvent = voice.player.onEvent((e) => voice.animator.push(e));
    const offStop = voice.player.onStop((hard) => {
      if (hard) voice.animator.stop(audibleTime() ?? 0);
    });
    return () => {
      offEvent();
      offStop();
      voice.player.stop();
      voice.animator.clear();
    };
  }, [voice]);

  // One player per circle; a new beat or sound group restarts it, never stacks a second loop.
  const beat = `${a.bpm}|${a.steps}|${CHANNEL_KEYS.map((ch) => a.patterns[ch].slice(0, a.steps).map(Number).join('')).join('|')}|${settings.sound}|${CHANNEL_KEYS.map((ch) => a.colors[ch]).join()}`;
  useEffect(() => {
    if (!settings.audible) return;
    voice.animator.clear();
    voice.animator.setTempo(a.bpm);
    void voice.player.start(a.id, 'preview', { colors: soundColors(a, settings.sound), bpm: a.bpm, steps: a.steps, loop: false, patterns: a.patterns }, Infinity);
    return () => voice.player.stop();
  }, [settings.audible, beat]);

  // The real playback state of this circle's own player, not its setting or animation.
  const sounding = useSyncExternalStore(voice.player.subscribe, voice.player.getState).playing;
  const outer = outerForm(a);
  const emphasis = {
    '--boost': playBoost(outer.r).toFixed(5),
    '--halo': gradientFor(a.colors[outer.zone]).base,
    '--core': `${((outer.r / 200) * 55).toFixed(1)}%`,
  } as CSSProperties;

  return (
    <div
      className={`fs-hit${sounding ? ' is-sounding' : ''}`}
      style={emphasis}
      role="button"
      tabIndex={0}
      aria-label={`${a.name}: ${settings.animate ? 'on' : 'off'}${sounding ? ', playing' : ''}`}
      aria-pressed={settings.animate}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        onToggle();
      }}
    >
      <LibraryArt
        artwork={a}
        // Fullscreen follows only each circle's own setting: the Library's All Animations never reaches it.
        paused={!settings.animate}
        preview={settings.audible ? voice.animator : preview}
        sounds={soundColors(a, settings.sound)}
        // Circles that move without sound move a little less, so the playing one stands out.
        silentMotion={FS_SILENT_MOTION}
        className="fs-art"
      />
    </div>
  );
}

/**
 * One library thumbnail. It moves from the moment it is shown, exactly as in
 * the editor (its own steps, tempo and per-instrument motion), but silently.
 * While its preview plays, the forms follow the real sound instead.
 */
function LibraryArt({
  artwork: a,
  paused,
  preview,
  sounds,
  silentMotion = 1,
  className = 'thumb-art',
}: {
  artwork: Artwork;
  paused: boolean;
  preview?: DropletAnimator;
  sounds?: ChannelColors;
  /** How strongly it moves while following its silent rhythm (Fullscreen calms these so the playing one stands out). */
  silentMotion?: number;
  className?: string;
}) {
  const key = `${a.bpm}|${a.steps}|${CHANNEL_KEYS.map((ch) => a.patterns[ch].slice(0, a.steps).map(Number).join('')).join('|')}`;
  const soundKey = CHANNEL_KEYS.map((ch) => (sounds ?? a.colors)[ch]).join();
  const rhythm = useMemo(
    () => new SilentRhythm({ patterns: a.patterns, steps: a.steps, bpm: a.bpm, colors: a.colors, sounds }),
    [key, a.colors, soundKey],
  );
  const moving = !paused && !preview;
  // The silent rhythm reads each hit's loudness from the real sample, exactly as playback does,
  // so the samples are fetched and decoded (never played) as soon as the circle moves.
  const { theme } = useSettings();
  useEffect(() => {
    if (moving) void audioEngine.preload([sounds ?? a.colors]);
  }, [moving, soundKey, theme]);
  // A stopped circle follows nothing: not its silent rhythm and not a preview's sound,
  // so it holds its exact rest shape while the preview keeps playing.
  const drive = paused ? undefined : (preview ?? rhythm);
  useEffect(() => {
    if (!moving) return;
    rhythm.start();
    return () => rhythm.halt();
  }, [rhythm, moving]);
  return (
    <ArtworkGraphic
      design={a.design}
      colors={a.colors}
      patterns={a.patterns}
      steps={a.steps}
      className={className}
      idle
      paused={paused}
      animator={drive}
      motion={moving ? silentMotion : 1}
    />
  );
}

const CHANNEL_KEYS = ['kick', 'snare', 'hihat', 'clap'] as const;

/** Fullscreen: motion of a circle that animates without playing, relative to a playing one. */
const FS_SILENT_MOTION = 0.7;

/** Page on which the artwork at `index` appears. */
export function pageOf(index: number): number {
  return Math.floor(index / PAGE_SIZE);
}

export function showPage(page: number) {
  rememberedPage = page;
}
