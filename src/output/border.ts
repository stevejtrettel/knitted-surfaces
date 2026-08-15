/**
 * The border: the ring that finishes an open edge of the fabric.
 *
 * A woven or knitted piece is never just cut off — the edge is bound, hemmed, or
 * run onto a rail — and an unbound edge is what makes an otherwise good render
 * look unfinished. The border is that rail.
 *
 * It comes out as a `WeaveResult`, i.e. as ordinary strands, which is the whole
 * point of this module: it then goes through the same tube builder as the fabric,
 * so it gets the same rotation-minimizing sweep and rounded ends, appears in OBJ
 * exports (it previously did not — it was raw `TorusGeometry` built in the studio
 * and invisible to the exporter), and can be given its own material by handing
 * the tube builder a different one.
 *
 * Four sources of a border, in precedence order — the first three are declared by
 * a geometry that knows something we can't recover from the mesh, and the last is
 * the general case:
 *
 *  1. `meta.diskRadius` — the hyperbolic disk's own boundary circle, which is not
 *     a mesh edge at all but the edge of the model.
 *  2. `meta.boundaryCurves` — loops traced in the surface's own parameterization
 *     (Costa's three ends), smoother than anything the discretized mesh knows.
 *  3. `meta.boundaryRings` — a boundary that IS a circle (the Sudanese Möbius
 *     band's single edge), best drawn as the exact fitted circle.
 *  4. Otherwise: every boundary loop of the mesh, offset inward along the surface
 *     and smoothed — so any open mesh gets a border for free.
 */

import { Vector3 } from 'three';
import type { Geometry, ParsedMesh } from '../geometry/types.ts';
import type { WeaveResult } from '../weave/types.ts';
import { boundaryIndexLoops, fitCircle, type Circle } from '../geometry/boundary.ts';
import { catmullRom } from '../weave/splines.ts';

export interface BorderOptions {
  /** Pull the ring this far in from the true edge, along the surface. */
  inset?: number;
  /** Samples per boundary edge when smoothing a mesh loop. Default 4. */
  smoothness?: number;
  /** Segments around a circular border. Default 256. */
  circleSegments?: number;
}

/** Sample a circle as a closed polyline in its own plane. */
function circlePolyline(c: Circle, segments: number): Vector3[] {
  const e1 = new Vector3(1, 0, 0);
  if (Math.abs(c.normal.dot(e1)) > 0.9) e1.set(0, 1, 0);
  e1.addScaledVector(c.normal, -c.normal.dot(e1)).normalize();
  const e2 = new Vector3().crossVectors(c.normal, e1);
  const pts: Vector3[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(c.center.clone().addScaledVector(e1, Math.cos(a) * c.radius).addScaledVector(e2, Math.sin(a) * c.radius));
  }
  return pts;
}

/** Closed Catmull-Rom through a loop of points. */
function smoothLoop(loop: Vector3[], samplesPerSpan: number): Vector3[] {
  const m = loop.length;
  if (m < 3 || samplesPerSpan <= 1) return loop.map((p) => p.clone());
  const pts: Vector3[] = [];
  for (let i = 0; i < m; i++) {
    const p0 = loop[(i - 1 + m) % m], p1 = loop[i], p2 = loop[(i + 1) % m], p3 = loop[(i + 2) % m];
    for (let s = 0; s < samplesPerSpan; s++) pts.push(catmullRom(p0, p1, p2, p3, s / samplesPerSpan));
  }
  return pts;
}

/**
 * Inward direction at each vertex of a boundary loop: for every boundary edge,
 * the in-surface direction from the edge toward the centre of the face it belongs
 * to; averaged at the shared vertices. Taken from the face rather than from a
 * normal cross-product so it stays correct on non-orientable meshes, where face
 * winding does not agree across the surface.
 */
function inwardDirections(mesh: ParsedMesh, loop: number[]): Vector3[] {
  // directed edge (a,b) → face centroid, for finding each boundary edge's face
  const centroidOf = new Map<string, Vector3>();
  for (const f of mesh.faces) {
    const c = new Vector3();
    for (const i of f) c.add(mesh.vertices[i]);
    c.multiplyScalar(1 / f.length);
    for (let i = 0; i < f.length; i++) centroidOf.set(`${f[i]},${f[(i + 1) % f.length]}`, c);
  }

  const m = loop.length;
  const perEdge: Vector3[] = [];
  for (let i = 0; i < m; i++) {
    const a = loop[i], b = loop[(i + 1) % m];
    const pa = mesh.vertices[a], pb = mesh.vertices[b];
    const centroid = centroidOf.get(`${a},${b}`) ?? centroidOf.get(`${b},${a}`);
    const mid = new Vector3().addVectors(pa, pb).multiplyScalar(0.5);
    const dir = new Vector3().subVectors(pb, pa);
    const inward = centroid ? new Vector3().subVectors(centroid, mid) : new Vector3();
    if (dir.lengthSq() > 1e-20) {
      dir.normalize();
      inward.addScaledVector(dir, -inward.dot(dir)); // keep only the across-edge part
    }
    perEdge.push(inward.lengthSq() > 1e-20 ? inward.normalize() : new Vector3());
  }

  return loop.map((_, i) => {
    const v = new Vector3().add(perEdge[(i - 1 + m) % m]).add(perEdge[i]);
    return v.lengthSq() > 1e-20 ? v.normalize() : v;
  });
}

/** Build the border strands for a geometry, or null if it has no edge to bind. */
export function buildBorder(geometry: Geometry, opts: BorderOptions = {}): WeaveResult | null {
  const inset = opts.inset ?? 0;
  const smoothness = Math.max(1, opts.smoothness ?? 4);
  const circleSegments = opts.circleSegments ?? 256;

  const loops: Vector3[][] = [];
  const diskRadius = geometry.meta?.diskRadius as number | undefined;
  const curves = geometry.meta?.boundaryCurves as Vector3[][] | undefined;
  const rings = geometry.meta?.boundaryRings === true;

  if (diskRadius !== undefined) {
    // The model's own boundary, in the xz-plane the disk is drawn in.
    const r = Math.max(1e-4, diskRadius - inset);
    loops.push(circlePolyline({ center: new Vector3(), normal: new Vector3(0, 1, 0), radius: r }, circleSegments));
  } else if (curves?.length) {
    for (const loop of curves) loops.push(smoothLoop(loop, 2));
  } else if (rings) {
    for (const loop of boundaryIndexLoops(geometry.mesh)) {
      const circle = fitCircle(loop.map((i) => geometry.mesh.vertices[i]));
      circle.radius = Math.max(1e-4, circle.radius - inset);
      loops.push(circlePolyline(circle, circleSegments));
    }
  } else {
    for (const loop of boundaryIndexLoops(geometry.mesh)) {
      const inward = inset !== 0 ? inwardDirections(geometry.mesh, loop) : null;
      const pts = loop.map((v, i) => {
        const p = geometry.mesh.vertices[v].clone();
        return inward ? p.addScaledVector(inward[i], inset) : p;
      });
      loops.push(smoothLoop(pts, smoothness));
    }
  }

  if (loops.length === 0) return null;
  return {
    strands: loops,
    strandRadii: loops.map(() => null),
    strandFamilies: loops.map(() => 0 as const),
    strandClosed: loops.map(() => true),
  };
}
