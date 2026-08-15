import { Vector3 } from 'three';
import type { Pattern, Analysis, Strand, StrandSegment } from '../types.ts';
import { faceCenter, faceNormal } from '../../geometry/geometry.ts';
import { cornerTile } from '../tile/tiles.ts';
import { minLift } from '../clearance.ts';

/**
 * Two corner-arc weaves on the same tile (three arcs per triangle, one flanking
 * each vertex). The stitcher joins the arcs across edges (our 2/3 is the
 * neighbour's 1/3), so each strand here already spans many triangles; we render
 * every segment and concatenate.
 *
 * In-plane: cubic Béziers that leave each port along the inward edge-normal
 * (**orthogonal to the edge**) so a neighbour's arc joins with colinear tangents.
 * Both the tangent length and the height are scaled by the port-to-port CHORD,
 * not the edge length, so the curve stays smooth on any triangle (thin Schwarz
 * domains included) instead of cusping — see `segmentArc`.
 *
 * Height: a HELD over/under step (not a sine). The strand holds ±amp flat across
 * the ports and flips once in the cell interior, so it stays over (or under) all
 * the way across a tile edge instead of returning to mid-height — see `segmentArc`.
 *
 * The ONLY difference between the two patterns is which two ports each arc
 * connects (carried by the tile as the segment's entry/exit `t`):
 *
 *  • Linked Corners (simple) — ports by OPPOSITE corners (entry 1/3, exit 2/3):
 *    a through-arc straight into the centre, crossing each neighbour ONCE there.
 *
 *  • Triquetra (complex) — ports flanking the SAME corner (entry 2/3, exit 1/3):
 *    the arc loops past the centroid, so each pair crosses TWICE — a genuine
 *    trinity-knot link, richer but busier.
 */
export interface LinkedCornersOptions {
  amplitude?: number;
  reach?: number;
  flip?: number;
  samplesPerSegment?: number;
}

const ss5 = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * c * (c * (c * 6 - 15) + 10);
};

/** Render one stitched segment as a cubic corner-arc, reading its port `t`s. */
function segmentArc(
  seg: StrandSegment,
  analysis: Analysis,
  reach: number,
  amplitude: number,
  flip: number,
  N: number,
  includeFirst: boolean,
): Vector3[] {
  const { mesh, positions } = analysis;

  const eo = positions[seg.entryEdge.origin.index];
  const ed = positions[seg.entryEdge.next.origin.index];
  const xo = positions[seg.exitEdge.origin.index];
  const xd = positions[seg.exitEdge.next.origin.index];

  const p1 = new Vector3().lerpVectors(eo, ed, seg.entry.t);
  const p2 = new Vector3().lerpVectors(xo, xd, seg.exit.t);

  const g = faceCenter(mesh, seg.face, positions);
  const n = faceNormal(mesh, seg.face, positions);
  // Scale the curve's strength by the actual port-to-port CHORD (the arc's own
  // span), NOT the triangle's edge length. Edge length is shape-blind: on a thin
  // scalene triangle a short corner arc would get long tangents and a tall
  // over/under hump sized by the long edge, and double back into a cusp.
  // Chord-scaling ties the bend and the lift to the local feature size, so the
  // curve stays smooth on ANY triangle — equilateral or thin Schwarz alike
  // (measured max turning angle drops from ~168° to ~31° on a (2,3,7) tiling).
  const chord = p1.distanceTo(p2);
  // Face 2-colour flips the held over/under handedness (z→−z) on neighbouring
  // triangles, so the held level stays continuous across each shared port.
  const sign = analysis.faceColors[seg.face.index] === 0 ? 1 : -1;
  const amp = sign * Math.max(amplitude * chord, minLift(analysis, g));
  const d = reach * chord;

  // Inward edge-normal at each port (perpendicular to that edge, toward the
  // centroid): the cubic leaves the port along it → orthogonal to the edge.
  const inward = (port: Vector3, eFrom: Vector3, eTo: Vector3): Vector3 => {
    const dir = new Vector3().subVectors(eTo, eFrom);
    const nrm = new Vector3().crossVectors(n, dir);
    if (nrm.lengthSq() > 1e-12) nrm.normalize();
    if (nrm.dot(new Vector3().subVectors(g, port)) < 0) nrm.negate();
    return nrm;
  };
  const c1 = p1.clone().addScaledVector(inward(p1, eo, ed), d);
  const c2 = p2.clone().addScaledVector(inward(p2, xo, xd), d);

  // Over/under as a HELD step, not a sine. The height stays flat at ±amp across
  // the ports (so the strand holds its level over the tile edge — no return to
  // zero, no "W") and flips once, in the segment interior, via a smootherstep
  // centred at t=0.5. The two intra-face crossings sit at complementary
  // parameters either side of the flip, so crossing strands meet at OPPOSITE
  // held heights (clean over/under); the per-face sign flip makes the held level
  // continuous across each shared port.
  const W = Math.min(0.49, Math.max(0.02, flip)); // transition half-width; smaller = flatter holds / sharper flip
  const pts: Vector3[] = [];
  for (let s = includeFirst ? 0 : 1; s <= N; s++) {
    const t = s / N;
    const u = 1 - t;
    const base = new Vector3()
      .addScaledVector(p1, u * u * u)
      .addScaledVector(c1, 3 * u * u * t)
      .addScaledVector(c2, 3 * u * t * t)
      .addScaledVector(p2, t * t * t);
    const z = amp * (1 - 2 * ss5((t - (0.5 - W)) / (2 * W)));
    pts.push(base.addScaledVector(n, z));
  }
  return pts;
}

