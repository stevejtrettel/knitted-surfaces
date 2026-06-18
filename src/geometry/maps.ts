/**
 * Surface maps — the math fed to `makeParametricMesh` / `makeTriangleGrid`.
 *
 * Everything here is a `Parametric` map (u,v) ∈ [0,1]² → Vector3, or a profile
 * that becomes one via `revolutionMap`. Surfaces of revolution and flat grids
 * are not special builders any more — just particular maps.
 */

import { Vector3 } from 'three';
import type { Parametric } from './parametric.ts';

const TAU = Math.PI * 2;

// ── Minimal complex arithmetic (for Weierstrass–Enneper maps) ──
type C2 = [number, number];
const cmul = (a: C2, b: C2): C2 => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cinv = (z: C2): C2 => { const d = z[0] * z[0] + z[1] * z[1]; return [z[0] / d, -z[1] / d]; };
const cpow = (z: C2, n: number): C2 => { let r: C2 = [1, 0]; for (let i = 0; i < n; i++) r = cmul(r, z); return r; };

// ── Surfaces of revolution ─────────────────────────────────────

/** A revolution profile: t ∈ [0,1] → {r, y} in the half-plane. */
export type Profile = (t: number) => { r: number; y: number };

/** Turn a profile into a parametric surface (u = angle, v = profile param). */
export function revolutionMap(profile: Profile): Parametric {
  return (u, v) => {
    const theta = u * TAU;
    const { r, y } = profile(v);
    return new Vector3(r * Math.cos(theta), y, r * Math.sin(theta));
  };
}

export interface ProfileDef {
  label: string;
  profile: Profile;
  /** Whether the profile wraps (t=0 ≡ t=1), e.g. a torus. */
  closed: boolean;
}

export const profiles: Record<string, ProfileDef> = {
  Torus: {
    label: 'Torus',
    closed: true,
    profile: (t) => {
      const a = t * TAU;
      return { r: 1.5 + 0.7 * Math.cos(a), y: 0.7 * Math.sin(a) };
    },
  },
  Blob: {
    label: 'Blob',
    closed: true,
    profile: (t) => {
      const a = t * TAU;
      const r = Math.cos(a) + 0.2 * Math.sin(7 * a);
      const y = 2 * Math.sin(a) + 0.2 * Math.cos(5 * a);
      return { r: 1.5 + r, y };
    },
  },
  Vase: {
    label: 'Vase',
    closed: false,
    profile: (t) => {
      const y = t * 4 - 2;
      const r = 0.6 + 0.4 * Math.cos(y * 1.2) + 0.15 * Math.sin(y * 3);
      return { r, y };
    },
  },
  Sphere: {
    label: 'Sphere',
    closed: false,
    profile: (t) => {
      const a = t * Math.PI;
      return { r: 1.2 * Math.sin(a), y: 1.2 * Math.cos(a) };
    },
  },
  Hourglass: {
    label: 'Hourglass',
    closed: false,
    profile: (t) => {
      const y = t * 3 - 1.5;
      const r = 0.3 + 0.8 * Math.abs(Math.sin(y * 1.2));
      return { r, y };
    },
  },
};

// ── General parametric surfaces ────────────────────────────────

export const helicoid: Parametric = (u, v) => {
  const U = (2 * u - 1) * 1.3;
  const V = (v - 0.5) * 3 * TAU;
  const c = 0.18;
  return new Vector3(U * Math.cos(V), c * V, U * Math.sin(V));
};

export const catenoid: Parametric = (u, v) => {
  const U = (2 * u - 1) * 1.1;
  const V = v * TAU;
  const r = 0.55 * Math.cosh(U);
  return new Vector3(r * Math.cos(V), U, r * Math.sin(V));
};

