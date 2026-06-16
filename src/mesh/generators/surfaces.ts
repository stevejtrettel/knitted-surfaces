/**
 * Unified sample-surface registry.
 *
 * Each entry knows how to build a quad mesh at a given resolution, mixing
 * surfaces of revolution (from `profiles.ts`) with general parametric
 * surfaces (helicoid, catenoid, Enneper, monkey saddle). A demo can offer
 * the whole set in a single dropdown.
 *
 * Resolution is two counts: `a` (the "around"/u direction) and `b` (the
 * "along"/v direction). `closedA` / `closedB` flag wrapping directions —
 * those counts must stay even (the weave 2-coloring needs even cycles), so a
 * UI should step those sliders by 2.
 */

import { Vector3 } from 'three';
import type { ParsedMesh } from '../types.ts';
import { makeRevolutionMesh } from './revolution.ts';
import { makeParametricMesh, type Parametric } from './parametric.ts';
import { profiles } from './profiles.ts';

export interface SurfaceDef {
  label: string;
  group: 'Revolution' | 'Parametric';
  closedA: boolean;
  closedB: boolean;
  defaultA: number;
  defaultB: number;
  build(na: number, nb: number): ParsedMesh;
}

const TAU = Math.PI * 2;

// ── Parametric surface maps over the unit square ───────────────

const helicoid: Parametric = (u, v) => {
  const U = (2 * u - 1) * 1.3;       // radial arm, [-1.3, 1.3]
  const V = (v - 0.5) * 3 * TAU;     // 3 turns, centered
  const c = 0.18;
  return new Vector3(U * Math.cos(V), c * V, U * Math.sin(V));
};

const catenoid: Parametric = (u, v) => {
  const U = (2 * u - 1) * 1.1;       // height parameter
  const V = v * TAU;                  // angle (wraps)
  const r = 0.55 * Math.cosh(U);
  return new Vector3(r * Math.cos(V), U, r * Math.sin(V));
};

const enneper: Parametric = (u, v) => {
  const U = (2 * u - 1) * 2.0;
  const V = (2 * v - 1) * 2.0;
  const s = 0.16;
  return new Vector3(
    s * (U - (U * U * U) / 3 + U * V * V),
    s * (U * U - V * V),
    s * (V - (V * V * V) / 3 + V * U * U),
  );
};

const monkeySaddle: Parametric = (u, v) => {
  const X = (2 * u - 1) * 1.2;
  const Y = (2 * v - 1) * 1.2;
  const s = 1.2;
  return new Vector3(X * s, (X * X * X - 3 * X * Y * Y) * s, Y * s);
};

// ── Registry ───────────────────────────────────────────────────

function revolution(name: keyof typeof profiles): SurfaceDef {
  const p = profiles[name];
  return {
    label: p.label,
    group: 'Revolution',
    closedA: true,            // always wraps around the axis
    closedB: p.closed,
    defaultA: 36,
    defaultB: 48,
    build: (na, nb) => makeRevolutionMesh(p.fn, na, nb, p.closed),
  };
}

function parametric(
  label: string,
  f: Parametric,
  opts: { closedA?: boolean; closedB?: boolean; defaultA?: number; defaultB?: number } = {},
): SurfaceDef {
  return {
    label,
    group: 'Parametric',
    closedA: opts.closedA ?? false,
    closedB: opts.closedB ?? false,
    defaultA: opts.defaultA ?? 40,
    defaultB: opts.defaultB ?? 40,
    build: (na, nb) => makeParametricMesh(f, na, nb, opts.closedA ?? false, opts.closedB ?? false),
  };
}

export const surfaces: Record<string, SurfaceDef> = {
  Torus: revolution('Torus'),
  Vase: revolution('Vase'),
  Sphere: revolution('Sphere'),
  Hourglass: revolution('Hourglass'),
  Blob: revolution('Blob'),
  Helicoid: parametric('Helicoid', helicoid, { defaultA: 24, defaultB: 96 }),
  Catenoid: parametric('Catenoid', catenoid, { closedB: true, defaultA: 28, defaultB: 48 }),
  Enneper: parametric('Enneper surface', enneper, { defaultA: 44, defaultB: 44 }),
  MonkeySaddle: parametric('Monkey saddle', monkeySaddle, { defaultA: 44, defaultB: 44 }),
};

/** Surface keys in display order. */
export const surfaceNames = Object.keys(surfaces);
