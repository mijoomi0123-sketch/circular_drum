import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type FsDocument = Document & { webkitFullscreenElement?: Element | null; webkitFullscreenEnabled?: boolean; webkitExitFullscreen?: () => void };
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => void };

const fsElement = () => document.fullscreenElement ?? (document as FsDocument).webkitFullscreenElement ?? null;

let host: HTMLDivElement | null = null;
/** The one element that goes fullscreen; fullscreen views render into it. */
function fsHost(): HTMLDivElement {
  if (!host) {
    host = document.createElement('div');
    host.className = 'fs-host';
    document.body.appendChild(host);
  }
  return host;
}

/**
 * Asks the browser for fullscreen. Call it directly in the click that opens a
 * fullscreen view: browsers only allow it during the user's own gesture.
 * Refused (e.g. inside an embedded page) is fine: the view still covers the
 * whole window.
 */
export function enterFullscreenNow() {
  const el = fsHost() as FsElement;
  const doc = document as FsDocument;
  if (fsElement() === el || !(doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled)) return;
  try {
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else el.webkitRequestFullscreen?.();
  } catch {
    /* refused: the window-filling view stays */
  }
}

function exitFullscreen() {
  if (fsElement() !== host) return;
  if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
  else (document as FsDocument).webkitExitFullscreen?.();
}

let openViews = 0;

/**
 * A view that fills the whole screen with only its children (the circles):
 * no bars, buttons or settings. Open it after `enterFullscreenNow()` in the
 * same click. ESC, or leaving browser fullscreen any other way, closes it.
 */
export function FullscreenView({ label, onExit, children }: { label: string; onExit: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const exitRef = useRef(onExit);
  exitRef.current = onExit;
  const [native, setNative] = useState(() => fsElement() === host);

  useEffect(() => {
    openViews++;
    // Real fullscreen may arrive a moment after the view opens; afterwards, leaving it (ESC in the browser) closes the view.
    let inside = fsElement() === host;
    const change = () => {
      if (fsElement() === host) {
        inside = true;
        setNative(true);
      } else if (inside) {
        inside = false;
        setNative(false);
        exitRef.current();
      }
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      exitRef.current();
    };
    document.addEventListener('fullscreenchange', change);
    document.addEventListener('webkitfullscreenchange', change);
    document.addEventListener('keydown', key, true);
    ref.current?.focus();
    return () => {
      openViews--;
      document.removeEventListener('fullscreenchange', change);
      document.removeEventListener('webkitfullscreenchange', change);
      document.removeEventListener('keydown', key, true);
      // Leave browser fullscreen only when no view remains (not on a remount of this one).
      window.setTimeout(() => {
        if (openViews === 0) exitFullscreen();
      }, 0);
    };
  }, []);

  return createPortal(
    <div ref={ref} className={`fs-view${native ? ' is-native' : ''}`} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
      {children}
    </div>,
    fsHost(),
  );
}
