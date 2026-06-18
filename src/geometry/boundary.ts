/**
 * Boundary-loop extraction for a polygonal mesh.
 *
 * A boundary edge belongs to exactly one face; chaining the boundary edges yields
 * the mesh's boundary components as ordered vertex loops. Used to frame open
 * surfaces (the three ends of a Costa surface, the single edge of a Möbius band)
 * with a ring, the same way `meta.diskRadius` frames the hyperbolic disk.
 */

import { Vector3 } from 'three';
import type { ParsedMesh } from './types.ts';

const key = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`);

/** Ordered position loops, one per boundary component (open meshes only). */
export function boundaryLoops(mesh: ParsedMesh): Vector3[][] {
  // Count incidences per undirected edge; count===1 ⇒ boundary edge.
  const count = new Map<string, number>();
  for (const f of mesh.faces) {
    for (let i = 0; i < f.length; i++) {
      const k = key(f[i], f[(i + 1) % f.length]);
      count.set(k, (count.get(k) ?? 0) + 1);
    }
  }

  // Adjacency among boundary vertices.
  const adj = new Map<number, number[]>();
  const link = (a: number, b: number) => { (adj.get(a) ?? adj.set(a, []).get(a)!).push(b); };
  for (const [k, c] of count) {
    if (c !== 1) continue;
    const [a, b] = k.split(',').map(Number);
    link(a, b); link(b, a);
  }

  // Walk loops, consuming each boundary edge once.
  const used = new Set<string>();
  const loops: Vector3[][] = [];
  for (const start of adj.keys()) {
    for (const first of adj.get(start)!) {
      if (used.has(key(start, first))) continue;
      const loop = [start];
      used.add(key(start, first));
      let prev = start, cur = first;
      while (cur !== start) {
        loop.push(cur);
        const next = adj.get(cur)!.find((n) => n !== prev && !used.has(key(cur, n)));
        if (next === undefined) break;
        used.add(key(cur, next));
        prev = cur; cur = next;
      }
      if (loop.length >= 3) loops.push(loop.map((i) => mesh.vertices[i]));
    }
  }
  return loops;
}

/** A planar circle: centre, unit axis, radius. */
export interface Circle { center: Vector3; normal: Vector3; radius: number; }

/**
 * The best-fit circle through a loop of co-planar points: the Newell-method plane
 * normal, then an algebraic (Kåsa) circle fit in that plane for the centre and
 * radius. The algebraic fit is essential because the points may be sampled very
 * non-uniformly around the circle (e.g. the Sudanese edge, stretched by the
 * stereographic projection): a centroid-and-mean-distance estimate would then sit
 * off-centre with the wrong radius. Apt because the boundaries we ring are circles.
 */
export function fitCircle(pts: Vector3[]): Circle {
  const n = pts.length;
  const centroid = new Vector3();
  for (const p of pts) centroid.add(p);
  centroid.multiplyScalar(1 / n);

  const normal = new Vector3();
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    normal.x += (a.y - b.y) * (a.z + b.z);
    normal.y += (a.z - b.z) * (a.x + b.x);
    normal.z += (a.x - b.x) * (a.y + b.y);
  }
  if (normal.lengthSq() < 1e-12) normal.set(0, 1, 0); else normal.normalize();

  // In-plane orthonormal basis.
  const e1 = new Vector3(1, 0, 0);
  if (Math.abs(normal.dot(e1)) > 0.9) e1.set(0, 1, 0);
  e1.addScaledVector(normal, -normal.dot(e1)).normalize();
  const e2 = new Vector3().crossVectors(normal, e1);

  // Kåsa fit on centroid-relative plane coords (so Σu = Σv = 0).
  const us: number[] = [], vs: number[] = [];
  let Suu = 0, Svv = 0, Suv = 0, Suuu = 0, Svvv = 0, Suvv = 0, Svuu = 0;
  const d = new Vector3();
  for (const p of pts) {
    d.subVectors(p, centroid);
    const u = d.dot(e1), v = d.dot(e2);
    us.push(u); vs.push(v);
    Suu += u * u; Svv += v * v; Suv += u * v;
    Suuu += u * u * u; Svvv += v * v * v; Suvv += u * v * v; Svuu += v * u * u;
  }
  const det = Suu * Svv - Suv * Suv;
  let uc = 0, vc = 0;
  if (Math.abs(det) > 1e-12) {
    const b1 = 0.5 * (Suuu + Suvv), b2 = 0.5 * (Svvv + Svuu);
    uc = (b1 * Svv - b2 * Suv) / det;
    vc = (Suu * b2 - Suv * b1) / det;
  }
  let radius = 0;
  for (let i = 0; i < n; i++) radius += Math.hypot(us[i] - uc, vs[i] - vc);
  radius /= n;
  const center = centroid.clone().addScaledVector(e1, uc).addScaledVector(e2, vc);
  return { center, normal, radius };
}
