/**
 * Directional 3-edge-colouring for triangle meshes (the "+1 mod 3 in CCW order"
 * rule), used by the triaxial weave: strands run STRAIGHT as long crossing
 * bands. Only consistent when every valence is divisible by 3 (else it tears).
 * Keeps twins in sync and falls back gracefully where no clean colouring exists.
 */

import type { HalfEdgeMesh } from '../../geometry/HalfEdgeMesh.ts';
import type { Face } from '../../geometry/types.ts';
import { faceEdgeArray } from '../../geometry/geometry.ts';

function requireTriangles(mesh: HalfEdgeMesh): void {
  for (const face of mesh.faces) {
    if (mesh.faceSides(face) !== 3) {
      throw new Error(
        `Face ${face.index} has ${mesh.faceSides(face)} sides, expected 3 (triangle mesh)`,
      );
    }
  }
}

/** Directional colouring (+1 mod 3 CCW) → straight strands (triaxial weave). */
export function classifyEdgesTri(mesh: HalfEdgeMesh): number[] {
  requireTriangles(mesh);
  const family = new Int8Array(mesh.halfEdges.length).fill(-1);

  function paint(face: Face, baseColour: number, basePos: number): void {
    const edges = faceEdgeArray(mesh, face);
    for (let i = 0; i < 3; i++) {
      const expected = (baseColour + (((i - basePos) % 3) + 3) % 3) % 3;
      if (family[edges[i].index] === -1) {
        family[edges[i].index] = expected;
        if (edges[i].twin) family[edges[i].twin!.index] = expected;
      }
    }
  }

  const visited = new Uint8Array(mesh.faces.length);
  const queue: Face[] = [];
  for (let seedIdx = 0; seedIdx < mesh.faces.length; seedIdx++) {
    if (visited[seedIdx]) continue;
    const seed = mesh.faces[seedIdx];
    paint(seed, 0, 0);
    visited[seed.index] = 1;
    for (const n of mesh.faceNeighbors(seed)) queue.push(n);
    let head = queue.length - mesh.faceSides(seed);
    if (head < 0) head = 0;
    while (head < queue.length) {
      const face = queue[head++];
      if (visited[face.index]) continue;
      const edges = faceEdgeArray(mesh, face);
      let knownIdx = -1;
      let knownColour = -1;
      for (let i = 0; i < 3; i++) {
        if (family[edges[i].index] !== -1) { knownIdx = i; knownColour = family[edges[i].index]; break; }
      }
      paint(face, knownIdx === -1 ? 0 : knownColour, knownIdx === -1 ? 0 : knownIdx);
      visited[face.index] = 1;
      for (const n of mesh.faceNeighbors(face)) if (!visited[n.index]) queue.push(n);
    }
  }
  for (let i = 0; i < family.length; i++) if (family[i] === -1) family[i] = 0;
  return Array.from(family);
}
