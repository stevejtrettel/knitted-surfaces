/**
 * Bake a geometry's metric radius falloff into a WeaveResult's per-point radii.
 *
 * This is the seam that turns the fixed-width tubes into variable-width ones: the
 * connectivity and curve geometry are untouched, only the swept radius changes.
 * It composes — the falloff multiplies onto whatever per-point radius a pattern
 * already set (else the base radius), so a future weaving-density field can stack
 * on top of the hyperbolic taper.
 */

import type { WeaveResult } from './types.ts';
import type { RadiusField } from '../geometry/types.ts';

/**
 * Return a copy of `result` whose per-point radius is `base · field(point)`,
 * where `field` is the geometry's metric scale factor ∈ [0,1] and `base` is the
 * point's existing per-point radius if it has one, else `baseRadius`. The falloff
 * is the metric itself — no shaping knobs — so tubes have constant intrinsic width.
 */
export function applyRadiusTaper(
  result: WeaveResult,
  field: RadiusField,
  baseRadius: number,
): WeaveResult {
  const strandRadii = result.strands.map((pts, i) => {
    const existing = result.strandRadii[i];
    return pts.map((p, j) => {
      const base = existing && Number.isFinite(existing[j]) ? existing[j] : baseRadius;
      return base * field(p);
    });
  });
  return { ...result, strandRadii };
}
