import type { ColorId, ColorPreset } from '../types';

/**
 * The seven user-selectable colors. `groupNumber` ties a color to the sample
 * files whose filename starts with that number (01 = orange … 07 = brown).
 */
export const COLORS: readonly ColorPreset[] = [
  { id: 'orange', label: 'Orange', groupNumber: 1, hex: '#FFB771' },
  { id: 'yellow', label: 'Yellow', groupNumber: 2, hex: '#FEF49D' },
  { id: 'green', label: 'Green', groupNumber: 3, hex: '#ADF0E4' },
  { id: 'blue', label: 'Sky Blue', groupNumber: 4, hex: '#ADDBFB' },
  { id: 'pink', label: 'Pink', groupNumber: 5, hex: '#FBCAE3' },
  { id: 'purple', label: 'Purple', groupNumber: 6, hex: '#D6BEFC' },
  { id: 'brown', label: 'Brown', groupNumber: 7, hex: '#BA9784' },
];

export const COLOR_IDS: readonly ColorId[] = COLORS.map((c) => c.id);

export function getColor(id: ColorId): ColorPreset {
  const c = COLORS.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown color "${id}"`);
  return c;
}

export function colorForGroupNumber(n: number): ColorId | null {
  return COLORS.find((c) => c.groupNumber === n)?.id ?? null;
}

export function isColorId(v: unknown): v is ColorId {
  return typeof v === 'string' && (COLOR_IDS as readonly string[]).includes(v);
}
