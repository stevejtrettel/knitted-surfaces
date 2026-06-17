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
