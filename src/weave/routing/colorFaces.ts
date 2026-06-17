import type { HalfEdgeMesh } from '../../geometry/HalfEdgeMesh.ts';

/**
 * Checkerboard 2-colouring of the face-adjacency graph — an over/under sign
 * source. Best-effort: on a bipartite dual (quad meshes, the regular triangle
 * grid, and reflection-generated Schwarz tilings) this is a perfect 2-colouring;
 * on a non-bipartite dual (odd-valence tilings) it returns a colouring with
 * some same-colour adjacencies rather than throwing, so corner weaves can still
 * run there. A *correct* odd-valence over/under rule (3-phase / cyclic) is a
 * separate follow-up; this just guarantees the pipeline never crashes.
 *
 * The BFS is unchanged from the strict version where it used to succeed, so
 * patterns that rely on the sign (loop, weave) get byte-identical colourings on
 * the meshes they already worked on. Disconnected components each seed afresh.
 */
export function colorFaces(mesh: HalfEdgeMesh): number[] {
  const color = new Int8Array(mesh.faces.length).fill(-1);

  for (let seed = 0; seed < mesh.faces.length; seed++) {
    if (color[seed] !== -1) continue;
    color[seed] = 0;
    const queue = [mesh.faces[seed]];

    let head = 0;
    while (head < queue.length) {
      const face = queue[head++]!;
      const neighborColor = 1 - color[face.index];

      for (const neighbor of mesh.faceNeighbors(face)) {
        if (color[neighbor.index] === -1) {
          color[neighbor.index] = neighborColor;
          queue.push(neighbor);
        }
        // Same-colour adjacency (non-bipartite) is left as-is — best-effort.
      }
    }
  }

  return Array.from(color);
}
