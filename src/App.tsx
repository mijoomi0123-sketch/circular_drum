import { useCallback, useEffect, useState } from 'react';
import { askConfirm, ConfirmHost } from './components/confirm';
import { EditorScreen } from './components/EditorScreen';
import { LibraryScreen, pageOf, showPage } from './components/LibraryScreen';
import { useHashRoute } from './components/useHashRoute';
import { transport } from './audio/transport';
import { createArtwork, duplicateArtwork, loadArtworks, saveArtworks } from './storage/artworkStore';
import type { Artwork } from './types';

export default function App() {
  const [artworks, setArtworks] = useState<Artwork[]>(() => loadArtworks());
  const [route, go] = useHashRoute();

  const commit = useCallback((next: Artwork[]) => {
    setArtworks(next);
    saveArtworks(next);
  }, []);

  // Any screen change stops sound: opening an artwork never auto-plays.
  useEffect(() => {
    transport.stop();
  }, [route]);

  const current = route.name === 'artwork' ? artworks.find((a) => a.id === route.id) : undefined;

  // Unknown id in the URL (e.g. deleted artwork): fall back to the library.
  useEffect(() => {
    if (route.name === 'artwork' && !current) go({ name: 'library' }, true);
  }, [route, current, go]);

  if (route.name === 'artwork' && current) {
    // Stored first; the library state follows only when the write succeeded.
    const update = (a: Artwork): boolean => {
      const next = artworks.map((x) => (x.id === a.id ? { ...a, updatedAt: Date.now() } : x));
      if (!saveArtworks(next)) return false;
      setArtworks(next);
      return true;
    };
    return (
      <>
      <EditorScreen
        key={current.id}
        artwork={current}
        onBack={() => go({ name: 'library' })}
        onSave={update}
        onRename={(name) => update({ ...current, name })}
        onDuplicate={(draft) => {
          const copy = duplicateArtwork(draft);
          const i = artworks.findIndex((x) => x.id === current.id);
          const next = [...artworks];
          next.splice(i + 1, 0, copy);
          commit(next);
          go({ name: 'artwork', id: copy.id });
        }}
        onDelete={async () => {
          if (!(await askConfirm(`Delete "${current.name}"? This cannot be undone.`, 'Delete', true))) return;
          setArtworks((list) => {
            const next = list.filter((x) => x.id !== current.id);
            saveArtworks(next);
            return next;
          });
          go({ name: 'library' }, true);
        }}
      />
      <ConfirmHost />
      </>
    );
  }

  return (
    <>
      <LibraryScreen
        artworks={artworks}
        onOpen={(id) => go({ name: 'artwork', id })}
        onCreate={() => {
          // Always a brand-new record appended at the end; nothing is overwritten.
          const a = createArtwork(artworks.length);
          commit([...artworks, a]);
          showPage(pageOf(artworks.length));
          go({ name: 'artwork', id: a.id });
        }}
        onDelete={(id) => commit(artworks.filter((x) => x.id !== id))}
      />
      <ConfirmHost />
    </>
  );
}
