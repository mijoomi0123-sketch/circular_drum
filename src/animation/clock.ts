import { audioEngine } from '../audio/engine';

/**
 * The audio time that is being *heard* right now, in AudioContext seconds.
 * Uses getOutputTimestamp() (which already accounts for output latency) and
 * interpolates with performance.now() so frames are smooth even though
 * currentTime advances in audio-block steps.
 */
export function audibleTime(): number | null {
  const ctx = audioEngine.context;
  if (!ctx) return null;
  if (typeof ctx.getOutputTimestamp === 'function') {
    const ts = ctx.getOutputTimestamp();
    if (ts.contextTime !== undefined && ts.performanceTime !== undefined && ts.performanceTime > 0) {
      return ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
    }
  }
  return ctx.currentTime - audioEngine.outputLatency();
}