export const enneper: Parametric = (u, v) => {
  const U = (2 * u - 1) * 2.0;
  const V = (2 * v - 1) * 2.0;
  const s = 0.16;
  return new Vector3(
    s * (U - (U * U * U) / 3 + U * V * V),
    s * (U * U - V * V),
    s * (V - (V * V * V) / 3 + V * U * U),
  );
};

export const monkeySaddle: Parametric = (u, v) => {
  const X = (2 * u - 1) * 1.2;
  const Y = (2 * v - 1) * 1.2;
  const s = 1.2;
  return new Vector3(X * s, (X * X * X - 3 * X * Y * Y) * s, Y * s);
};

/** Scherk's doubly-periodic minimal surface: a saddle tower, z = ln(cos x / cos y). */
export const scherk: Parametric = (u, v) => {
  const s = 1.45; // domain just inside the ±π/2 asymptotes
  const x = (2 * u - 1) * s;
  const y = (2 * v - 1) * s;
  return new Vector3(x, 0.7 * Math.log(Math.cos(x) / Math.cos(y)), y);
};

/** Dini's surface — a twisted pseudosphere (constant negative curvature). */
export const dini: Parametric = (u, v) => {
  const a = 0.8, b = 0.2;
  const U = u * 2 * TAU;                 // two turns of the twist
  const V = 0.15 + v * 1.35;            // (0, ~π/2), away from the v→0 singularity
  return new Vector3(
    a * Math.cos(U) * Math.sin(V),
    a * (Math.cos(V) + Math.log(Math.tan(V / 2))) + b * U,
    a * Math.sin(U) * Math.sin(V),
  );
};

/** Kuen surface — a constant-negative-curvature surface with a bulb and tail. */
export const kuen: Parametric = (u, v) => {
  const U = (2 * u - 1) * 4.5;
  const V = 0.5 + v * 2.4;             // (0, π), clamped off both ln-singular ends
  const sv = Math.sin(V);
  const denom = 1 + U * U * sv * sv;
  return new Vector3(
    0.7 * 2 * (Math.cos(U) + U * Math.sin(U)) * sv / denom,
    0.7 * (Math.log(Math.tan(V / 2)) + 2 * Math.cos(V) / denom),
    0.7 * 2 * (Math.sin(U) - U * Math.cos(U)) * sv / denom,
  );
};

/**
 * The classic "bottle" Klein immersion — piecewise in v ∈ [0,4π] (rounded bottom,
 * rising body, the handle bending over, and the neck plunging back through the
 * wall). The cross-section u wraps; v runs the length (its two ends coincide in
 * space, so the bottle reads as closed). Ported from Code/World kleinBottle.
 */
export const kleinClassic: Parametric = (a, b) => {
  const u = a * TAU;       // cross-section (wraps)
  const v = b * 2 * TAU;   // length, 0..4π
  let x: number, y: number, z: number;
  if (v < Math.PI) {
    x = (2.5 - 1.5 * Math.cos(v)) * Math.cos(u); y = (2.5 - 1.5 * Math.cos(v)) * Math.sin(u); z = -2.5 * Math.sin(v);
  } else if (v < 2 * Math.PI) {
    x = (2.5 - 1.5 * Math.cos(v)) * Math.cos(u); y = (2.5 - 1.5 * Math.cos(v)) * Math.sin(u); z = 3 * v - 3 * Math.PI;
  } else if (v < 3 * Math.PI) {
    x = -2 + (2 + Math.cos(u)) * Math.cos(v); y = Math.sin(u); z = (2 + Math.cos(u)) * Math.sin(v) + 3 * Math.PI;
  } else {
    x = -2 + 2 * Math.cos(v) - Math.cos(u); y = Math.sin(u); z = -3 * v + 12 * Math.PI;
  }
  return new Vector3(x, z - 4, y).multiplyScalar(0.395); // their z is the vertical axis
};

