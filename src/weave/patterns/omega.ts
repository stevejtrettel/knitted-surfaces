import { Vector3 } from 'three';
import type { Pattern, Analysis, Strand, StrandSegment } from '../types.ts';
import { edgeMidpoint, faceCenter, faceNormal } from '../../geometry/geometry.ts';
import { sampleCatmullRom } from '../splines.ts';
import { threadTile } from '../tile/tiles.ts';
import { minLift } from '../clearance.ts';

export interface OmegaOptions {
  amplitude?: number;
  samplesPerSegment?: number;
  archHeight?: number;
  /** Alternate over/under sign per face (checkerboard). Default false. */
  alternating?: boolean;
}

const DEFAULT_AMPLITUDE = 0.088;
const DEFAULT_SAMPLES_PER_SEGMENT = 4;
const DEFAULT_ARCH_HEIGHT = 1.8;

function computeOmegaWaypoints(
  analysis: Analysis,
  seg: StrandSegment,
  archHeight: number,
  amplitude: number,
  sign: number,
): Vector3[] {
  const { mesh, positions } = analysis;
  const entry = edgeMidpoint(seg.entryEdge, positions);
  const exit = edgeMidpoint(seg.exitEdge, positions);
  const center = faceCenter(mesh, seg.face, positions);
  const normal = faceNormal(mesh, seg.face, positions);

  const sideEdge = seg.topEdge;
  const sideMid = edgeMidpoint(sideEdge, positions);

  const horizontal = new Vector3().subVectors(exit, entry);
  const hLen = horizontal.length();
  const hNorm = new Vector3().copy(horizontal).normalize();
  const lateral = new Vector3().subVectors(sideMid, center);
  const lNorm = new Vector3().copy(lateral).normalize();
  const latLen = lateral.length();

  const faceAdjacent = sideEdge.twin?.face ?? null;

  let adjacentCenter: Vector3;
  let apex: Vector3;
  let apexNormal: Vector3;

  if (faceAdjacent) {
    adjacentCenter = faceCenter(mesh, faceAdjacent, positions);
    apexNormal = faceNormal(mesh, faceAdjacent, positions);
    apex = new Vector3().lerpVectors(sideMid, adjacentCenter, archHeight);
  } else {
    adjacentCenter = new Vector3().copy(sideMid).addScaledVector(lateral, 0.6);
    apexNormal = normal;
    apex = new Vector3().copy(sideMid).addScaledVector(lateral, 1.0);
  }

  const waypoints = [
    new Vector3().copy(entry).addScaledVector(lNorm, -latLen * 0.6),
    new Vector3().lerpVectors(entry, center, 0.4).addScaledVector(lNorm, -latLen * 0.6),
    new Vector3().copy(center).addScaledVector(hNorm, -hLen * 0.08),
    new Vector3().copy(adjacentCenter).addScaledVector(hNorm, -hLen * 0.42),
    apex,
    new Vector3().copy(adjacentCenter).addScaledVector(hNorm, hLen * 0.42),
    new Vector3().copy(center).addScaledVector(hNorm, hLen * 0.08),
    new Vector3().lerpVectors(exit, center, 0.4).addScaledVector(lNorm, -latLen * 0.6),
    new Vector3().copy(exit).addScaledVector(lNorm, -latLen * 0.6),
  ];

  // Arch height is a fraction of the cell, floored by the yarn's own clearance
  // (the arch is what carries the strand over its neighbour).
  const localAmplitude = Math.max(amplitude * hLen, minLift(analysis, center));
  const displacements = [-sign, -sign * 0.7, +sign, -sign * 0.5, -sign * 1.5, -sign * 0.5, +sign, -sign * 0.7, -sign];
  const normals = [normal, normal, normal, normal, apexNormal, normal, normal, normal, normal];

  return waypoints.map((p, i) => {
    const pt = p.clone();
    pt.addScaledVector(normals[i], displacements[i] * localAmplitude);
    return pt;
  });
}

export const omegaPattern: Pattern<OmegaOptions> = {
  id: 'omega',
  label: 'Omega',
  cellType: 'quad',
  tile: threadTile([0]),
  params: [
    { key: 'amplitude', label: 'Amplitude', min: 0.01, max: 0.3, step: 0.01, default: DEFAULT_AMPLITUDE },
    { key: 'samplesPerSegment', label: 'Smoothness', min: 1, max: 16, step: 1, default: DEFAULT_SAMPLES_PER_SEGMENT },
    { key: 'archHeight', label: 'Arch Height', min: 0.5, max: 3, step: 0.05, default: DEFAULT_ARCH_HEIGHT },
  ],

  generateStrandCurve(strand: Strand, analysis: Analysis, options: OmegaOptions): Vector3[] {
    const amplitude = options.amplitude ?? DEFAULT_AMPLITUDE;
    const samplesPerSegment = options.samplesPerSegment ?? DEFAULT_SAMPLES_PER_SEGMENT;
    const archHeight = options.archHeight ?? DEFAULT_ARCH_HEIGHT;
    const alternating = options.alternating ?? false;

    const points: Vector3[] = [];

    for (let i = 0; i < strand.segments.length; i++) {
      const seg = strand.segments[i];
      const sign = alternating ? seg.side : 1;

      const wp = computeOmegaWaypoints(analysis, seg, archHeight, amplitude, sign);
      const loopPoints = sampleCatmullRom(wp, samplesPerSegment, i === 0);
      points.push(...loopPoints);
    }

    return points;
  },
};
