import { Vector3 } from 'three';
import type { HalfEdge } from '../../geometry/types.ts';
import type { HalfEdgeMesh } from '../../geometry/HalfEdgeMesh.ts';
import type { Pattern, Analysis, Strand } from '../types.ts';
import { faceNormal } from '../../geometry/geometry.ts';
import { threadTile } from '../tile/tiles.ts';

/**
 * Tri-axial weave.
 *
 * The three families are the straight medial lines of the triangulation: each
 * strand runs through the midpoints of the two edges it crosses, which on a
 * regular grid are collinear — so each family is a straight line in one of the
 * three 60° directions (the kagome structure). Two strands cross at every edge
 * midpoint; a smooth over/under (a cosine peaking at the crossings) lifts one
 * over the other.
 *
 * Both gluing-critical quantities are edge-intrinsic so neighbouring cells
 * agree: the crossing point (the shared edge midpoint) and the over/under
 * height (along the averaged normal of the two incident faces, sign from the
 * edge-colour rule). No per-cell bending — the strands stay straight.
 */
export interface TriaxialOptions {
  amplitude?: number;
  samplesPerSegment?: number;
}

const DEFAULT_AMPLITUDE = 0.18;
const DEFAULT_SAMPLES_PER_SEGMENT = 6;

/** +1 (over) / −1 (under) for family `f` crossing an edge of colour `c`. */
function overUnder(f: number, c: number): number {
  return (f - c + 3) % 3 === 1 ? 1 : -1;
}

function midpoint(edge: HalfEdge, positions: Vector3[]): Vector3 {
  const a = positions[edge.origin.index];
  const b = positions[edge.next.origin.index];
  return new Vector3().addVectors(a, b).multiplyScalar(0.5);
}

function edgeLength(edge: HalfEdge, positions: Vector3[]): number {
  return positions[edge.origin.index].distanceTo(positions[edge.next.origin.index]);
}

/** Averaged normal of the two faces sharing an edge — identical from both sides. */
function edgeNormal(mesh: HalfEdgeMesh, edge: HalfEdge, positions: Vector3[]): Vector3 {
  const n = faceNormal(mesh, edge.face!, positions);
  if (edge.twin && edge.twin.face) n.add(faceNormal(mesh, edge.twin.face, positions));
  return n.normalize();
}

const TRI_PARAMS = [
  { key: 'amplitude', label: 'Over/Under', min: 0.0, max: 0.5, step: 0.01, default: DEFAULT_AMPLITUDE },
  { key: 'samplesPerSegment', label: 'Smoothness', min: 1, max: 16, step: 1, default: DEFAULT_SAMPLES_PER_SEGMENT },
];

/**
 * Straight chord between the two crossed-edge midpoints, with a cosine over/under
 * peaking at the midpoints. Connectivity (which edges a strand threads through) is
 * decided upstream by the tile/stitcher; the geometry here just draws the chord.
 */
function triWeaveCurve(strand: Strand, analysis: Analysis, options: TriaxialOptions): Vector3[] {
    const amplitude = options.amplitude ?? DEFAULT_AMPLITUDE;
    const sps = options.samplesPerSegment ?? DEFAULT_SAMPLES_PER_SEGMENT;
    const { mesh, positions, edgeFamilies } = analysis;
    const f = strand.family;

    // Over/under height scaled by this strand's cell size (constant per strand).
    let meanLen = 0;
    for (const seg of strand.segments) meanLen += edgeLength(seg.entryEdge, positions);
    meanLen /= Math.max(1, strand.segments.length);
    const hScale = amplitude * meanLen;

    const points: Vector3[] = [];
    for (let i = 0; i < strand.segments.length; i++) {
      const seg = strand.segments[i];

      // Straight medial chord between the two crossed-edge midpoints.
      const pe = midpoint(seg.entryEdge, positions);
      const px = midpoint(seg.exitEdge, positions);

      // Endpoint heights (edge-intrinsic) and normals (shared across the edge).
      const he = overUnder(f, edgeFamilies[seg.entryEdge.index]) * hScale;
      const hx = overUnder(f, edgeFamilies[seg.exitEdge.index]) * hScale;
      const ne = edgeNormal(mesh, seg.entryEdge, positions);
      const nx = edgeNormal(mesh, seg.exitEdge, positions);

      // Sample: straight in-plane, cosine over/under (peaks at the crossings,
      // zero slope there → C1 across edges), normal blended for curved surfaces.
      const start = i === 0 ? 0 : 1;
      for (let s = start; s <= sps; s++) {
        const t = s / sps;
        const w = (1 - Math.cos(Math.PI * t)) / 2; // 0→1, zero slope at both ends
        const h = he * (1 - w) + hx * w;
        const n = new Vector3().lerpVectors(ne, nx, t).normalize();
        points.push(new Vector3().lerpVectors(pe, px, t).addScaledVector(n, h));
      }
    }

    return points;
}

/** Straight crossing bands — needs valence ÷3 (regular grid, (p,q,r) with p,q,r ÷3). */
export const triaxialWeavePattern: Pattern<TriaxialOptions> = {
  id: 'triaxial',
  label: 'Triaxial Weave',
  cellType: 'tri',
  tile: threadTile([0, 1, 2]),
  params: TRI_PARAMS,
  generateStrandCurve: triWeaveCurve,
};

