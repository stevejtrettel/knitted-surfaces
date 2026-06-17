/**
 * Reusable tile factories — the connectivity half of each pattern.
 *
 *  • threadTile  — one port per edge at t = 0.5 (quad + triaxial thread weaves).
 *  • cornerTile  — two ports per edge (corner weaves), arcs flanking each corner.
 *  • ringTile    — one closed ring per face (chain mail), no boundary ports.
 */

import { faceEdgeArray } from '../../geometry/geometry.ts';
import type { FamilyId } from '../types.ts';
import type { TileFactory, TilePort, TileArc } from './types.ts';

/**
 * Thread weave: each requested family runs straight through one cell, entering
 * and exiting at edge midpoints. Quad — every edge carries one family
 * (`edgeColors` 0|1), so a family pairs its two same-coloured edges. Triangle —
 * a family X skips the colour-X edge and pairs the two others; two families
 * share each edge midpoint, which the per-port `family` tag disambiguates.
 */
export function threadTile(families: FamilyId[]): TileFactory {
  return (face, ctx) => {
    const edges = faceEdgeArray(ctx.mesh, face);
    const ports: TilePort[] = [];
    const arcs: TileArc[] = [];

    for (const f of families) {
      const through =
        ctx.cellType === 'quad'
          ? edges.filter((e) => ctx.edgeColors[e.index] === f) // same-family (opposite) pair
          : edges.filter((e) => ctx.edgeColors[e.index] !== f); // the two non-skip edges
      if (through.length < 2) continue; // graceful on imperfect colourings

      const a = ports.push({ edge: edges.indexOf(through[0]), t: 0.5, family: f }) - 1;
      const b = ports.push({ edge: edges.indexOf(through[1]), t: 0.5, family: f }) - 1;
      // Seed the arc entry at the SECOND family edge (b → a), matching the old
      // tracer's start orientation so the strand walks the same direction and
      // `topEdge = entryEdge.next` lands on the same side — Omega's arch is
      // unchanged. (Direction-agnostic for triangles: topEdge is the third edge.)
      arcs.push({ from: b, to: a });
    }

    return { ports, arcs };
  };
}

/**
 * Corner weave: on each edge a port at `fEntry` and one at `fExit`; arc k runs
 * from edge k's entry port to edge (k+1)'s exit port, flanking corner k+1. The
 * stitcher joins arcs across edges (our 2/3 is the neighbour's 1/3) into
 * continuous strands — no coordinate matching. Renderers read the port `t`s.
 */
export function cornerTile(fEntry: number, fExit: number): TileFactory {
  return () => {
    const ports: TilePort[] = [];
    const arcs: TileArc[] = [];
    for (let k = 0; k < 3; k++) {
      const from = ports.push({ edge: k, t: fEntry, family: 0 }) - 1;
      const to = ports.push({ edge: (k + 1) % 3, t: fExit, family: 0 }) - 1;
      arcs.push({ from, to });
    }
    return { ports, arcs };
  };
}

/** Chain mail: one closed ring per face; ports/arcs unused (rings link in 3D). */
export const ringTile: TileFactory = () => ({ ports: [], arcs: [], closedPerFace: true });
