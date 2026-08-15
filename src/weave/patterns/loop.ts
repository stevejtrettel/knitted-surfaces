import { Vector3 } from 'three';
import type { Pattern, Analysis, Strand, StrandSegment } from '../types.ts';
import { edgeMidpoint, faceCenter, faceNormal } from '../../geometry/geometry.ts';
import { sampleCatmullRom } from '../splines.ts';
import { threadTile } from '../tile/tiles.ts';
import { minLift } from '../clearance.ts';

export interface LoopOptions {
  amplitude?: number;
  samplesPerSegment?: number;
  loopHeight?: number;
}

const DEFAULT_AMPLITUDE = 0.15;
const DEFAULT_SAMPLES_PER_SEGMENT = 5;
const DEFAULT_LOOP_HEIGHT = 1.5;

function computeLoopWaypoints(
  analysis: Analysis,
  seg: StrandSegment,
  loopHeight: number,
  amplitude: number,
  sign: number,
): Vector3[] {
  const { mesh, positions } = analysis;
  const entry = edgeMidpoint(seg.entryEdge, positions);
  const exit = edgeMidpoint(seg.exitEdge, positions);
  const center = faceCenter(mesh, seg.face, positions);
  const normal = faceNormal(mesh, seg.face, positions);

  const topVEdge = seg.topEdge;
  const topMid = edgeMidpoint(topVEdge, positions);

  const horizontal = new Vector3().subVectors(exit, entry);
  const hLen = horizontal.length();
  const hNorm = new Vector3().copy(horizontal).normalize();
  const vertical = new Vector3().subVectors(topMid, center);
  const vNorm = new Vector3().copy(vertical).normalize();
  const delta = vertical.length() * 0.2;

  const faceAbove = topVEdge.twin?.face ?? null;

  let aboveCenterPos: Vector3;
  let apex: Vector3;
  let apexNormal: Vector3;

  if (faceAbove) {
    aboveCenterPos = faceCenter(mesh, faceAbove, positions);
    apexNormal = faceNormal(mesh, faceAbove, positions);
    apex = new Vector3().lerpVectors(topMid, aboveCenterPos, loopHeight);
  } else {
    aboveCenterPos = new Vector3().copy(topMid).addScaledVector(vertical, 0.6);
    apexNormal = normal;
    apex = new Vector3().copy(topMid).addScaledVector(vertical, 1.0);
  }

  const waypoints = [
    entry,
    new Vector3().copy(center).addScaledVector(hNorm, hLen * 0.15).addScaledVector(vNorm, delta),
    new Vector3().copy(aboveCenterPos).addScaledVector(hNorm, hLen * 0.25),
    apex,
    new Vector3().copy(aboveCenterPos).addScaledVector(hNorm, hLen * -0.25),
    new Vector3().copy(center).addScaledVector(hNorm, hLen * -0.1).addScaledVector(vNorm, -delta),
    exit,
  ];

  // Amplitude is a fraction of the stitch's own width, floored by the lift the
  // yarn needs to clear the loop it passes through.
  const localAmplitude = Math.max(amplitude * hLen, minLift(analysis, center));
  const displacements = [0, -sign, -sign, 0, sign, +sign, 0];
  const normals = [normal, normal, normal, apexNormal, normal, normal, normal];

  return waypoints.map((p, i) => {
    const pt = p.clone();
    pt.addScaledVector(normals[i], displacements[i] * localAmplitude);
    return pt;
  });
}

export const loopPattern: Pattern<LoopOptions> = {
  id: 'loop',
  label: 'Loop (Knit)',
  cellType: 'quad',
  tile: threadTile([0]),
  params: [
    { key: 'amplitude', label: 'Amplitude', min: 0.01, max: 0.5, step: 0.01, default: DEFAULT_AMPLITUDE },
    { key: 'samplesPerSegment', label: 'Smoothness', min: 1, max: 16, step: 1, default: DEFAULT_SAMPLES_PER_SEGMENT },
    { key: 'loopHeight', label: 'Loop Height', min: 0.5, max: 3, step: 0.05, default: DEFAULT_LOOP_HEIGHT },
  ],

  generateStrandCurve(strand: Strand, analysis: Analysis, options: LoopOptions): Vector3[] {
    const amplitude = options.amplitude ?? DEFAULT_AMPLITUDE;
    const samplesPerSegment = options.samplesPerSegment ?? DEFAULT_SAMPLES_PER_SEGMENT;
    const loopHeight = options.loopHeight ?? DEFAULT_LOOP_HEIGHT;

    const points: Vector3[] = [];

    for (let i = 0; i < strand.segments.length; i++) {
      const seg = strand.segments[i];

      const wp = computeLoopWaypoints(analysis, seg, loopHeight, amplitude, seg.side);
      const loopPoints = sampleCatmullRom(wp, samplesPerSegment, i === 0);
      points.push(...loopPoints);
    }

    return points;
  },
};
