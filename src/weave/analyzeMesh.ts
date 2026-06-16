import { HalfEdgeMesh } from '../mesh/HalfEdgeMesh.ts';
import type { ParsedMesh } from '../mesh/types.ts';
import type { MeshAnalysis } from './types.ts';
import { classifyEdges } from './classifyEdges.ts';
import { colorFaces } from './colorFaces.ts';
import { traceStrands } from './traceStrands.ts';

export function analyzeMesh(
  parsedMesh: ParsedMesh,
  families: (0 | 1)[] = [0, 1],
): MeshAnalysis {
  const mesh = HalfEdgeMesh.fromSoup(parsedMesh.vertices.length, parsedMesh.faces);
  const edgeFamilies = classifyEdges(mesh);
  const faceColors = colorFaces(mesh);
  const strands = traceStrands(mesh, edgeFamilies, families);

  return { mesh, positions: parsedMesh.vertices, edgeFamilies, faceColors, strands };
}
