import type { Vector3 } from 'three';

/** Raw mesh soup — positions plus polygonal face index lists. */
export interface ParsedMesh {
  vertices: Vector3[];
  faces: number[][];
}

/** The cell shape a geometry is built from. */
export type CellType = 'quad' | 'tri';

/**
 * A per-point tube-radius falloff from a geometry's metric: returns a multiplier
 * in [0,1], ≈1 in the interior and → 0 toward a boundary. Lets tubes follow the
 * metric — e.g. thick in the middle, thin toward the hyperbolic disk boundary.
 */
export type RadiusField = (p: Vector3) => number;

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
  /** Optional metric-driven tube-radius falloff (e.g. hyperbolic boundary taper). */
  radiusField?: RadiusField;
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
