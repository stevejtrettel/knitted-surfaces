/**
 * Geometric queries on positioned meshes.
 */

import { Vector3 } from 'three';
import type { HalfEdgeMesh } from './HalfEdgeMesh.ts';
import type { Face, HalfEdge } from './types.ts';

/** Collect all half-edges of a face into an array. */
export function faceEdgeArray(mesh: HalfEdgeMesh, face: Face): HalfEdge[] {
  const edges: HalfEdge[] = [];
  for (const he of mesh.faceEdges(face)) edges.push(he);
  return edges;
}

/** Midpoint of a half-edge. */
export function edgeMidpoint(he: HalfEdge, positions: Vector3[]): Vector3 {
  const a = positions[he.origin.index];
  const b = positions[he.next.origin.index];
  return new Vector3().addVectors(a, b).multiplyScalar(0.5);
}

/** Centroid of a face. */
export function faceCenter(mesh: HalfEdgeMesh, face: Face, positions: Vector3[]): Vector3 {
  const center = new Vector3();
  let count = 0;
  for (const v of mesh.faceVertices(face)) {
    center.add(positions[v.index]);
    count++;
  }
  return center.divideScalar(count);
}

/**
 * Newell's method: the area-weighted normal of an arbitrary planar-ish
 * polygon. Works for triangles, quads, and n-gons alike, and is robust to
 * slightly non-planar faces. Its magnitude is twice the projected area.
 */
function newellNormal(verts: Vector3[]): Vector3 {
  const n = new Vector3();
  const count = verts.length;
  for (let i = 0; i < count; i++) {
    const cur = verts[i];
    const nxt = verts[(i + 1) % count];
    n.x += (cur.y - nxt.y) * (cur.z + nxt.z);
    n.y += (cur.z - nxt.z) * (cur.x + nxt.x);
    n.z += (cur.x - nxt.x) * (cur.y + nxt.y);
  }
  return n;
}

/** Unit normal of a face (any arity) via Newell's method. */
export function faceNormal(mesh: HalfEdgeMesh, face: Face, positions: Vector3[]): Vector3 {
  const verts: Vector3[] = [];
  for (const v of mesh.faceVertices(face)) verts.push(positions[v.index]);
  return newellNormal(verts).normalize();
}

/** Area of a face (any arity); half the magnitude of the Newell vector. */
export function faceArea(mesh: HalfEdgeMesh, face: Face, positions: Vector3[]): number {
  const verts: Vector3[] = [];
  for (const v of mesh.faceVertices(face)) verts.push(positions[v.index]);
  return newellNormal(verts).length() * 0.5;
}
