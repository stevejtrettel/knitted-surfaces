import type { Vector3 } from 'three';
import type { HalfEdgeMesh } from '../geometry/HalfEdgeMesh.ts';
import type { Face, HalfEdge, CellType } from '../geometry/types.ts';
import type { ParamSpec } from '../params.ts';
import type { TileFactory } from './tile/types.ts';
import type { WidthField } from './width.ts';

export type { ParamSpec };

/** Strand family index. Quad meshes use 0|1; triangle meshes use 0|1|2. */
export type FamilyId = 0 | 1 | 2;

/**
 * A point where a strand crosses a cell boundary: a position `t` along a
 * half-edge, measured from `halfEdge.origin`. Its topological twin — the same
 * point seen from the neighbouring cell — is `(halfEdge.twin, 1 - t)`; the
 * stitcher matches ports by that rule, never by world coordinates.
 */
export interface Port {
  halfEdge: HalfEdge;
  t: number;
}

/**
 * One cell-crossing of a strand: it enters at `entry`, exits at `exit`, and
 * arcs over `topEdge` (the far/skipped edge — a quad's perpendicular side, a
 * triangle's third edge). `entryEdge`/`exitEdge` mirror the ports' half-edges
 * (kept so renderers written against the old shape are untouched); `topEdge` is
 * derived by the stitcher so patterns don't re-derive it.
 */
export interface StrandSegment {
  face: Face;
  entry: Port;
  exit: Port;
  entryEdge: HalfEdge;
  exitEdge: HalfEdge;
  topEdge: HalfEdge;
  /**
   * Over (+1) / under (−1) for this crossing, assigned by `assignSides` — the
   * strand-walking successor to reading the face 2-colouring directly. Patterns
   * that draw a thread crossing another thread should use this; patterns whose
   * handedness is a property of the CELL rather than the thread (the corner
   * weaves' held level, chain mail's rings) keep using `Analysis.faceColors`.
   */
  side: 1 | -1;
}

export interface Strand {
  segments: StrandSegment[];
  family: FamilyId;
  closed: boolean;
}

/**
 * How thick the yarn is and how much room crossings need — the properties of the
 * *fabric* rather than of the mesh or the stitch. Supplied by the studio (it owns
 * the width controls) and read by patterns through `clearance.ts`.
 */
export interface Fabric {
  width: WidthField;
  /** Gap left at a crossing, as a fraction of the yarn radius. */
  clearance: number;
}

/** Output of the routing layer — a mesh resolved into threadable strands. */
export interface Analysis {
  mesh: HalfEdgeMesh;
  positions: Vector3[];
  cellType: CellType;
  edgeFamilies: number[];
  faceColors: number[];
  strands: Strand[];
  availableFamilies: FamilyId[];
  fabric: Fabric;
  /** Crossings where the over/under alternation could not be satisfied. */
  sideDefects: number;
}

/** A point on a strand curve, optionally with its own tube radius. */
export interface StrandSample {
  position: Vector3;
  radius?: number;
}

/**
 * A stitch pattern for one cell type. Quad and triangle patterns are separate
 * registries (each carries a single `cellType`). `generateStrandCurve` may
 * return bare points (constant radius) or `StrandSample`s (per-point radius).
 */
export interface Pattern<Opts = Record<string, unknown>> {
  readonly id: string;
  readonly label: string;
  readonly cellType: CellType;
  /**
   * Connectivity: declares this pattern's ports + arcs per cell. The stitcher
   * walks them across shared edges into global strands. (Replaces the old
   * `families`/`triRouting`/`joinArcs` trio — a thread weave is just the
   * one-port-per-edge tile.)
   */
  readonly tile: TileFactory;
  readonly params?: ParamSpec[];
  generateStrandCurve(
    strand: Strand,
    analysis: Analysis,
    options: Opts,
  ): Vector3[] | StrandSample[];
}

export interface WeaveResult {
  strands: Vector3[][];
  /** Per-strand per-point radius, or null where the pattern left it constant. */
  strandRadii: (number[] | null)[];
  strandFamilies: FamilyId[];
  strandClosed: boolean[];
}
