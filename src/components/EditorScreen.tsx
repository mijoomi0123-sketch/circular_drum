import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { audibleTime } from '../animation/clock';
import { DropletAnimator } from '../animation/droplet';
import { audioEngine } from '../audio/engine';
import { MAX_BPM, MAX_STEPS, MIN_BPM, MIN_STEPS, samePatterns, toggleStep } from '../audio/pattern';
import { transport, type PlaySettings } from '../audio/transport';
import { gradientFor } from '../presets/gradients';
import { useSettings } from '../storage/settingsStore';
import { CHANNELS } from '../audio/channels';
import type { Artwork, Channel, ColorId } from '../types';
import { ArtworkGraphic } from './ArtworkGraphic';
import { askConfirm } from './confirm';
import { enterFullscreenNow, FullscreenView } from './FullscreenView';
import { ArtworkMenu } from './ArtworkMenu';
import { BackIcon, FullscreenIcon, LoopIcon, PlayIcon, StopIcon } from './PlayIcons';
import { SampleNotice } from './SampleNotice';
import { SliderControl } from './SliderControl';
import { StepGrid } from './StepGrid';
import { useTransport } from './useTransport';

interface Props {
  artwork: Artwork;
  onBack: () => void;
  /** Stores the artwork; false when it could not be written. */
  onSave: (a: Artwork) => boolean;
  onRename: (name: string) => void;
  onDuplicate: (draft: Artwork) => void;
  onDelete: () => void;
}

type Settings = Pick<Artwork, 'colors' | 'bpm' | 'steps' | 'loop' | 'patterns'>;

function pickSettings(a: Artwork): Settings {
  return { colors: a.colors, bpm: a.bpm, steps: a.steps, loop: a.loop, patterns: a.patterns };
}

function sameSettings(a: Settings, b: Settings): boolean {
  return (
    CHANNELS.every((ch) => a.colors[ch] === b.colors[ch]) &&
    a.bpm === b.bpm &&
    a.steps === b.steps &&
    a.loop === b.loop &&
    samePatterns(a.patterns, b.patterns)
  );
}