/** Shared draw: render every stitched segment and concatenate. Joins are smooth
 *  because the in-plane tangents are orthogonal to the shared edge and the height
 *  is held flat (constant level, zero slope) across each port. */
function cornerWeaveCurve(
  strand: Strand,
  analysis: Analysis,
  options: LinkedCornersOptions,
  defaultReach: number,
  defaultAmp: number,
): Vector3[] {
  const reach = options.reach ?? defaultReach;
  const amplitude = options.amplitude ?? defaultAmp;
  const flip = options.flip ?? 0.22;
  const N = Math.max(4, options.samplesPerSegment ?? 12) * 2;

  const points: Vector3[] = [];
  for (let i = 0; i < strand.segments.length; i++) {
    const seg = strand.segments[i];
    points.push(...segmentArc(seg, analysis, reach, amplitude, flip, N, i === 0));
  }
  return points;
}

/** Simple: through-arcs, one central crossing per pair (3-cycle weave). */
export const centralLinkPattern: Pattern<LinkedCornersOptions> = {
  id: 'linkedcorners',
  label: 'Linked Corners',
  cellType: 'tri',
  tile: cornerTile(1 / 3, 2 / 3),
  params: [
    { key: 'amplitude', label: 'Over/Under', min: 0.02, max: 0.8, step: 0.01, default: 0.2 },
    { key: 'reach', label: 'Reach', min: 0.2, max: 1.3, step: 0.01, default: 0.6 },
    { key: 'flip', label: 'Flip Width', min: 0.04, max: 0.5, step: 0.01, default: 0.22 },
    { key: 'samplesPerSegment', label: 'Smoothness', min: 4, max: 24, step: 1, default: 12 },
  ],
  generateStrandCurve(strand, analysis, options) {
    return cornerWeaveCurve(strand, analysis, options, 0.6, 0.18);
  },
};

/** Complex: corner-flank loops, two crossings per pair (trinity-knot link). */
export const triquetraPattern: Pattern<LinkedCornersOptions> = {
  id: 'triquetra',
  label: 'Triquetra',
  cellType: 'tri',
  tile: cornerTile(2 / 3, 1 / 3),
  params: [
    { key: 'amplitude', label: 'Over/Under', min: 0.02, max: 0.8, step: 0.01, default: 0.2 },
    { key: 'reach', label: 'Reach', min: 0.8, max: 2.6, step: 0.01, default: 0.85 },
    { key: 'flip', label: 'Flip Width', min: 0.04, max: 0.5, step: 0.01, default: 0.22 },
    { key: 'samplesPerSegment', label: 'Smoothness', min: 4, max: 24, step: 1, default: 12 },
  ],
  generateStrandCurve(strand, analysis, options) {
    return cornerWeaveCurve(strand, analysis, options, 0.85, 0.18);
  },
};
