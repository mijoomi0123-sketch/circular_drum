import { useSyncExternalStore } from 'react';
import { audioEngine } from '../audio/engine';
import { MISSING_SLOTS, SAMPLE_PROBLEMS } from '../audio/sampleMap';

/** Small, explicit report of samples that could not be used. */
export function SampleNotice() {
  const missing = useSyncExternalStore(
    (fn) => audioEngine.subscribe(fn),
    () => audioEngine.missing,
  );
  const problems = SAMPLE_PROBLEMS;
  if (missing.length === 0 && problems.length === 0 && MISSING_SLOTS.length === 0) return null;
  return (
    <div className="sample-notice" role="status">
      {missing.map((m) => (
        <div key={m.file}>
          Missing sample <code>{m.file}</code> ({m.color} {m.instrument}): {m.reason}. That sound stays silent.
        </div>
      ))}
      {MISSING_SLOTS.map((m) => (
        <div key={m.expected}>
          No file <code>{m.expected}</code> for {m.channel} on {m.color}. That combination stays silent.
        </div>
      ))}
      {problems.map((p) => (
        <div key={p.file}>
          Unassigned sample <code>{p.file}</code>: {p.reason}.
        </div>
      ))}
    </div>
  );
}
