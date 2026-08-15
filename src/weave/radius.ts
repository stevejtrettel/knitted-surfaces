/**
 * Bake the width field into a WeaveResult's per-point radii.
 *
 * This is the seam that turns fixed-width tubes into variable-width ones: the
 * connectivity and the curve geometry are untouched, only the swept radius
 * changes. Everything that varies the yarn — the conformal cell-scale blend, a
 * geometry's metric taper — is already composed inside the `WidthField` (see
 * `width.ts`), so there is exactly one place where "how thick is the yarn here"
 * is decided, and the patterns' crossing lifts read the same answer.
 *
 * A pattern that set its own per-point radius keeps its shape: that radius is
 * treated as the local base and scaled by the field's *relative* factor, so a
 * pattern-authored taper survives on top of the geometry's.
 */

import type { WeaveResult } from './types.ts';
import type { WidthField } from './width.ts';

/** Return a copy of `result` whose per-point radius comes from `width`. */
export function applyWidth(result: WeaveResult, width: WidthField): WeaveResult {
  const base = width.base > 0 ? width.base : 1;
  const strandRadii = result.strands.map((pts, i) => {
    const existing = result.strandRadii[i];
    return pts.map((p, j) => {
      const w = width(p);
      const own = existing?.[j];
      return own !== undefined && Number.isFinite(own) ? own * (w / base) : w;
    });
  });
  return { ...result, strandRadii };
}
