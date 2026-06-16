import { Vector3 } from 'three';
import type { ParsedMesh } from '../types.ts';

/** Maps (u, v) ∈ [0,1]² to a point in space. */
export type Parametric = (u: number, v: number) => Vector3;

/**
 * Generate a quad mesh by sampling a parametric surface over the unit square.
 *
 * Mirrors `makeRevolutionMesh`: a regular `nu × nv` grid of quads. A direction
 * can wrap (`closedU` / `closedV`), e.g. the angular direction of a catenoid.
 *
 * Note: a wrapping direction must have an **even** division count, otherwise
 * the face-adjacency cycle is odd and the weave 2-coloring will fail.
 *
 * @param f        Surface map (u, v) ∈ [0,1]² → Vector3
 * @param nu       Divisions along u
 * @param nv       Divisions along v
 * @param closedU  If true the u direction wraps (u=0 ≡ u=1)
 * @param closedV  If true the v direction wraps (v=0 ≡ v=1)
 */
export function makeParametricMesh(
  f: Parametric,
  nu: number,
  nv: number,
  closedU: boolean = false,
  closedV: boolean = false,
): ParsedMesh {
  const vertices: Vector3[] = [];
  const faces: number[][] = [];

  const uCount = closedU ? nu : nu + 1;
  const vCount = closedV ? nv : nv + 1;

  for (let i = 0; i < uCount; i++) {
    const u = i / nu;
    for (let j = 0; j < vCount; j++) {
      vertices.push(f(u, j / nv));
    }
  }

  for (let i = 0; i < nu; i++) {
    const iN = (i + 1) % uCount;
    for (let j = 0; j < nv; j++) {
      const jN = (j + 1) % vCount;
      const a = i * vCount + j;
      const b = i * vCount + jN;
      const c = iN * vCount + jN;
      const d = iN * vCount + j;
      faces.push([a, b, c, d]);
    }
  }

  return { vertices, faces };
}
