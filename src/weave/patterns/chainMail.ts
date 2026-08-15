import { Vector3 } from 'three';
import type { Pattern, Analysis, Strand } from '../types.ts';
import { faceCenter, faceNormal, faceEdgeArray } from '../../geometry/geometry.ts';
import { catmullRom } from '../splines.ts';
import { ringTile } from '../tile/tiles.ts';
import { minLift } from '../clearance.ts';

/**
 * Chain mail — one closed ring per triangle, the rings genuinely interlock.
 *
 * On each of the face's three edges the ring enters at the 1/3-from-origin
 * point (lifted +amp, "over"), pokes a tongue ACROSS the edge into the
 * neighbour (level), and exits at the 2/3-from-origin point (−amp, "under"),
 * then cuts the corner back inside. Because the neighbouring face traverses the
 * shared edge in the opposite direction, ITS 1/3 point is OUR 2/3 point — so
 * at each shared point one ring is over and the other under automatically. The
 * two tongues cross there twice with opposite over/under → a real link, with no
 * face-colouring or valence condition (just consistent orientation).
 */
export interface ChainMailOptions {
  amplitude?: number;
  tongue?: number;
  crossing?: number;
  samplesPerSegment?: number;
}

const DEFAULT_AMPLITUDE = 0.14;
const DEFAULT_TONGUE = 0.18;
const DEFAULT_CROSSING = 0.34;
const DEFAULT_SAMPLES_PER_SEGMENT = 6;

/** Closed Catmull-Rom through the ring waypoints. */
function sampleClosed(wp: Vector3[], sps: number): Vector3[] {
  const m = wp.length;
  const pts: Vector3[] = [];
  for (let i = 0; i < m; i++) {
    const p0 = wp[(i - 1 + m) % m], p1 = wp[i], p2 = wp[(i + 1) % m], p3 = wp[(i + 2) % m];
    for (let s = 0; s < sps; s++) pts.push(catmullRom(p0, p1, p2, p3, s / sps));
  }
  return pts;
}

export const chainMailPattern: Pattern<ChainMailOptions> = {
  id: 'chainmail',
  label: 'Chain Mail',
  cellType: 'tri',
  tile: ringTile,
  params: [
    { key: 'amplitude', label: 'Over/Under', min: 0.02, max: 0.45, step: 0.01, default: DEFAULT_AMPLITUDE },
    { key: 'tongue', label: 'Tongue', min: 0.05, max: 0.6, step: 0.01, default: DEFAULT_TONGUE },
    { key: 'crossing', label: 'Crossing', min: 0.12, max: 0.45, step: 0.01, default: DEFAULT_CROSSING },
    { key: 'samplesPerSegment', label: 'Smoothness', min: 2, max: 16, step: 1, default: DEFAULT_SAMPLES_PER_SEGMENT },
  ],

  generateStrandCurve(strand: Strand, analysis: Analysis, options: ChainMailOptions): Vector3[] {
    const sps = options.samplesPerSegment ?? DEFAULT_SAMPLES_PER_SEGMENT;
    const { mesh, positions } = analysis;
    const face = strand.segments[0].face;
    const edges = faceEdgeArray(mesh, face);

    const center = faceCenter(mesh, face, positions);
    const normal = faceNormal(mesh, face, positions);

    let meanLen = 0;
    for (const e of edges) meanLen += positions[e.origin.index].distanceTo(positions[e.next.origin.index]);
    meanLen /= 3;
    // The ±amp step is what makes two tongues cross over and under at a shared
    // point, so it needs the same clearance floor as any other crossing.
    const amp = Math.max((options.amplitude ?? DEFAULT_AMPLITUDE) * meanLen, minLift(analysis, center));
    const tongueDepth = (options.tongue ?? DEFAULT_TONGUE) * meanLen;
    const cross = options.crossing ?? DEFAULT_CROSSING; // entry at `cross`, exit at 1−cross

    const wp: Vector3[] = [];
    for (let k = 0; k < 3; k++) {
      const e = edges[k];
      const o = positions[e.origin.index];
      const d = positions[e.next.origin.index];

      const r1 = new Vector3().lerpVectors(o, d, cross);     // over (+amp)
      const r2 = new Vector3().lerpVectors(o, d, 1 - cross); // under (−amp)
      const mid = new Vector3().lerpVectors(o, d, 0.5);

      // Outward in-plane direction (across the edge, away from the centroid).
      const dir = new Vector3().subVectors(d, o).normalize();
      const out = new Vector3().crossVectors(normal, dir);
      if (out.dot(new Vector3().subVectors(mid, center)) < 0) out.negate();
      const apex = mid.clone().addScaledVector(out, tongueDepth); // tongue tip, level

      wp.push(r1.clone().addScaledVector(normal, amp));   // enter: over
      wp.push(apex);                                       // poke across the edge
      wp.push(r2.clone().addScaledVector(normal, -amp));   // exit: under

      // Minimal corner: straight to the next edge's entry, hugging the boundary
      // (no dive to the centroid, no routing through the shared vertex).
      const next = edges[(k + 1) % 3];
      const no = positions[next.origin.index];
      const nd = positions[next.next.origin.index];
      const nextR1 = new Vector3().lerpVectors(no, nd, cross);
      wp.push(new Vector3().addVectors(r2, nextR1).multiplyScalar(0.5));
    }

    return sampleClosed(wp, sps);
  },
};