/** Klein bottle — the figure-8 immersion (wraps both ways; non-orientable). */
export const kleinBottle: Parametric = (u, v) => {
  const U = u * TAU, V = v * TAU;
  const c = Math.cos(U / 2) * Math.sin(V) - Math.sin(U / 2) * Math.sin(2 * V);
  return new Vector3(
    0.6 * (2 + c) * Math.cos(U),
    0.6 * (Math.sin(U / 2) * Math.sin(V) + Math.cos(U / 2) * Math.sin(2 * V)),
    0.6 * (2 + c) * Math.sin(U),
  );
};

/**
 * Boy's surface — an immersion of the projective plane ℝP², via the Bryant–Kusner
 * complex parametrization (denominator z⁶ + √5·z³ − 1). Ported from Code/World.
 * Polar domain: a = radius (inset off the centre pole), b = angle (wraps). The
 * disk boundary maps onto the self-intersection (triple-point) curve.
 */
export const boySurface: Parametric = (a, b) => {
  const m = 0.04 + 0.96 * a; // |z|, inset to skip the degenerate centre
  const ang = b * TAU;
  const zr = m * Math.cos(ang), zi = m * Math.sin(ang);
  const cm = (ar: number, ai: number, br: number, bi: number): [number, number] => [ar * br - ai * bi, ar * bi + ai * br];
  const [z2r, z2i] = cm(zr, zi, zr, zi);
  const [z3r, z3i] = cm(z2r, z2i, zr, zi);
  const [z4r, z4i] = cm(zr, zi, z3r, z3i);
  const [z6r, z6i] = cm(z3r, z3i, z3r, z3i);
  const dr = z6r + Math.sqrt(5) * z3r - 1, di = z6i + Math.sqrt(5) * z3i;
  const mag = dr * dr + di * di;
  const cdiv = (nr: number, ni: number): [number, number] => [(nr * dr + ni * di) / mag, (ni * dr - nr * di) / mag];
  const [n1r, n1i] = cm(zr, zi, 1 - z4r, -z4i);
  const [n2r, n2i] = cm(zr, zi, 1 + z4r, z4i);
  const [, g1y] = cdiv(n1r, n1i);
  const [g2x] = cdiv(n2r, n2i);
  const [, g3y] = cdiv(1 + z6r, z6i);
  const g1 = g1y * -1.5, g2 = g2x * -1.5, g3 = g3y - 0.5;
  const g = g1 * g1 + g2 * g2 + g3 * g3;
  return new Vector3(g1 / g, -g3 / g - 0.5, g2 / g).multiplyScalar(2);
};

/**
 * The Sudanese Möbius band — a minimal Möbius band sitting in S³, stereographically
 * projected to ℝ³ (its single boundary then a round circle). The S³ point is
 * (cos u cos v, cos u sin v, sin u cos(v/2), sin u sin(v/2)); a fixed π/4 rotation in
 * the (x,z) and (y,w) planes clears the band off the projection pole so the image is
 * compact. a = around the loop (wraps with a u→−u flip — the Möbius twist), b = across
 * the band (the open edge). Feed to `makeTwistedGrid(…, wrapJ=false)`. Ported from Code/World.
 */
export const sudaneseMobius: Parametric = (a, b) => {
  const v = a * TAU;
  const u = (b - 0.5) * Math.PI; // -π/2..π/2, the open Möbius edge
  const cu = Math.cos(u), su = Math.sin(u);
  const x = cu * Math.cos(v), y = cu * Math.sin(v), z = su * Math.cos(v / 2), w = su * Math.sin(v / 2);
  const c = Math.SQRT1_2, s = Math.SQRT1_2; // rotate (x,z) & (y,w) by π/4
  const X = c * x - s * z, Y = c * y - s * w, Z = s * x + c * z, W = s * y + c * w;
  const d = 1 + X; // stereographic from the +X pole
  return new Vector3(Y / d, Z / d, W / d);
};

// ── Minimal-surface gallery ────────────────────────────────────

