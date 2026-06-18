/**
 * Clip assembled strands to a vertical "can" — keep only the parts inside a
 * cylinder of radius R, optionally bounded in height (|y| ≤ H). Where a strand
 * segment crosses the boundary the exact crossing point (and its interpolated
 * radius) is inserted, so the tube ends land precisely on the clip surface
 * rather than at the ragged mesh edge a spherical trim leaves behind.
 *
 * The border ring that frames each cut is traced separately, in the surface's
 * parameterization (see `costaBoundaryLoops`), so it rides the true smooth
 * surface rather than these mesh-discretized cut points.
 */

import { Vector3 } from 'three';
import type { WeaveResult } from './types.ts';

/** A vertical clip region: cylinder radius, and optional symmetric half-height. */
export interface ClipCan {
  radius: number;
  /** Half-height of the cap planes (|y| ≤ halfHeight). Omit for an infinite cylinder. */
  halfHeight?: number;
}

const rxz = (p: Vector3) => Math.hypot(p.x, p.z);

/** Crossing parameter t∈(0,1) where a→b meets the can boundary, given one endpoint
 *  is inside. Picks the first exit (a inside) or last entry (b inside). */
function crossingT(a: Vector3, b: Vector3, R: number, H: number | undefined, aInside: boolean): number {
  const ts: number[] = [];
  // Cylinder: |xz(t)|² = R²  →  quadratic A t² + 2B t + C = 0.
  const dx = b.x - a.x, dz = b.z - a.z;
  const A = dx * dx + dz * dz;
  const B = a.x * dx + a.z * dz;
  const C = a.x * a.x + a.z * a.z - R * R;
  if (A > 1e-12) {
    const disc = B * B - A * C;
    if (disc >= 0) {
      const s = Math.sqrt(disc);
      for (const t of [(-B - s) / A, (-B + s) / A]) if (t > 1e-9 && t < 1 - 1e-9) ts.push(t);
    }
  }
  // Caps: y = ±H.
  if (H !== undefined && Math.abs(b.y - a.y) > 1e-12) {
    for (const plane of [H, -H]) {
      const t = (plane - a.y) / (b.y - a.y);
      if (t > 1e-9 && t < 1 - 1e-9) ts.push(t);
    }
  }
  if (ts.length === 0) return aInside ? 1 : 0;
  return aInside ? Math.min(...ts) : Math.max(...ts);
}

export function clipStrands(input: WeaveResult, can: ClipCan): WeaveResult {
  const R = can.radius, H = can.halfHeight;
  const inside = (p: Vector3) => rxz(p) <= R + 1e-9 && (H === undefined || Math.abs(p.y) <= H + 1e-9);

  const strands: Vector3[][] = [];
  const strandRadii: (number[] | null)[] = [];
  const strandFamilies: WeaveResult['strandFamilies'] = [];
  const strandClosed: boolean[] = [];

  for (let i = 0; i < input.strands.length; i++) {
    const pts = input.strands[i];
    const rad = input.strandRadii[i];
    const fam = input.strandFamilies[i];
    const wasClosed = input.strandClosed[i];
    const flags = pts.map(inside);

    // Wholly inside: keep verbatim (a closed loop stays closed).
    if (flags.every(Boolean)) {
      strands.push(pts); strandRadii.push(rad); strandFamilies.push(fam); strandClosed.push(wasClosed);
      continue;
    }
    // Wholly outside: dropped.
    if (!flags.some(Boolean)) continue;

    const lerp = (a: Vector3, b: Vector3, t: number) => a.clone().lerp(b, t);
    const lerpR = (j: number, jn: number, t: number) =>
      rad ? rad[j] + (rad[jn] - rad[j]) * t : undefined;

    let run: Vector3[] | null = null;
    let runR: number[] | null = null;
    const open = () => { run = []; runR = rad ? [] : null; };
    const push = (p: Vector3, r: number | undefined) => { run!.push(p); if (runR && r !== undefined) runR.push(r); };
    const close = () => {
      if (run && run.length >= 2) {
        strands.push(run); strandRadii.push(runR); strandFamilies.push(fam); strandClosed.push(false);
      }
      run = null; runR = null;
    };

    const n = pts.length;
    const segs = wasClosed ? n : n - 1;
    for (let k = 0; k < segs; k++) {
      const j = k, jn = (k + 1) % n;
      const a = pts[j], b = pts[jn];
      if (flags[j]) { if (!run) open(); push(a, rad ? rad[j] : undefined); }
      if (flags[j] && !flags[jn]) {
        const t = crossingT(a, b, R, H, true);
        push(lerp(a, b, t), lerpR(j, jn, t)); close();
      } else if (!flags[j] && flags[jn]) {
        if (run) close(); open();
        const t = crossingT(a, b, R, H, false);
        push(lerp(a, b, t), lerpR(j, jn, t));
      }
    }
    // Tail point of an open strand whose last vertex is inside.
    if (!wasClosed && flags[n - 1] && run) push(pts[n - 1], rad ? rad[n - 1] : undefined);
    close();
  }

  return { strands, strandRadii, strandFamilies, strandClosed };
}