export function EditorScreen({ artwork, onBack, onSave, onRename, onDuplicate, onDelete }: Props) {
  useSettings(); // re-render with the theme's palette (Dark Mode colors are more saturated)
  const [draft, setDraft] = useState<Settings>(() => pickSettings(artwork));
  const [renaming, setRenaming] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const state = useTransport();
  const playing = state.playing && state.owner === artwork.id && state.mode === 'edit';
  const animator = useMemo(() => new DropletAnimator(), []);
  const latestColors = useRef(draft.colors);

  // Route the scheduler's events into this artwork's animation, and stop
  // all sound when the screen closes. Opening never starts playback.
  useEffect(() => {
    transport.stop();
    const offEvent = transport.onEvent((e) => animator.push(e));
    const offStop = transport.onStop((hard) => {
      if (hard) animator.stop(audibleTime() ?? 0);
    });
    return () => {
      offEvent();
      offStop();
      transport.stop();
      animator.clear();
    };
  }, [animator]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const dirty = !sameSettings(draft, pickSettings(artwork));
  // Controls take the Kick color as their accent.
  const hex = gradientFor(draft.colors.kick).ink;

  const change = (patch: Partial<Settings>) => {
    setDraft((d) => ({ ...d, ...patch }));
    if (patch.bpm !== undefined) animator.setTempo(patch.bpm);
    if (!transport.isPlaying(artwork.id)) return;
    const { colors, ...rest } = patch;
    if (Object.keys(rest).length) transport.update(rest as Partial<PlaySettings>);
    if (colors) {
      latestColors.current = colors;
      // Load the newly picked sample first, then switch; BPM, steps, the
      // other instruments and the position in the pattern are untouched.
      void audioEngine.loadChannels(colors).then(() => {
        if (latestColors.current === colors && transport.isPlaying(artwork.id)) transport.update({ colors });
      });
    }
  };

  /** Flip one step of one instrument's row; the other rows are untouched. */
  const toggle = (ch: Channel, step: number) => change({ patterns: toggleStep(draft.patterns, ch, step) });

  /** Recolor one instrument (and switch its sample group); the others keep theirs. */
  const recolor = (ch: Channel, color: ColorId) => change({ colors: { ...draft.colors, [ch]: color } });

  const play = () => {
    latestColors.current = draft.colors;
    animator.setTempo(draft.bpm);
    void transport.start(artwork.id, 'edit', { ...draft });
  };

  const save = () => {
    // Back to the library only once the artwork is really stored; otherwise stay with the changes.
    if (onSave({ ...artwork, ...draft, color: draft.colors.kick })) onBack();
    else setToast('Could not save. Your changes are still here; try again.');
  };

  const back = async () => {
    if (dirty && !(await askConfirm('Leave without saving your changes?', 'Leave'))) return;
    onBack();
  };

  const style = { '--accent': hex } as CSSProperties;

  return (
    <main className="editor" style={style}>
      <header className="editor-bar">
        <button type="button" className="icon-btn" onClick={() => void back()} aria-label="Back to library" title="Library">
          <BackIcon />
        </button>
        {renaming ? (
          <form
            className="rename"
            onSubmit={(e) => {
              e.preventDefault();
              const v = new FormData(e.currentTarget).get('name');
              const name = typeof v === 'string' ? v.trim() : '';
              if (name) onRename(name);
              setRenaming(false);
            }}
          >
            <input
              name="name"
              defaultValue={artwork.name}
              maxLength={60}
              autoFocus
              aria-label="Artwork name"
              onBlur={(e) => e.currentTarget.form?.requestSubmit()}
              onKeyDown={(e) => e.key === 'Escape' && setRenaming(false)}
            />
          </form>
        ) : (
          <h1 className="title" onDoubleClick={() => setRenaming(true)}>
            {artwork.name}
          </h1>
        )}
        <div className="bar-right">
          <button type="button" className="icon-btn" onClick={() => {
              enterFullscreenNow();
              setFullscreen(true);
            }} aria-label="Fullscreen View" title="Fullscreen View">
            <FullscreenIcon />
          </button>
          {/* Always available: saving unchanged settings simply stores them again under the same id (never a copy). */}
          <button type="button" className="save-btn" onClick={save} aria-label="Save settings">
            Save
          </button>
          <ArtworkMenu
            onRename={() => setRenaming(true)}
            onDuplicate={() => onDuplicate({ ...artwork, ...draft, color: draft.colors.kick })}
            onDelete={onDelete}
          />
        </div>
      </header>

      <section className="stage" aria-label="Artwork">
        <ArtworkGraphic
          design={artwork.design}
          colors={draft.colors}
          patterns={draft.patterns}
          steps={draft.steps}
          animator={animator}
          className="stage-art"
          label={artwork.name}
        />
      </section>

      {fullscreen && (
        <FullscreenView label={`${artwork.name}, fullscreen`} onExit={() => setFullscreen(false)}>
          {/* Only this circle, as large as the screen allows; it keeps moving with the playback. */}
          <div className="fs-single">
            <ArtworkGraphic
              design={artwork.design}
              colors={draft.colors}
              patterns={draft.patterns}
              steps={draft.steps}
              animator={animator}
              className="fs-art"
              label={artwork.name}
            />
          </div>
        </FullscreenView>
      )}

      <section className="controls" aria-label="Controls">
        <div className="sliders">
          <SliderControl label="BPM" value={draft.bpm} min={MIN_BPM} max={MAX_BPM} accent={hex} onChange={(bpm) => change({ bpm })} />
          <SliderControl label="Steps" value={draft.steps} min={MIN_STEPS} max={MAX_STEPS} accent={hex} onChange={(steps) => change({ steps })} />
        </div>

        <StepGrid patterns={draft.patterns} colors={draft.colors} steps={draft.steps} onToggle={toggle} onRecolor={recolor} />

        <div className="transport">
          <button type="button" className={`round-btn primary${playing ? ' is-on' : ''}`} onClick={play} aria-label={playing ? 'Restart' : 'Play'} title="Play">
            <PlayIcon size={16} />
          </button>
          <button type="button" className="round-btn" onClick={() => transport.stop()} aria-label="Stop" title="Stop" disabled={!playing}>
            <StopIcon size={15} />
          </button>
          <button
            type="button"
            className={`round-btn${draft.loop ? ' is-on' : ''}`}
            onClick={() => change({ loop: !draft.loop })}
            aria-label="Loop"
            aria-pressed={draft.loop}
            title={draft.loop ? 'Loop on' : 'Loop off'}
          >
            <LoopIcon />
          </button>
        </div>
        <SampleNotice />
      </section>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </main>
  );
}
