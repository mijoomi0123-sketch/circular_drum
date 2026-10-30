import { useEffect, useRef, useSyncExternalStore } from 'react';

interface Request {
  message: string;
  confirmLabel: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
}

let current: Request | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

/**
 * In-page replacement for window.confirm(), which some embedded browsers
 * (and the in-app viewer) silently refuse.
 */
export function askConfirm(message: string, confirmLabel = 'OK', danger = false): Promise<boolean> {
  current?.resolve(false);
  return new Promise((resolve) => {
    current = { message, confirmLabel, danger, resolve };
    emit();
  });
}

function settle(ok: boolean) {
  const r = current;
  current = null;
  emit();
  r?.resolve(ok);
}

export function ConfirmHost() {
  const req = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
  );
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!req) return;
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && settle(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [req]);

  if (!req) return null;
  return (
    <div className="confirm-backdrop" onPointerDown={(e) => e.target === e.currentTarget && settle(false)}>
      <div className="confirm" role="alertdialog" aria-modal="true" aria-label={req.message}>
        <p>{req.message}</p>
        <div className="confirm-actions">
          <button type="button" className="confirm-cancel" onClick={() => settle(false)}>
            Cancel
          </button>
          <button type="button" ref={okRef} className={`confirm-ok${req.danger ? ' danger' : ''}`} onClick={() => settle(true)}>
            {req.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
