/**
 * Surfaces in the 3-sphere S³ ⊂ ℝ⁴, stereographically projected to ℝ³.
 *
 * Each is a `Parametric` `(u,v) ∈ [0,1]² → ℝ³` fed to `makeParametricMesh`. The
 * sources that use these attach `stereographicTaper` as their `radiusField`, so
 * tubes keep constant *intrinsic* (spherical) width. `rot` rotates the surface in
 * S³ before projection (see `hopf.ts`) — a slider that folds the torus through
 * the projection pole.
 */

import type { Parametric } from './parametric.ts';
import { toroidalCoords, projectS3, sphericalNGon, hopfTorus } from './hopf.ts';

const TAU = 2 * Math.PI;

/**
 * Clifford torus at "latitude" η — a constant-`c` Hopf lift, `c = π/2 − η`. η = π/4
 * is the symmetric Clifford torus; other η give asymmetric tori. Both wrap.
 */
export function cliffordTorus(eta: number, rot: number): Parametric {
  const c = Math.PI / 2 - eta;
  return (u, v) => projectS3(toroidalCoords(v * TAU, u * TAU, c), rot);
}

/** Hopf torus over an n-fold symmetric S² curve (genuinely non-flat for amp > 0). */
export function hopfNGon(n: number, amp: number, rot: number): Parametric {
  return hopfTorus(sphericalNGon(n, amp), rot);
}
