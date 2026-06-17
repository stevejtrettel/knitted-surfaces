/**
 * Hopf fibration → tori in ℝ³.
 *
 * Ported (trimmed to what a weave mesh needs) from ~/Code/threejs-demos
 * `src/math/hopf`. The chain is: a closed curve on S² → Hopf lift to S³ ⊂ ℝ⁴ →
 * stereographic projection to ℝ³. A *non-circular* S² curve is what makes a
 * genuine Hopf torus — a circle gives back a Clifford torus.
 *
 * Uses the **isometric** embedding (ported from ~/Code/lifting-modp
 * `js/items/HopfTorus.js`): the unit square maps through the flat fundamental
 * domain (fiber generator (2π,0), edge generator (holonomy, L/2)) with an
 * arc-length + holonomy ("fudge") correction, so stitches are evenly spaced on
 * the surface. It still wraps cleanly on `makeParametricMesh`'s rectangular grid:
 * the shear in `s` is exactly cancelled by the fudge term inside
 * `toroidalCoords(theta+s−f, s−f, …)`, so `evaluate(u, v→1) → evaluate(u, 0)`.
 *
 * `projectS3` rotates the S³ point before projecting: it mixes the two complex
 * planes, so it genuinely reshapes the torus (a Hopf-fiber rotation would just
 * slide the parametrisation) and can fold it through the projection pole.
 */

import { Vector3, Vector4 } from 'three';
import type { Parametric } from './parametric.ts';

const TAU = 2 * Math.PI;

export function toSpherical(p: Vector3): { theta: number; phi: number } {
  return { theta: Math.atan2(p.y, p.x), phi: Math.acos(Math.max(-1, Math.min(1, p.z))) };
}

export function fromSphericalCoords(theta: number, phi: number): Vector3 {
  return new Vector3(Math.cos(theta) * Math.sin(phi), Math.sin(theta) * Math.sin(phi), Math.cos(phi));
}

/** Hopf lift to S³, reordered to (x, z, -y, w) to match the reference orientation. */
export function toroidalCoords(a: number, b: number, c: number): Vector4 {
  const sc = Math.sin(c), cc = Math.cos(c);
  return new Vector4(Math.cos(a) * sc, Math.cos(b) * cc, -Math.sin(a) * sc, Math.sin(b) * cc);
}

/**
 * Rotate the S³ point's (z, w) — these lie in different complex planes, so this
 * reshapes the torus and slides it through the pole — then stereographically
 * project to ℝ³ as (y, −x, w′)/(1 − z′).
 */
export function projectS3(p: Vector4, rot: number): Vector3 {
  const ca = Math.cos(rot), sa = Math.sin(rot);
  const z = p.z * ca - p.w * sa;
  const w = p.z * sa + p.w * ca;
  const denom = 1 - z;
  if (Math.abs(denom) < 1e-9) {
    const s = 1e9;
    return new Vector3(p.y * s, -p.x * s, w * s);
  }
  return new Vector3(p.y / denom, -p.x / denom, w / denom);
}

/**
 * An n-fold symmetric closed curve on S² (from the reference's curve library):
 * φ = π/2 + amp·cos(n·t), θ = t + amp·sin(2n·t). `n` sets the symmetry, `amp`
 * the lobe depth. amp = 0 is the equator (→ a Clifford torus).
 */
export function sphericalNGon(n: number, amp: number): (t: number) => Vector3 {
  return (t) => fromSphericalCoords(t + amp * Math.sin(2 * n * t), Math.PI / 2 + amp * Math.cos(n * t));
}

/**
 * Isometric Hopf torus over an S² curve, stereo-projected (with S³ rotation
 * `rot`). Precomputes arc-length + holonomy ("fudge") tables, then maps the unit
 * square through the flat fundamental domain so stitches are even on the surface.
 */
export function hopfTorus(curve: (t: number) => Vector3, rot: number, resolution = 2048): Parametric {
  const N = resolution;
  const dt = TAU / N;
  const arc = new Float64Array(N + 1);
  const fudge = new Float64Array(N + 1);
  let arcSum = 0;
  let fudgeSum = 0;

  for (let i = 0; i < N; i++) {
    const s0 = toSpherical(curve(i * dt));
    const s1 = toSpherical(curve((i + 1) * dt));
    let dtheta = s1.theta - s0.theta;
    if (dtheta > Math.PI) dtheta -= TAU;
    if (dtheta < -Math.PI) dtheta += TAU;
    const dphi = s1.phi - s0.phi;
    const sinPhi = Math.sin(s0.phi);
    arcSum += Math.sqrt(sinPhi * sinPhi * dtheta * dtheta + dphi * dphi);
    const sh = Math.sin(s0.phi / 2);
    fudgeSum += sh * sh * dtheta; // holonomy increment ∫ sin²(φ/2) dθ
    arc[i + 1] = arcSum;
    fudge[i + 1] = fudgeSum;
  }

  const totalLength = arcSum;
  const genX = fudgeSum;        // edge generator x = total holonomy (= enclosed area / 2)
  const genY = totalLength / 2; // edge generator y

  const lerpFudge = (t: number): number => {
    const f = (t / TAU) * N;
    const i = Math.max(0, Math.min(N - 1, Math.floor(f)));
    return fudge[i] + (f - i) * (fudge[i + 1] - fudge[i]);
  };
  const inverseArc = (L: number): number => {
    if (L <= 0) return 0;
    if (L >= totalLength) return TAU;
    let lo = 0, hi = N;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (arc[mid] <= L) lo = mid; else hi = mid;
    }
    return ((lo + (L - arc[lo]) / (arc[hi] - arc[lo])) / N) * TAU;
  };

  return (u, v) => {
    // Fundamental-domain point: u·(2π,0) + v·(holonomy, L/2).
    const x = u * TAU + v * genX;
    const t = inverseArc(2 * (v * genY)); // curve param at this arc length
    const { theta, phi } = toSpherical(curve(t));
    const f = lerpFudge(t);
    return projectS3(toroidalCoords(theta + x - f, x - f, phi / 2), rot);
  };
}

