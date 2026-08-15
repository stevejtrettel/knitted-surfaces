/**
 * Arc-length resampling of strand polylines.
 *
 * Patterns sample their curves in the parameter of each cell-crossing, which is
 * not arc length: a segment that arches high above the surface gets the same
 * point count as a short flat one, so the polyline ends up dense where the curve
 * is slow and sparse exactly where it turns hardest. That unevenness shows up
 * twice — as faceting on the tube where points are sparse, and as banding in the
 * shading where they bunch — and it makes anything parameterized by distance
 * along the yarn (a ply's twist, a length-based colour) come out wrong.
 *
 * Resampling by arc length fixes all of that for the same point budget.
 */

import { Vector3 } from 'three';

/** Cumulative arc length at each point; the last entry is the total. */
export function arcLengths(points: Vector3[], closed: boolean): number[] {
  const out = [0];
  for (let i = 1; i < points.length; i++) out.push(out[i - 1] + points[i].distanceTo(points[i - 1]));
  if (closed && points.length > 1) {
    out.push(out[out.length - 1] + points[points.length - 1].distanceTo(points[0]));
  }
  return out;
}

/**
 * Resample a polyline to `count` points evenly spaced in arc length. Open curves
 * keep both endpoints exactly; closed ones are spaced around the full loop with
 * no duplicated seam point (the caller closes it).
 */
export function resampleByArcLength(points: Vector3[], count: number, closed: boolean): Vector3[] {
  const n = points.length;
  if (n < 2 || count < 2) return points.map((p) => p.clone());

  const cum = arcLengths(points, closed);
  const total = cum[cum.length - 1];
  if (!(total > 0)) return points.map((p) => p.clone());

  const at = (s: number): Vector3 => {
    // Binary search the segment containing arc length s.
    let lo = 0, hi = cum.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= s) lo = mid; else hi = mid;
    }
    const span = cum[lo + 1] - cum[lo];
    const t = span > 1e-12 ? (s - cum[lo]) / span : 0;
    const a = points[lo % n];
    const b = points[(lo + 1) % n];
    return new Vector3().lerpVectors(a, b, t);
  };

  const out: Vector3[] = [];
  const step = closed ? total / count : total / (count - 1);
  for (let i = 0; i < count; i++) out.push(at(Math.min(total, i * step)));
  if (!closed) out[out.length - 1] = points[n - 1].clone();
  return out;
}
