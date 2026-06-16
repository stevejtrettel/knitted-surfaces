import type { HalfEdgeMesh } from '../mesh/HalfEdgeMesh.ts';

export function colorFaces(mesh: HalfEdgeMesh): number[] {
  const color = new Int8Array(mesh.faces.length).fill(-1);
  const queue = [mesh.faces[0]];
  color[mesh.faces[0].index] = 0;

  let head = 0;
  while (head < queue.length) {
    const face = queue[head++]!;
    const myColor = color[face.index];
    const neighborColor = 1 - myColor;

    for (const neighbor of mesh.faceNeighbors(face)) {
      if (color[neighbor.index] === -1) {
        color[neighbor.index] = neighborColor;
        queue.push(neighbor);
      } else if (color[neighbor.index] === myColor) {
        throw new Error(
          `Mesh is not 2-colorable: faces ${face.index} and ${neighbor.index} are adjacent with same color`
        );
      }
    }
  }

  for (let i = 0; i < mesh.faces.length; i++) {
    if (color[i] === -1) {
      throw new Error(`Mesh is not connected: face ${i} was not reached from face 0`);
    }
  }

  return Array.from(color);
}
