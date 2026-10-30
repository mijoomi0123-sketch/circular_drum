import type { CSSProperties } from 'react';
import { COLORS } from '../presets/colors';
import { gradientFor, swatchGradient } from '../presets/gradients';
import { useSettings } from '../storage/settingsStore';
import type { ColorId } from '../types';

interface Props {
  value: ColorId;
  onChange: (c: ColorId) => void;
  label?: string;
}

export function ColorSwatches({ value, onChange, label = 'Color' }: Props) {
  useSettings(); // re-render with the theme's palette (Dark Mode colors are more saturated)
  return (
    <div className="swatches" role="radiogroup" aria-label={label}>
      {COLORS.map((c) => (
        <button
          key={c.id}
          type="button"
          role="radio"
          aria-checked={value === c.id}
          aria-label={c.label}
          title={c.label}
          className={`swatch${value === c.id ? ' is-active' : ''}`}
          style={{ '--swatch': swatchGradient(c.id), '--swatch-ring': gradientFor(c.id).base } as CSSProperties}
          data-color={c.id}
          onClick={() => onChange(c.id)}
        />
      ))}
    </div>
  );
}
