/**
 * Costa's minimal surface — a genus-1 surface with three ends, built from the
 * Weierstrass ℘ and ζ functions on the square lattice ℤ+iℤ.
 *
 * Parametrization (verified against MathWorld's CostaMinimalSurface and the
 * user's Mathematica), over (u,v) ∈ [0,1]², with e₁ = ℘(½) ≈ 6.875:
 *   X = (π u + π²/(4e₁) − Re ζ(z) + (π/2e₁)·Re[ζ(z−½) − ζ(z−i/2)]) / 2
 *   Y = (π v + π²/(4e₁) + Im ζ(z) + (π/2e₁)·Im[ζ(z−½) − ζ(z−i/2)]) / 2
 *   Z = (√(2π)/4)·ln|(℘(z) − e₁)/(℘(z) + e₁)|
 * with z = u + iv. The vertical axis is Z (the log term).
 *
 * ℘ and ζ are evaluated by direct lattice summation (their terms are O(1/ω³), so
 * the sums converge absolutely). The surface closes over [0,1]² because
 * ζ(z+1) = ζ(z) + π cancels the πu term — so the mesh wraps; the three ends
 * (z = 0, ½, i/2) blow up and are removed afterward by `trimByRadius`.
 */

import { Vector3 } from 'three';
import type { Parametric } from './parametric.ts';

type C = [number, number]; // complex [re, im]
const sub = (a: C, b: C): C => [a[0] - b[0], a[1] - b[1]];
const mul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const inv = (a: C): C => { const d = a[0] * a[0] + a[1] * a[1]; return [a[0] / d, -a[1] / d]; };

const N = 16; // lattice rings (ℤ+iℤ); sums are absolutely convergent

/** ℘(z) and ζ(z) for the lattice ℤ+iℤ by direct summation. */
function pzeta(z: C): { p: C; zeta: C } {
  let p: C = inv(mul(z, z));   // 1/z²
  let zeta: C = inv(z);        // 1/z
  for (let m = -N; m <= N; m++) {
    for (let n = -N; n <= N; n++) {
      if (m === 0 && n === 0) continue;
      const w: C = [m, n];
      const zw = sub(z, w);
      const iZw = inv(zw);
      const iW = inv(w);
      const iW2 = mul(iW, iW);
      // ℘: 1/(z−ω)² − 1/ω²
      p = [p[0] + iZw[0] * iZw[0] - iZw[1] * iZw[1] - iW2[0], p[1] + 2 * iZw[0] * iZw[1] - iW2[1]];
      // ζ: 1/(z−ω) + 1/ω + z/ω²
      const zOverW2 = mul(z, iW2);
      zeta = [zeta[0] + iZw[0] + iW[0] + zOverW2[0], zeta[1] + iZw[1] + iW[1] + zOverW2[1]];
    }
  }
  return { p, zeta };
}

const E1 = pzeta([0.5, 0]).p[0]; // ℘(½), real ≈ 6.875

/** Costa's minimal surface as a `(u,v)∈[0,1]² → ℝ³` map (scaled). */
export function costa(scale: number): Parametric {
  const TAU = Math.PI * 2;
  const k = Math.PI / (2 * E1);
  const c0 = (Math.PI * Math.PI) / (4 * E1);
  const zfac = Math.sqrt(TAU) / 4;
  return (u, v) => {
    const z: C = [u, v];
    const { p: wp, zeta: wz1 } = pzeta(z);
    const za = pzeta(sub(z, [0.5, 0])).zeta;
    const zb = pzeta(sub(z, [0, 0.5])).zeta;
    const wz23: C = [za[0] - zb[0], za[1] - zb[1]];
    const X = (Math.PI * u + c0 - wz1[0] + k * wz23[0]) / 2;
    const Y = (Math.PI * v + c0 + wz1[1] + k * wz23[1]) / 2;
    const num = sub(wp, [E1, 0]);
    const den: C = [wp[0] + E1, wp[1]];
    const r = mul(num, inv(den));
    const Z = zfac * 0.5 * Math.log(r[0] * r[0] + r[1] * r[1]); // (√2π/4)·ln|·|
    return new Vector3(X * scale, Z * scale, Y * scale);
  };
}