/**
 * Generalized Enneper surface of a given order, via the Weierstrass–Enneper data
 * f=1, g=zⁿ over z=u+iv: x=Re(z − z^{2n+1}/(2n+1)), height=Re(2z^{n+1}/(n+1)),
 * y=−Im(z + z^{2n+1}/(2n+1)). order 1 is the classic Enneper; higher orders are
 * the (2n+1)-fold symmetric "flower" generalizations.
 */
export function enneperN(order: number, R: number, s: number): Parametric {
  return (a, b) => {
    const u = (2 * a - 1) * R, v = (2 * b - 1) * R;
    const z: C2 = [u, v];
    const zHi = cpow(z, 2 * order + 1);
    const zMid = cpow(z, order + 1);
    const x = u - zHi[0] / (2 * order + 1);
    const y = -(v + zHi[1] / (2 * order + 1));
    const h = (2 / (order + 1)) * zMid[0];
    return new Vector3(s * x, s * h, s * y);
  };
}

/** Catalan's minimal surface — built on a cycloid (its v=0 curve). u runs two
 *  arches; v is the open width. */
export const catalan: Parametric = (a, b) => {
  const u = a * 4 * Math.PI, v = (2 * b - 1) * 1.3, s = 0.32;
  return new Vector3(
    s * (u - Math.sin(u) * Math.cosh(v)),
    s * 4 * Math.sin(u / 2) * Math.sinh(v / 2),
    s * (1 - Math.cos(u) * Math.cosh(v)),
  );
};

/** Henneberg's (non-orientable) minimal surface — contains a cross-cap at u=0. */
export const henneberg: Parametric = (a, b) => {
  const u = a * 1.05, v = b * Math.PI, s = 0.22;
  const x = 2 * Math.cos(v) * Math.sinh(u) - (2 / 3) * Math.cos(3 * v) * Math.sinh(3 * u);
  const y = 2 * Math.sin(v) * Math.sinh(u) + (2 / 3) * Math.sin(3 * v) * Math.sinh(3 * u);
  const z = 2 * Math.cos(2 * v) * Math.cosh(2 * u);
  return new Vector3(s * x, s * z, s * y);
};

/**
 * Richmond's minimal surface (order m=2) via Weierstrass–Enneper f=1/z², g=z²:
 * X=Re(−1/2z − z⁵/10), Y=Re(−i/2z + i z⁵/10), Z=Re(z²/2). Drawn over an annulus
 * so the central planar end (z→0 blow-up) stays finite; θ wraps.
 */
export const richmond: Parametric = (a, b) => {
  const r = 0.5 + b * 0.9, th = a * TAU, s = 0.6;
  const z: C2 = [r * Math.cos(th), r * Math.sin(th)];
  const iz = cinv(z), z5 = cpow(z, 5), z2 = cpow(z, 2);
  const X = -0.5 * iz[0] - z5[0] / 10;
  const Y = 0.5 * iz[1] - z5[1] / 10; // Re(−i/2z + i z⁵/10) = Im(1/2z) − Im(z⁵/10)
  const Z = 0.5 * z2[0];
  return new Vector3(s * X, s * Z, s * Y);
};

/** Bour's minimal surface (B₃), polar. r inset off the branch point at 0; θ runs
 *  to 4π (the z = r^{3/2}cos(3θ/2) term needs it) and wraps. */
export const bour: Parametric = (a, b) => {
  const r = 0.05 + b * 1.0, th = a * 4 * Math.PI, s = 0.85;
  const x = r * Math.cos(th) - 0.5 * r * r * Math.cos(2 * th);
  const y = -r * Math.sin(th) * (r * Math.cos(th) + 1);
  const z = (4 / 3) * Math.pow(r, 1.5) * Math.cos(1.5 * th);
  return new Vector3(s * x, s * z, s * y);
};

/**
 * Roman (Steiner) surface — the image of the sphere under (x,y,z)↦(yz,xz,xy), an
 * immersion of ℝP² with tetrahedral symmetry. θ wraps; φ has poles at 0 and π.
 */
