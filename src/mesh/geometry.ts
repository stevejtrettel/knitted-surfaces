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

/** Normal of a quad face via cross product of diagonals. */
export function faceNormal(mesh: HalfEdgeMesh, face: Face, positions: Vector3[]): Vector3 {
  const verts: Vector3[] = [];
  for (const v of mesh.faceVertices(face)) verts.push(positions[v.index]);

  const d1 = new Vector3().subVectors(verts[2], verts[0]);
  const d2 = new Vector3().subVectors(verts[3], verts[1]);
  return new Vector3().crossVectors(d1, d2).normalize();
}

/** Area of a quad face via cross product of diagonals. */
export function faceArea(mesh: HalfEdgeMesh, face: Face, positions: Vector3[]): number {
  const verts: Vector3[] = [];
  for (const v of mesh.faceVertices(face)) verts.push(positions[v.index]);

  const d1 = new Vector3().subVectors(verts[2], verts[0]);
  const d2 = new Vector3().subVectors(verts[3], verts[1]);
  return new Vector3().crossVectors(d1, d2).length() * 0.5;
}
