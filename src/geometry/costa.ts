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
 * ℘ and ζ are evaluated via Jacobi θ₁ (ported from ~/Code/threejs-demos
 * `math/lattices/weierstrass.ts`), which converges exponentially — for τ=i the
 * nome is e^{-π}≈0.043, so ~8 terms give full precision. ζ uses the same θ₁ and
 * the ℘ constant c: `ζ(z) = π·θ₁′(πz)/θ₁(πz) − c·z` (with `℘ = −π²(θ₁″θ₁−θ₁′²)/θ₁² + c`).
 * Because ζ(z+1)=ζ(z)+π the surface closes over [0,1]²; the three ends (z=0,½,i/2)
 * blow up and are removed afterward by `trimByRadius`.
 */

import { Vector3 } from 'three';
import type { Parametric } from './parametric.ts';

type C = [number, number]; // complex [re, im]
const add = (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]];
const sub = (a: C, b: C): C => [a[0] - b[0], a[1] - b[1]];
const mul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const scale = (s: number, a: C): C => [s * a[0], s * a[1]];
const inv = (a: C): C => { const d = a[0] * a[0] + a[1] * a[1]; return [a[0] / d, -a[1] / d]; };
const cdiv = (a: C, b: C): C => mul(a, inv(b));
const cexp = (a: C): C => { const e = Math.exp(a[0]); return [e * Math.cos(a[1]), e * Math.sin(a[1])]; };
const csin = (w: C): C => { const e = cexp([-w[1], w[0]]), m = cexp([w[1], -w[0]]); return [(e[1] - m[1]) / 2, -(e[0] - m[0]) / 2]; };
const ccos = (w: C): C => { const e = cexp([-w[1], w[0]]), m = cexp([w[1], -w[0]]); return scale(0.5, add(e, m)); };

const TAU: C = [0, 1]; // lattice parameter τ = i (square lattice ℤ+iℤ)
const TERMS = 10;

/** q_τ^a = e^{iπτa}. */
const qpow = (a: number): C => cexp([-Math.PI * a * TAU[1], Math.PI * a * TAU[0]]);

/** d-th derivative of θ₁(v|τ): Σ 2(−1)ⁿ k^d·[+,+,−,−][d]·q^{(n+½)²}·{sin,cos}(kv). */
function theta(v: C, d: 0 | 1 | 2): C {
  const sgn = d === 2 ? -1 : 1;
  const useCos = d === 1;
  let r: C = [0, 0];
  for (let n = 0; n < TERMS; n++) {
    const s = n % 2 === 0 ? 1 : -1;
    const k = 2 * n + 1;
    const trig = useCos ? ccos(scale(k, v)) : csin(scale(k, v));
    r = add(r, scale(2 * s * sgn * Math.pow(k, d), mul(qpow((n + 0.5) * (n + 0.5)), trig)));
  }
  return r;
}

// Constant c = π²/3·E₂(τ),  E₂ = 1 − 24·Σ σ₁(n) qⁿ  (q = e^{2πiτ}); for τ=i, c = π.
const sigma1 = (n: number): number => { let s = 0; for (let d = 1; d <= n; d++) if (n % d === 0) s += d; return s; };
const C_CONST: C = (() => {
  const q = cexp([-2 * Math.PI * TAU[1], 2 * Math.PI * TAU[0]]);
  let e2: C = [1, 0], qn = q;
  for (let n = 1; n <= TERMS; n++) { e2 = sub(e2, scale(24 * sigma1(n), qn)); qn = mul(qn, q); }
  return scale(-(Math.PI * Math.PI) / 3, e2); // c = −π²/3·E₂ (sign fixes ℘ to match the lattice sum)
})();

/** ℘(z) and ζ(z) for ℤ+iℤ via θ₁. */
function pzeta(z: C): { p: C; zeta: C } {
  const v = scale(Math.PI, z);
  const f = theta(v, 0), f1 = theta(v, 1), f2 = theta(v, 2);
  const p = add(scale(-Math.PI * Math.PI, cdiv(sub(mul(f2, f), mul(f1, f1)), mul(f, f))), C_CONST);
  const zeta = sub(scale(Math.PI, cdiv(f1, f)), mul(C_CONST, z));
  return { p, zeta };
}

/** ζ only (no ℘) — for the shifted arguments. */
function zeta(z: C): C {
  const v = scale(Math.PI, z);
  return sub(scale(Math.PI, cdiv(theta(v, 1), theta(v, 0))), mul(C_CONST, z));
}

export const E1 = pzeta([0.5, 0]).p[0]; // ℘(½), real ≈ 6.875

/** Costa's minimal surface as a `(u,v)∈[0,1]² → ℝ³` map (scaled). */
export function costa(scaleAmt: number): Parametric {
  const k = Math.PI / (2 * E1);
  const c0 = (Math.PI * Math.PI) / (4 * E1);
  const zfac = Math.sqrt(2 * Math.PI) / 4;
  return (u, v) => {
    const z: C = [u, v];
    const { p: wp, zeta: wz1 } = pzeta(z);
    const wz23 = sub(zeta(sub(z, [0.5, 0])), zeta(sub(z, [0, 0.5])));
    const X = (Math.PI * u + c0 - wz1[0] + k * wz23[0]) / 2;
    const Y = (Math.PI * v + c0 + wz1[1] + k * wz23[1]) / 2;
    const r = cdiv(sub(wp, [E1, 0]), [wp[0] + E1, wp[1]]);
    const Z = zfac * 0.5 * Math.log(r[0] * r[0] + r[1] * r[1]); // (√2π/4)·ln|·|
    return new Vector3(X * scaleAmt, Z * scaleAmt, Y * scaleAmt);
  };
}
