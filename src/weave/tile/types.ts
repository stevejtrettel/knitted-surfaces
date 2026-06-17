/**
 * Tangle-tile connectivity model.
 *
 * A `Tile` decorates ONE cell with `ports` (points on its edges) and `arcs`
 * (pairings of those ports). The stitcher (`stitch.ts`) stamps a tile on every
 * face and joins ports across shared edges topologically — a port `(edge, t)`
 * matches its neighbour's `(twin edge, 1 - t)` — to build global strands.
 *
 * This one model spans every weave:
 *  • thread weaves (quad, triaxial) — one port per edge at t = 0.5;
 *  • corner weaves                  — two ports per edge (e.g. 1/3, 2/3);
 *  • chain mail                     — `closedPerFace`: one closed ring per face,
 *                                     no boundary ports (rings link geometrically).
 */

import type { Vector3 } from 'three';
import type { Face, CellType } from '../../geometry/types.ts';
import type { HalfEdgeMesh } from '../../geometry/HalfEdgeMesh.ts';
import type { FamilyId } from '../types.ts';

/**
 * A port the tile places on one of its cell's edges. `edge` indexes the face's
 * edges in `faceEdgeArray` order; `t` is the position along that edge from its
 * origin. `family` tags which strand family owns the port — required because in
 * the triaxial weave two families pass through the same edge midpoint, so a bare
 * `(edge, t)` is ambiguous; twins are matched within a family.
 *
 * Invariant for clean stitching: a tile must place ports at a t-set symmetric
 * under `t -> 1 - t` on every edge (e.g. {0.5} or {1/3, 2/3}), so a face and its
 * neighbour independently declare ports that are exact twins.
 */
export interface TilePort {
  edge: number;
  t: number;
  family: FamilyId;
}

/** An arc connecting two of the tile's ports (indices into `ports`). */
export interface TileArc {
  from: number;
  to: number;
}

export interface Tile {
  ports: TilePort[];
  arcs: TileArc[];
  /**
   * If set, the stitcher ignores ports/arcs and emits ONE closed single-segment
   * strand for this face. Used by ring tiles (chain mail) whose loops link with
   * neighbours geometrically rather than stitching across edges.
   */
  closedPerFace?: boolean;
}

/** Per-face context a tile factory may read to decide its ports/arcs. */
export interface TileContext {
  mesh: HalfEdgeMesh;
  positions: Vector3[];
  cellType: CellType;
  /** Edge family/colour (quad: 0|1; tri: 0|1|2), indexed by half-edge. */
  edgeColors: number[];
  /** Checkerboard face 2-colouring (best-effort), indexed by face. */
  faceColors: number[];
}

export type TileFactory = (face: Face, ctx: TileContext) => Tile;
