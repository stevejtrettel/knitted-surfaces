/**
 * Geometry → Analysis.
 *
 * One pipeline for every cell type and pattern: classify edges (the family /
 * colour each strand follows), 2-colour the faces (a per-cell handedness source),
 * `stitch` the pattern's tile into global strands, then walk each strand to
 * assign its over/under sides. The pattern decides connectivity through its
 * `tile`; this layer just supplies the context. A thread weave, a corner weave,
 * and chain mail all flow through the same call.
 *
 * `fabric` carries how thick the yarn is and how much clearance a crossing needs
 * — the studio owns those controls, and patterns read them to size their lift.
 * It defaults to hairline-thin yarn, which leaves every pattern's own amplitude
 * in charge, so callers that only care about connectivity can omit it.
 */

import { HalfEdgeMesh } from '../../geometry/HalfEdgeMesh.ts';
import type { Geometry } from '../../geometry/types.ts';
import type { Analysis, Fabric, FamilyId, Pattern } from '../types.ts';
import { constantWidth } from '../width.ts';
import { classifyEdges } from './classifyEdges.ts';
import { classifyEdgesTri } from './classifyEdgesTri.ts';
import { colorFaces } from './colorFaces.ts';
import { assignSides } from './sides.ts';
import { stitch } from '../tile/stitch.ts';
import type { TileContext } from '../tile/types.ts';

const HAIRLINE: Fabric = { width: constantWidth(0), clearance: 0.15 };

export function analyze(geometry: Geometry, pattern: Pattern<any>, fabric: Fabric = HAIRLINE): Analysis {
  const { mesh: soup, cellType } = geometry;
  const mesh = HalfEdgeMesh.fromSoup(soup.vertices.length, soup.faces);
  if (mesh.faces.length === 0) throw new Error('analyze: empty mesh');

  const positions = soup.vertices;
  const edgeColors = cellType === 'quad' ? classifyEdges(mesh) : classifyEdgesTri(mesh);
  const faceColors = colorFaces(mesh);

  const ctx: TileContext = { mesh, positions, cellType, edgeColors, faceColors };
  const strands = stitch(mesh, pattern.tile, ctx);
  const sideDefects = assignSides(strands);

  const availableFamilies: FamilyId[] = cellType === 'quad' ? [0, 1] : [0, 1, 2];
  return {
    mesh,
    positions,
    cellType,
    edgeFamilies: edgeColors,
    faceColors,
    strands,
    availableFamilies,
    fabric,
    sideDefects,
  };
}
