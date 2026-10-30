import type { CSSProperties, ReactNode } from 'react';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  display?: string;
  icon?: ReactNode;
  note?: string;
  accent: string;
  onChange: (v: number) => void;
}

/** A plain range slider (mouse, touch and keyboard all work natively). */
export function SliderControl({ label, value, min, max, step = 1, display, icon, note, accent, onChange }: Props) {
  const pct = ((value - min) / (max - min)) * 100;
  const style = { '--accent': accent, '--pct': `${pct}%` } as CSSProperties;
  return (
    <label className="slider" style={style}>
      <span className="slider-head">
        <span className="slider-label">
          {icon}
          {label}
          {note && <span className="slider-note">({note})</span>}
        </span>
        <span className="slider-value" aria-live="polite">{display ?? value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        title={note}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
      />
    </label>
  );
}
