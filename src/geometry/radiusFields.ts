/**
 * Metric-driven tube-radius falloffs (see `RadiusField`).
 *
 * These return the local metric scale factor in [0,1] — 1 at the centre, → 0 at
 * the boundary — which `applyRadiusTaper` bakes into per-point tube radii so a
 * constant base radius renders as a tube of constant *intrinsic* width.
 */

import type { RadiusField } from './types.ts';
import type { DiskModel } from './tilings/triangleGroup.ts';

/**
 * The hyperbolic metric scale factor for a flat disk in the xz-plane: the
 * Poincaré conformal factor `sech²(d/2)`, where `d` is the hyperbolic distance of
 * the point from the disk centre. A tube of constant base radius then has
 * constant hyperbolic width — thick at the centre, thinning toward the boundary
 * exactly as the metric dictates (not a tunable choice). `diskRadius` is the
 * Euclidean radius of the disk boundary (the projection scale); `model` is how
 * the tiling was projected, so `d` is recovered correctly from the Euclidean
 * radius (Klein: r = tanh d; Poincaré: r = tanh(d/2), where r = ρ/diskRadius).
 */
export function metricTaper(diskRadius: number, model: DiskModel): RadiusField {
  const R = Math.max(1e-9, diskRadius);
  return (p) => {
    const u = Math.min(0.999999, Math.hypot(p.x, p.z) / R); // unit-disk radius
    const d = model === 'klein' ? Math.atanh(u) : 2 * Math.atanh(u); // hyperbolic distance
    const ch = Math.cosh(d / 2);
    return 1 / (ch * ch); // sech²(d/2)  (= 1 − r² in Poincaré coordinates)
  };
}

/**
 * Tube scaling for a stereographically projected surface (e.g. a Hopf torus
 * projected S³ → ℝ³). Stereographic projection has conformal factor
 * 2/(1+|p|²), so a tube of constant *intrinsic* (spherical) width renders with
 * radius ∝ (1+|p|²) — it grows away from the origin (the projection compresses
 * far regions). Returns `1 + strength·|p|²` (1 at the origin); `strength` scales
 * the growth (0 = uniform width, 1 = the exact metric factor).
 */
export function stereographicTaper(strength = 1): RadiusField {
  return (p) => 1 + strength * (p.x * p.x + p.y * p.y + p.z * p.z);
}
