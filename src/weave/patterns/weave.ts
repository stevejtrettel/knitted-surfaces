import { Vector3 } from 'three';
import type { Pattern, Analysis, Strand } from '../types.ts';
import { edgeMidpoint, faceCenter, faceNormal } from '../../geometry/geometry.ts';
import { sampleHermite } from '../splines.ts';
import { threadTile } from '../tile/tiles.ts';
import { liftAt } from '../clearance.ts';

export interface WeaveOptions {
  amplitude?: number;
  samplesPerSegment?: number;
}

const DEFAULT_AMPLITUDE = 0.05;
const DEFAULT_SAMPLES_PER_SEGMENT = 8;

export const weavePattern: Pattern<WeaveOptions> = {
  id: 'weave',
  label: 'Weave',
  cellType: 'quad',
  tile: threadTile([0, 1]),
  params: [
    { key: 'amplitude', label: 'Amplitude', min: 0.01, max: 0.3, step: 0.01, default: DEFAULT_AMPLITUDE },
    { key: 'samplesPerSegment', label: 'Smoothness', min: 1, max: 24, step: 1, default: DEFAULT_SAMPLES_PER_SEGMENT },
  ],

  generateStrandCurve(strand: Strand, analysis: Analysis, options: WeaveOptions): Vector3[] {
    const amplitude = options.amplitude ?? DEFAULT_AMPLITUDE;
    const samplesPerSegment = options.samplesPerSegment ?? DEFAULT_SAMPLES_PER_SEGMENT;
    const { mesh, positions } = analysis;

    const points: Vector3[] = [];

    for (let i = 0; i < strand.segments.length; i++) {
      const seg = strand.segments[i];
      const isFirst = i === 0;

      const p0 = edgeMidpoint(seg.entryEdge, positions);
      const p1 = edgeMidpoint(seg.exitEdge, positions);

      const center = faceCenter(mesh, seg.face, positions);
      const normal = faceNormal(mesh, seg.face, positions);

      const dist = p0.distanceTo(p1);
      const tangentScale = 0.5 * dist;
      const t0 = new Vector3().subVectors(center, p0).normalize().multiplyScalar(tangentScale);
      const t1 = new Vector3().subVectors(p1, center).normalize().multiplyScalar(tangentScale);

      const basePoints = sampleHermite(p0, p1, t0, t1, samplesPerSegment, isFirst);

      // Lift is the artistic amplitude, floored by what the yarn's own thickness
      // needs to clear the strand it crosses at this cell's centre.
      const lift = seg.side * liftAt(analysis, center, amplitude);

      for (let j = 0; j < basePoints.length; j++) {
        const tParam = isFirst ? j / samplesPerSegment : (j + 1) / samplesPerSegment;
        const displacement = lift * Math.sin(Math.PI * tParam);
        basePoints[j].addScaledVector(normal, displacement);
      }

      points.push(...basePoints);
    }

    return points;
  },
};
