import type { Vector3 } from 'three';
import type { HalfEdgeMesh } from '../mesh/HalfEdgeMesh.ts';
import type { Face, HalfEdge } from '../mesh/types.ts';

export interface StrandSegment {
  face: Face;
  entryEdge: HalfEdge;
  exitEdge: HalfEdge;
}

export interface Strand {
  segments: StrandSegment[];
  family: 0 | 1;
  closed: boolean;
}

export interface MeshAnalysis {
  mesh: HalfEdgeMesh;
  positions: Vector3[];
  edgeFamilies: number[];
  faceColors: number[];
  strands: Strand[];
}

/**
 * UI metadata for a single tunable design parameter. Embedding the range
 * alongside the design (rather than in a central switch) keeps it the
 * single source of truth for both the slider and the runtime default.
 */
export interface ParamSpec {
  /** Key in the design's options object. */
  key: string;
  /** Human-readable slider label. */
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface StrandDesign<Opts = Record<string, unknown>> {
  readonly name: string;
  readonly families?: (0 | 1)[];
  /** Stable id for pickers/registries. Defaults to `name` when omitted. */
  readonly id?: string;
  /** Display label for the knit-type picker. */
  readonly label?: string;
  /** Tunable parameters with their slider ranges and defaults. */
  readonly params?: ParamSpec[];
  generateStrandCurve(
    strand: Strand,
    analysis: MeshAnalysis,
    options: Opts,
  ): Vector3[];
}

export interface WeaveResult {
  strands: Vector3[][];
  strandFamilies: (0 | 1)[];
  strandClosed: boolean[];
}