export const roman: Parametric = (a, b) => {
  const th = a * TAU, ph = b * Math.PI, s = 1.7;
  const sp = Math.sin(ph), cp = Math.cos(ph), st = Math.sin(th), ct = Math.cos(th);
  return new Vector3(s * (st * sp * cp), s * (ct * st * sp * sp), s * (ct * sp * cp));
};

/** Cross-cap — an immersion of ℝP² (Pinkall). u wraps; v∈[0,π/2] (v=0 a pole,
 *  v=π/2 the self-intersection segment). */
export const crossCap: Parametric = (a, b) => {
  const u = a * TAU, v = b * Math.PI / 2, s = 1.7;
  const X = 0.5 * Math.cos(u) * Math.sin(2 * v);
  const Y = 0.5 * Math.sin(u) * Math.sin(2 * v);
  const Z = 0.5 * (Math.cos(v) ** 2 - Math.cos(u) ** 2 * Math.sin(v) ** 2);
  return new Vector3(s * X, s * Z, s * Y);
};

/**
 * The Jorge–Meeks trinoid — a genus-0 minimal surface with three catenoid ends,
 * via Weierstrass–Enneper f=1/(z³−1)², g=z². The φ-integrals carry logs/arctans,
 * so rather than transcribe the brittle closed form we integrate the WE
 * differentials numerically along the radial ray from 0 (single-valued inside the
 * unit disk, whose boundary holds the three ends at the cube roots of unity). The
 * three ends blow up near |z|=1 and are opened by trimByRadius. z = Re(z²/2)
 * matches the exact −2/3 − 2/(3(z³−1)) (used as a correctness check).
 */
export const trinoid: Parametric = (a, b) => {
  const th = a * TAU, r = b * 0.96, ei: C2 = [Math.cos(th), Math.sin(th)], s = 1;
  const N = 140, dr = r / N;
  let X = 0, Y = 0, Z = 0;
  for (let k = 0; k <= N; k++) {
    const t = k * dr, z: C2 = [t * ei[0], t * ei[1]];
    const z3 = cpow(z, 3), den = cpow([z3[0] - 1, z3[1]], 2), f = cinv(den);
    const z4 = cpow(z, 4), z2 = cpow(z, 2);
    const phi1 = cmul(f, [1 - z4[0], -z4[1]]);
    const phi2 = cmul([0, 1], cmul(f, [1 + z4[0], z4[1]]));
    const phi3: C2 = [2 * cmul(f, z2)[0], 2 * cmul(f, z2)[1]];
    const w = (k === 0 || k === N) ? 0.5 : 1;
    X += w * (phi1[0] * ei[0] - phi1[1] * ei[1]) * dr; // Re(φ·dz), dz = ei·dr
    Y += w * (phi2[0] * ei[0] - phi2[1] * ei[1]) * dr;
    Z += w * (phi3[0] * ei[0] - phi3[1] * ei[1]) * dr;
  }
  return new Vector3(s * X, s * Z, s * Y);
};

// ── Flat grid ──────────────────────────────────────────────────

/** A flat rectangle on the xz-plane, centered at the origin. */
export function gridMap(width: number, depth: number): Parametric {
  return (u, v) => new Vector3((u - 0.5) * width, 0, (v - 0.5) * depth);
}

/**
 * A 60°-sheared lattice on the xz-plane. Fed to `makeTriangleGrid` with
 * nu = nv, the quad cells become 60° rhombi whose diagonal split yields
 * **equilateral** triangles — the regular {3,6} triangular tiling, giving a
 * symmetric (0°/60°/120°) tri-axial weave rather than the skewed square-split.
 */
export function triLatticeMap(scale: number): Parametric {
  const k = Math.sqrt(3) / 2;
  return (u, v) => new Vector3((u + 0.5 * v - 0.75) * scale, 0, (v - 0.5) * k * scale);
}
