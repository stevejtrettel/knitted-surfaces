import { Vector3 } from 'three';
import type { ParsedMesh } from '../types.ts';

export type Profile = (t: number) => { r: number; y: number };

/**
 * Generate a quad mesh by revolving a 2D profile curve around the Y axis.
 *
 * @param profile  Maps t ∈ [0,1] to {r, y} in the half-plane
 * @param nTheta   Number of angular slices around the Y axis
 * @param nT       Number of divisions along the profile
 * @param closed   If true the profile wraps (t=0 ≡ t=1), e.g. for a torus
 */
export function makeRevolutionMesh(
  profile: Profile,
  nTheta: number,
  nT: number,
  closed: boolean = false,
): ParsedMesh {
  const vertices: Vector3[] = [];
  const faces: number[][] = [];
  const tCount = closed ? nT : nT + 1;

  for (let i = 0; i < nTheta; i++) {
    const theta = (i / nTheta) * 2 * Math.PI;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    for (let j = 0; j < tCount; j++) {
      const t = j / nT;
      const { r, y } = profile(t);
      vertices.push(new Vector3(r * cosT, y, r * sinT));
    }
  }

  for (let i = 0; i < nTheta; i++) {
    for (let j = 0; j < nT; j++) {
      const a = i * tCount + j;
      const b = i * tCount + (j + 1) % tCount;
      const c = ((i + 1) % nTheta) * tCount + (j + 1) % tCount;
      const d = ((i + 1) % nTheta) * tCount + j;
      faces.push([a, b, c, d]);
    }
  }

  return { vertices, faces };
}
