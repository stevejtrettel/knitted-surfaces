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
