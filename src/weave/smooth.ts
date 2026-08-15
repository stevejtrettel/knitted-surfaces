/**
 * Global strand smoothing.
 *
 * Once per-cell arcs are stitched into a whole strand, re-fair the polyline with
 * Chaikin corner-cutting: each round replaces every edge with points at its 1/4
 * and 3/4 marks, rounding off the kinks the per-cell curves leave at their joins
 * and over/under flips. It is contractive (provably reduces total turning) and
 * converges to a smooth quadratic B-spline, so the curve stays faithful to the
 * weave while losing the angularity. Each round ~doubles the point count, so a
 * couple of rounds is plenty. `iterations = 0` is a no-op.
 *
 * (A centripetal-Catmull-Rom resample was tried first but overshot at the
 * decimated controls and increased turning — Chaikin is the contractive choice.)
 */

import { Vector3 } from 'three';
import type { WeaveResult } from './types.ts';
import { resampleByArcLength } from './resample.ts';

/** One Chaikin corner-cutting round. Endpoints are pinned for open strands. */
function chaikin(points: Vector3[], closed: boolean): Vector3[] {
  const n = points.length;
  if (n < 3) return points;
  const out: Vector3[] = [];
  if (!closed) out.push(points[0].clone());
  const edges = closed ? n : n - 1;
  for (let i = 0; i < edges; i++) {
    const p = points[i];
    const q = points[(i + 1) % n];
    out.push(new Vector3().lerpVectors(p, q, 0.25));
    out.push(new Vector3().lerpVectors(p, q, 0.75));
  }
  if (!closed) out.push(points[n - 1].clone());
  return out;
}

/**
 * Subsample a (smooth) polyline down to ~`target` points, evenly in ARC LENGTH —
 * not by index. Chaikin leaves points bunched wherever the curve turned hardest,
 * and index-decimation preserves that bunching; spacing by distance spends the
 * point budget where the tube actually needs it (see `resample.ts`).
 */
function decimate(points: Vector3[], target: number, closed: boolean): Vector3[] {
  if (points.length <= target || target < 2) return points;
  return resampleByArcLength(points, target, closed);
}

/**
 * Smooth every strand with `iterations` Chaikin rounds, then decimate back to its
 * original point count — so more rounds give a smoother SHAPE at flat render cost
 * (Chaikin alone ~doubles points per round). Point counts are unchanged but the
 * positions move, so per-point radii are reset (the metric taper is reapplied
 * downstream against the new points).
 */
export function smoothStrands(result: WeaveResult, iterations: number): WeaveResult {
  if (iterations < 1) return result;
  const strands = result.strands.map((pts, i) => {
    const closed = result.strandClosed[i];
    let q = pts;
    for (let k = 0; k < iterations; k++) q = chaikin(q, closed);
    return decimate(q, pts.length, closed);
  });
  return { ...result, strands, strandRadii: strands.map(() => null) };
}
