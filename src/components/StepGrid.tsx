import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { audibleTime } from '../animation/clock';
import { CHANNEL_LABELS, CHANNELS } from '../audio/channels';
import { STEPS_PER_BEAT } from '../audio/pattern';
import { transport } from '../audio/transport';
import { audioEngine } from '../audio/engine';
import { getColor } from '../presets/colors';
import { gradientFor, swatchGradient } from '../presets/gradients';
import { useSettings } from '../storage/settingsStore';
import type { Channel, ChannelColors, ChannelPatterns, ColorId } from '../types';
import { ColorSwatches } from './ColorSwatches';
import { useTransport } from './useTransport';

interface Props {
  patterns: ChannelPatterns;
  colors: ChannelColors;
  steps: number;
  onToggle: (ch: Channel, step: number) => void;
  onRecolor: (ch: Channel, color: ColorId) => void;
}

/**
 * Four independent step rows (Kick, Snare, Hi-hat, Clap) sharing one
 * length and one clock. Each row carries its instrument's color: a swatch
 * button opens the seven colors for that instrument only. The playhead column is read from the scheduler's
 * step marks on the audio clock every frame, so it lines up with what is
 * heard and with the circles.
 */
export function StepGrid({ patterns, colors, steps, onToggle, onRecolor }: Props) {
  useSettings(); // re-render with the theme's palette (Dark Mode colors are more saturated)
  const state = useTransport();
  const [picking, setPicking] = useState<Channel | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state.playing || state.mode !== 'edit') return;
    let raf = 0;
    let shown: number | null = null;
    const mark = (step: number | null, on: boolean) => {
      if (step === null) return;
      gridRef.current?.querySelectorAll(`[data-step="${step}"]`).forEach((el) => el.classList.toggle('is-now', on));
    };
    const frame = () => {
      const t = audibleTime();
      const step = t === null ? null : transport.stepAt(t);
      if (step !== shown) {
        mark(shown, false);
        mark(step, true);
        shown = step;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      mark(shown, false);
    };
  }, [state.playing, state.mode]);

  const cols = Array.from({ length: steps }, (_, i) => i);
  const style = { '--steps': steps } as CSSProperties;

  return (
    <div className="step-grid" role="group" aria-label="Step patterns" ref={gridRef} style={style}>
      {CHANNELS.map((ch) => {
        const cymbal = audioEngine.sampleFor(ch, colors[ch])?.instrument === 'cymbal';
        const g = gradientFor(colors[ch]);
        const rowStyle = {
          '--row': g.ink,
          '--row-soft': g.light,
          '--row-glow': g.base,
          '--row-dot': swatchGradient(colors[ch]),
        } as CSSProperties;
        return (
          <div key={ch} className="step-row-wrap" data-row={ch} style={rowStyle}>
            <div className="step-row">
              <span className="step-label">
                <button
                  type="button"
                  className={`row-color${picking === ch ? ' is-open' : ''}`}
                  aria-label={`${CHANNEL_LABELS[ch]} color: ${getColor(colors[ch]).label}`}
                  aria-expanded={picking === ch}
                  data-color={colors[ch]}
                  onClick={() => setPicking((p) => (p === ch ? null : ch))}
                />
                <span className="row-name">{CHANNEL_LABELS[ch]}</span>
                {cymbal && <span className="row-note">(cymbal)</span>}
              </span>
              <div className="step-cells">
                {cols.map((i) => (
                  <button
                    key={i}
                    type="button"
                    data-step={i}
                    className={`step${patterns[ch][i] ? ' is-on' : ''}${i % STEPS_PER_BEAT === 0 ? ' beat' : ''}`}
                    aria-pressed={patterns[ch][i]}
                    aria-label={`${CHANNEL_LABELS[ch]} step ${i + 1}`}
                    onClick={() => onToggle(ch, i)}
                  />
                ))}
              </div>
            </div>
            {picking === ch && (
              <div className="row-picker">
                <ColorSwatches
                  label={`${CHANNEL_LABELS[ch]} color`}
                  value={colors[ch]}
                  onChange={(c) => {
                    onRecolor(ch, c);
                    setPicking(null);
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
