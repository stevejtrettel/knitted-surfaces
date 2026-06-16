/**
 * Spline interpolation utilities.
 */

import { Vector3 } from 'three';

/** Sample a cubic Hermite spline between two points with tangent vectors. */
export function sampleHermite(
  p0: Vector3,
  p1: Vector3,
  t0: Vector3,
  t1: Vector3,
  numSamples: number,
  includeFirst: boolean
): Vector3[] {
  const points: Vector3[] = [];
  const start = includeFirst ? 0 : 1;

  for (let i = start; i <= numSamples; i++) {
    const t = i / numSamples;
    const t2 = t * t;
    const t3 = t2 * t;

    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;

    points.push(
      new Vector3()
        .addScaledVector(p0, h00)
        .addScaledVector(t0, h10)
        .addScaledVector(p1, h01)
        .addScaledVector(t1, h11)
    );
  }

  return points;
}

/** Evaluate a single Catmull-Rom point. */
export function catmullRom(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, t: number): Vector3 {
  const t2 = t * t;
  const t3 = t2 * t;
  return new Vector3(
    0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
  );
}

/**
 * Sample a Catmull-Rom spline through a series of waypoints.
 *
 * `samplesPerSegment` controls how many output points are generated
 * per span between consecutive waypoints.  At 1, you get the
 * waypoints themselves (straight-line edges); higher values give a
 * smoother curve.
 */
export function sampleCatmullRom(
  waypoints: Vector3[],
  samplesPerSegment: number,
  includeFirst: boolean,
): Vector3[] {
  const n = waypoints.length;

  const padded = [
    new Vector3().subVectors(waypoints[0], new Vector3().subVectors(waypoints[1], waypoints[0])),
    ...waypoints,
    new Vector3().subVectors(waypoints[n - 1], new Vector3().subVectors(waypoints[n - 2], waypoints[n - 1])),
  ];

  const numSegments = n - 1;
  const totalSamples = samplesPerSegment * numSegments;
  const points: Vector3[] = [];
  const start = includeFirst ? 0 : 1;

  for (let i = start; i <= totalSamples; i++) {
    const t = i / totalSamples;
    const segFloat = t * numSegments;
    const segIdx = Math.min(Math.floor(segFloat), numSegments - 1);
    const s = segFloat - segIdx;

    points.push(catmullRom(
      padded[segIdx], padded[segIdx + 1], padded[segIdx + 2], padded[segIdx + 3], s,
    ));
  }

  return points;
}
