/**
 * Geometry → Analysis.
 *
 * One pipeline for every cell type and pattern: classify edges (the family /
 * colour each strand follows), 2-colour the faces (an over/under sign source),
 * then `stitch` the pattern's tile into global strands. The pattern decides
 * connectivity through its `tile`; this layer just supplies the context. A
 * thread weave, a corner weave, and chain mail all flow through the same call.
 */

import { HalfEdgeMesh } from '../../geometry/HalfEdgeMesh.ts';
import type { Geometry } from '../../geometry/types.ts';
import type { Analysis, FamilyId, Pattern } from '../types.ts';
import { classifyEdges } from './classifyEdges.ts';
import { classifyEdgesTri } from './classifyEdgesTri.ts';
import { colorFaces } from './colorFaces.ts';
import { stitch } from '../tile/stitch.ts';
import type { TileContext } from '../tile/types.ts';

export function analyze(geometry: Geometry, pattern: Pattern<any>): Analysis {
  const { mesh: soup, cellType } = geometry;
  const mesh = HalfEdgeMesh.fromSoup(soup.vertices.length, soup.faces);
  if (mesh.faces.length === 0) throw new Error('analyze: empty mesh');

  const positions = soup.vertices;
  const edgeColors = cellType === 'quad' ? classifyEdges(mesh) : classifyEdgesTri(mesh);
  const faceColors = colorFaces(mesh);

  const ctx: TileContext = { mesh, positions, cellType, edgeColors, faceColors };
  const strands = stitch(mesh, pattern.tile, ctx);

  const availableFamilies: FamilyId[] = cellType === 'quad' ? [0, 1] : [0, 1, 2];
  return {
    mesh,
    positions,
    cellType,
    edgeFamilies: edgeColors,
    faceColors,
    strands,
    availableFamilies,
  };
}
