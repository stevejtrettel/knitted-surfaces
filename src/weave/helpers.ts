/**
 * Weave-specific helpers.
 */

import type { HalfEdgeMesh } from '../mesh/HalfEdgeMesh.ts';
import type { Face, HalfEdge } from '../mesh/types.ts';
import { faceEdgeArray } from '../mesh/geometry.ts';

/** Return the two edges of a face belonging to a given family. */
export function familyEdges(
  mesh: HalfEdgeMesh,
  face: Face,
  edgeFamilies: number[],
  family: number
): [HalfEdge, HalfEdge] {
  const edges = faceEdgeArray(mesh, face);
  const matches: HalfEdge[] = [];
  for (const e of edges) {
    if (edgeFamilies[e.index] === family) matches.push(e);
  }
  return [matches[0], matches[1]];
}
