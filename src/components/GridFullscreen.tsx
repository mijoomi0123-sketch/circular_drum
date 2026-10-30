import { useState } from 'react';
import type { Artwork } from '../types';
import { loadLayout, saveLayout, type FullscreenLayout } from './fullscreenLayout';
import { LayoutEditor } from './LayoutEditor';
import { enterFullscreenNow } from './FullscreenView';
import { FullscreenIcon } from './PlayIcons';

/**
 * The library's Fullscreen View button (beside Settings). It opens the layout
 * editor; Apply keeps the composition (remembered for next time), and
 * Apply & Show Fullscreen also opens it.
 */
export function GridFullscreenButton({ artworks, onShow }: { artworks: Artwork[]; onShow: (layout: FullscreenLayout) => void }) {
  const [editing, setEditing] = useState<FullscreenLayout | null>(null);
  return (
    <div className="settings">
      <button
        type="button"
        className="settings-btn"
        aria-label="Fullscreen View"
        title="Fullscreen View"
        aria-haspopup="dialog"
        aria-expanded={!!editing}
        onClick={() =>
          setEditing(
            loadLayout(
              artworks.map((a) => a.id),
              window.innerWidth / Math.max(1, window.innerHeight),
            ),
          )
        }
      >
        <FullscreenIcon />
      </button>
      {editing && (
        <LayoutEditor
          artworks={artworks}
          initial={editing}
          onCancel={() => setEditing(null)}
          onApply={(layout, show) => {
            saveLayout(layout);
            setEditing(null);
            if (show) {
              enterFullscreenNow(); // inside the click, as browsers require
              onShow(layout);
            }
          }}
        />
      )}
    </div>
  );
}
