import type { Vector3 } from 'three';

/** Raw mesh soup — positions plus polygonal face index lists. */
export interface ParsedMesh {
  vertices: Vector3[];
  faces: number[][];
}

/** The cell shape a geometry is built from. */
export type CellType = 'quad' | 'tri';

/**
 * A mesh tagged with its cell type. Builders guarantee homogeneous arity
 * (every face is a quad, or every face is a triangle), which the routing
 * layer relies on to pick the right strand tracer.
 */
export interface Geometry {
  cellType: CellType;
  mesh: ParsedMesh;
  /** Optional builder-specific metadata (source id, params, …). */
  meta?: Record<string, unknown>;
}

export interface Vertex {
  readonly index: number;
  halfEdge: HalfEdge | null;
}

export interface HalfEdge {
  readonly index: number;
  origin: Vertex;
  twin: HalfEdge | null;
  next: HalfEdge;
  face: Face | null;
}

export interface Face {
  readonly index: number;
  halfEdge: HalfEdge;
}
