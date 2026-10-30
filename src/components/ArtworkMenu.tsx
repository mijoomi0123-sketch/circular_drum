import { useEffect, useRef, useState } from 'react';
import { MoreIcon } from './PlayIcons';

interface Props {
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

/** Unobtrusive "…" menu holding the artwork management actions. */
export function ArtworkMenu({ onRename, onDuplicate, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className="menu" ref={ref}>
      <button type="button" className="icon-btn" aria-label="Artwork menu" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <MoreIcon />
      </button>
      {open && (
        <div className="menu-pop" role="menu">
          <button type="button" role="menuitem" onClick={run(onRename)}>Rename</button>
          <button type="button" role="menuitem" onClick={run(onDuplicate)}>Duplicate</button>
          <button type="button" role="menuitem" className="danger" onClick={run(onDelete)}>Delete</button>
        </div>
      )}
    </div>
  );
}
