import type { HalfEdgeMesh } from '../mesh/HalfEdgeMesh.ts';
import type { Face, HalfEdge } from '../mesh/types.ts';
import type { Strand, StrandSegment } from './types.ts';
import { familyEdges } from './helpers.ts';

function traceDirection(
  startFace: Face,
  exitEdge: HalfEdge,
  visitedFaces: Set<number>,
): StrandSegment[] {
  const result: StrandSegment[] = [];
  let currentExit = exitEdge;

  while (true) {
    const twin = currentExit.twin;
    if (!twin) break;

    const nextFace = twin.face;
    if (!nextFace || nextFace === startFace) break;
    if (visitedFaces.has(nextFace.index)) break;

    const entryEdge = twin;
    const exitEdge = twin.next.next;

    result.push({ face: nextFace, entryEdge, exitEdge });
    visitedFaces.add(nextFace.index);
    currentExit = exitEdge;
  }

  return result;
}

export function traceStrands(
  mesh: HalfEdgeMesh,
  edgeFamilies: number[],
  families: (0 | 1)[] = [0, 1]
): Strand[] {
  const strands: Strand[] = [];
  const visited = new Uint8Array(mesh.faces.length * 2);

  for (const face of mesh.faces) {
    for (const family of families) {
      const slot = face.index * 2 + family;
      if (visited[slot]) continue;

      const [edgeA, edgeB] = familyEdges(mesh, face, edgeFamilies, family);
      const strandFaces = new Set<number>([face.index]);

      const forward = traceDirection(face, edgeA, strandFaces);
      const backward = traceDirection(face, edgeB, strandFaces);

      const startSegment: StrandSegment = { face, entryEdge: edgeB, exitEdge: edgeA };

      const backwardReversed = backward.reverse().map(s => ({
        face: s.face,
        entryEdge: s.exitEdge,
        exitEdge: s.entryEdge,
      }));

      const segments = [...backwardReversed, startSegment, ...forward];

      const lastExit = segments[segments.length - 1].exitEdge;
      const firstEntry = segments[0].entryEdge;
      const closed = lastExit.twin !== null &&
        lastExit.twin.face === firstEntry.face &&
        segments.length > 1;

      for (const seg of segments) {
        visited[seg.face.index * 2 + family] = 1;
      }

      strands.push({ segments, family, closed });
    }
  }

  return strands;
}
