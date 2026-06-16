import type { Vertex, HalfEdge, Face } from './types.ts';

export class HalfEdgeMesh {
  readonly vertices: Vertex[];
  readonly halfEdges: HalfEdge[];
  readonly faces: Face[];

  constructor(vertices: Vertex[], halfEdges: HalfEdge[], faces: Face[]) {
    this.vertices = vertices;
    this.halfEdges = halfEdges;
    this.faces = faces;
  }

  static fromSoup(vertexCount: number, faceIndices: number[][]): HalfEdgeMesh {
    const vertices: Vertex[] = [];
    for (let i = 0; i < vertexCount; i++) {
      vertices.push({ index: i, halfEdge: null });
    }

    const halfEdges: HalfEdge[] = [];
    const faces: Face[] = [];
    const edgeMap = new Map<string, HalfEdge>();

    for (let fi = 0; fi < faceIndices.length; fi++) {
      const indices = faceIndices[fi];
      const n = indices.length;

      const face: Face = { index: fi, halfEdge: null! };
      const faceEdges: HalfEdge[] = [];

      for (let j = 0; j < n; j++) {
        const he: HalfEdge = {
          index: halfEdges.length + j,
          origin: vertices[indices[j]],
          twin: null,
          next: null!,
          face,
        };
        faceEdges.push(he);
      }

      for (let j = 0; j < n; j++) {
        (faceEdges[j] as { next: HalfEdge }).next = faceEdges[(j + 1) % n];
      }

      (face as { halfEdge: HalfEdge }).halfEdge = faceEdges[0];

      for (let j = 0; j < n; j++) {
        const v = vertices[indices[j]];
        if (v.halfEdge === null) v.halfEdge = faceEdges[j];
      }

      for (let j = 0; j < n; j++) {
        const he = faceEdges[j];
        const originIdx = indices[j];
        const destIdx = indices[(j + 1) % n];

        const key = `${originIdx}-${destIdx}`;
        const twinKey = `${destIdx}-${originIdx}`;

        const twin = edgeMap.get(twinKey);
        if (twin) {
          (he as { twin: HalfEdge | null }).twin = twin;
          (twin as { twin: HalfEdge | null }).twin = he;
          edgeMap.delete(twinKey);
        } else {
          edgeMap.set(key, he);
        }
      }

      halfEdges.push(...faceEdges);
      faces.push(face);
    }

    return new HalfEdgeMesh(vertices, halfEdges, faces);
  }

  *faceEdges(face: Face): IterableIterator<HalfEdge> {
    const start = face.halfEdge;
    let he = start;
    do {
      yield he;
      he = he.next;
    } while (he !== start);
  }

  *faceVertices(face: Face): IterableIterator<Vertex> {
    for (const he of this.faceEdges(face)) yield he.origin;
  }

  *faceNeighbors(face: Face): IterableIterator<Face> {
    for (const he of this.faceEdges(face)) {
      if (he.twin && he.twin.face) yield he.twin.face;
    }
  }

  faceSides(face: Face): number {
    let count = 0;
    for (const _ of this.faceEdges(face)) count++;
    return count;
  }
}
