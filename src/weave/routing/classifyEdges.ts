/**
 * Quad edge classification: label each edge into one of two families
 * (the two grid directions), opposite edges sharing a family.
 */

import type { HalfEdgeMesh } from '../../geometry/HalfEdgeMesh.ts';
import type { Face } from '../../geometry/types.ts';
import { faceEdgeArray } from '../../geometry/geometry.ts';

export function classifyEdges(mesh: HalfEdgeMesh): number[] {
  const family = new Int8Array(mesh.halfEdges.length).fill(-1);

  for (const face of mesh.faces) {
    if (mesh.faceSides(face) !== 4) {
      throw new Error(`Face ${face.index} has ${mesh.faceSides(face)} sides, expected 4`);
    }
  }

  const queue: Face[] = [];
  const visited = new Uint8Array(mesh.faces.length);

  const startFace = mesh.faces[0];
  const startEdges = faceEdgeArray(mesh, startFace);
  for (let i = 0; i < 4; i++) {
    family[startEdges[i].index] = i % 2;
    if (startEdges[i].twin) {
      family[startEdges[i].twin!.index] = i % 2;
    }
  }
  visited[startFace.index] = 1;

  for (const neighbor of mesh.faceNeighbors(startFace)) {
    if (!visited[neighbor.index]) queue.push(neighbor);
  }

  let head = 0;
  while (head < queue.length) {
    const face = queue[head++]!;
    if (visited[face.index]) continue;
    visited[face.index] = 1;

    const edges = faceEdgeArray(mesh, face);

    let knownIdx = -1;
    for (let i = 0; i < 4; i++) {
      if (family[edges[i].index] !== -1) { knownIdx = i; break; }
    }

    if (knownIdx === -1) {
      throw new Error(`Face ${face.index} reached by BFS but has no labeled edges`);
    }

    const knownFamily = family[edges[knownIdx].index];

    for (let i = 0; i < 4; i++) {
      const expected = (i % 2 === knownIdx % 2) ? knownFamily : (1 - knownFamily);

      if (family[edges[i].index] !== -1 && family[edges[i].index] !== expected) {
        throw new Error(
          `Inconsistent edge classification at face ${face.index}, edge ${edges[i].index}`,
        );
      }

      family[edges[i].index] = expected;

      if (edges[i].twin && family[edges[i].twin!.index] === -1) {
        family[edges[i].twin!.index] = expected;
      }
    }

    for (const neighbor of mesh.faceNeighbors(face)) {
      if (!visited[neighbor.index]) queue.push(neighbor);
    }
  }

  for (let i = 0; i < mesh.faces.length; i++) {
    if (!visited[i]) {
      throw new Error(`Mesh is not connected: face ${i} was not reached from face 0`);
    }
  }

  return Array.from(family);
}
