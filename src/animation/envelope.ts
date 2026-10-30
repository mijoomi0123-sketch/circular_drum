/**
 * Hit envelope: 0 → crest (1) → rest (0) with no corners.
 *
 * Swell (0 ≤ τ < attack): half-cosine ease, starting and cresting with zero
 * velocity, so the expansion begins gently and crests softly.
 *
 * Return (τ ≥ attack), u = (τ − attack)/decay:
 * - spring = 0: critically damped, (1 + u)·e^(−u). Leaves the crest with
 *   zero velocity and glides back without overshoot, slowing as it arrives.
 * - spring > 0: lightly damped, e^(−u)·(cos ωu + sin ωu / ω). Also leaves the
 *   crest with zero velocity, then dips below rest by about `spring` of the
 *   crest once before settling. ω is chosen from `spring`.
 */
export function hitEnvelope(tau: number, attack: number, decay: number, spring = 0): number {
  if (tau <= 0) return 0;
  if (tau < attack) return 0.5 - 0.5 * Math.cos((Math.PI * tau) / attack);
  const u = (tau - attack) / decay;
  if (spring <= 0) return (1 + u) * Math.exp(-u);
  // Overshoot of a damped oscillator released from rest: e^(−π/ω). Solve ω.
  const w = Math.PI / -Math.log(spring);
  return Math.exp(-u) * (Math.cos(w * u) + Math.sin(w * u) / w);
}

/** Time after which the envelope is visually at rest (< 0.3 %). */
export function envelopeLength(attack: number, decay: number): number {
  return attack + decay * 9;
}

/** Soft limiter so many overlapping hits never blow the shape apart. */
export function softLimit(x: number, max: number): number {
  return max * Math.tanh(x / max);
}
