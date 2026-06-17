/**
 * Topological stitcher.
 *
 * Stamps a tile on every face, then joins ports across shared edges purely by
 * topology — a port at `(halfEdge, t)` links to its twin at
 * `(halfEdge.twin, 1 - t)` within the same family — and walks the result into
 * global strands. This single walk replaces the old quad/tri tracers AND the
 * coordinate-matching `joinStrands`: a thread weave (one port per edge at t=0.5)
 * comes out as the same long strands the tracers produced, and corner weaves
 * come out stitched without any floating-point endpoint matching.
 */

import type { HalfEdgeMesh } from '../../geometry/HalfEdgeMesh.ts';
import type { Face, HalfEdge } from '../../geometry/types.ts';
import { faceEdgeArray } from '../../geometry/geometry.ts';
import type { Strand, StrandSegment, FamilyId } from '../types.ts';
import type { TileContext, TileFactory } from './types.ts';

interface PortInst {
  id: number;
  face: Face;
  he: HalfEdge;
  t: number;
  family: FamilyId;
}

interface ArcInst {
  id: number;
  a: PortInst;
  b: PortInst;
}

/** Key identifying a port topologically: (half-edge, position, family). */
function portKey(heIndex: number, t: number, family: FamilyId): string {
  return `${heIndex}:${Math.round(t * 1e4)}:${family}`;
}

/**
 * Build a segment from an entry/exit port pair within one face. `topEdge` is
 * derived to match the old tracers: a triangle's third (skipped) edge, a quad's
 * `entryEdge.next` side (which Omega's arch direction depends on).
 */
function makeSegment(
  face: Face,
  edges: HalfEdge[],
  entry: PortInst,
  exit: PortInst,
  cellType: TileContext['cellType'],
): StrandSegment {
  const topEdge =
    cellType === 'tri'
      ? edges.find((e) => e !== entry.he && e !== exit.he) ?? entry.he.next
      : entry.he.next;
  return {
    face,
    entry: { halfEdge: entry.he, t: entry.t },
    exit: { halfEdge: exit.he, t: exit.t },
    entryEdge: entry.he,
    exitEdge: exit.he,
    topEdge,
  };
}

export function stitch(mesh: HalfEdgeMesh, tileFactory: TileFactory, ctx: TileContext): Strand[] {
  const portByKey = new Map<string, PortInst>();
  const arcOfPort = new Map<number, { arc: ArcInst; isA: boolean }>();
  const arcs: ArcInst[] = [];
  const closedStrands: Strand[] = [];
  let pid = 0;
  let aid = 0;

  for (const face of mesh.faces) {
    const edges = faceEdgeArray(mesh, face);
    const tile = tileFactory(face, ctx);

    if (tile.closedPerFace) {
      // One closed ring per face; ports/arcs ignored. The segment just needs a
      // valid face — ring renderers (chain mail) re-derive geometry from it.
      const entry: PortInst = { id: -1, face, he: edges[0], t: 0.5, family: 0 };
      const exit: PortInst = { id: -1, face, he: edges[1] ?? edges[0], t: 0.5, family: 0 };
      closedStrands.push({ segments: [makeSegment(face, edges, entry, exit, ctx.cellType)], family: 0, closed: true });
      continue;
    }

    const insts: PortInst[] = tile.ports.map((p) => {
      const he = edges[p.edge];
      const inst: PortInst = { id: pid++, face, he, t: p.t, family: p.family };
      portByKey.set(portKey(he.index, p.t, p.family), inst);
      return inst;
    });

    for (const arc of tile.arcs) {
      const a = insts[arc.from];
      const b = insts[arc.to];
      if (!a || !b) continue;
      const ai: ArcInst = { id: aid++, a, b };
      arcs.push(ai);
      arcOfPort.set(a.id, { arc: ai, isA: true });
      arcOfPort.set(b.id, { arc: ai, isA: false });
    }
  }

  /** The port on the far side of this port's edge, same family — or null at a boundary. */
  const twinOf = (p: PortInst): PortInst | null => {
    if (!p.he.twin) return null;
    return portByKey.get(portKey(p.he.twin.index, 1 - p.t, p.family)) ?? null;
  };

  const visited = new Uint8Array(aid);
  const strands: Strand[] = [...closedStrands];

  for (const seed of arcs) {
    if (visited[seed.id]) continue;
    visited[seed.id] = 1;

    // A segment is a directed traversal of one arc (entry port → exit port).
    const segs: { entry: PortInst; exit: PortInst }[] = [{ entry: seed.a, exit: seed.b }];
    let closed = false;

    // Forward: follow the exit port across its edge into the next cell's arc.
    let cur = seed.b;
    while (true) {
      const tw = twinOf(cur);
      if (!tw) break; // boundary → open end
      const rec = arcOfPort.get(tw.id);
      if (!rec) break;
      if (visited[rec.arc.id]) {
        if (rec.arc.id === seed.id) closed = true; // looped back to the seed
        break;
      }
      visited[rec.arc.id] = 1;
      const exit = rec.isA ? rec.arc.b : rec.arc.a;
      segs.push({ entry: tw, exit });
      cur = exit;
    }

    // Backward from the seed's entry (an open strand grows both ways).
    if (!closed) {
      let curB = seed.a;
      while (true) {
        const tw = twinOf(curB);
        if (!tw) break;
        const rec = arcOfPort.get(tw.id);
        if (!rec || visited[rec.arc.id]) break;
        visited[rec.arc.id] = 1;
        const entry = rec.isA ? rec.arc.b : rec.arc.a; // tw is this segment's exit
        segs.unshift({ entry, exit: tw });
        curB = entry;
      }
    }

    const segments = segs.map((s) =>
      makeSegment(s.entry.face, faceEdgeArray(mesh, s.entry.face), s.entry, s.exit, ctx.cellType),
    );
    strands.push({ segments, family: seed.a.family, closed });
  }

  return strands;
}
