import { Vector3 } from 'three';
import type { ParsedMesh } from './types.ts';

/** Maps (u, v) ∈ [0,1]² to a point in space. */
export type Parametric = (u: number, v: number) => Vector3;

/** Sampling domain for a parametric surface. */
export interface Domain {
  /** Divisions along u. */
  nu: number;
  /** Divisions along v. */
  nv: number;
  /** If true the u direction wraps (u=0 ≡ u=1), e.g. revolution angle. */
  wrapU?: boolean;
  /** If true the v direction wraps (v=0 ≡ v=1), e.g. a torus profile. */
  wrapV?: boolean;
}

/**
 * The single quad-mesh builder: sample a parametric surface over the unit
 * square into a regular `nu × nv` grid of quads. Surfaces of revolution and
 * flat grids are just particular maps fed to this (see `maps.ts`).
 *
 * A wrapping direction must have an **even** division count, otherwise the
 * face-adjacency cycle is odd and the weave 2-colouring fails.
 */
export function makeParametricMesh(f: Parametric, domain: Domain): ParsedMesh {
  const { nu, nv } = domain;
  const wrapU = domain.wrapU ?? false;
  const wrapV = domain.wrapV ?? false;

  const vertices: Vector3[] = [];
  const faces: number[][] = [];

  const uCount = wrapU ? nu : nu + 1;
  const vCount = wrapV ? nv : nv + 1;

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
      faces.push([
        i * vCount + j,
        i * vCount + jN,
        iN * vCount + jN,
        iN * vCount + j,
      ]);
    }
  }

  return { vertices, faces };
}

/**
 * Like the grid builders, but the **first** direction wraps **non-orientably**: the
 * seam glues row i=1 to row i=0 with the j index reversed (j → nv−j). This is the
 * gluing a Klein bottle needs (`f(1,v)=f(0,1−v)` — the cross-section flips), which a
 * plain same-index wrap mangles into a stretched seam. `tri` splits each quad on a
 * diagonal.
 *
 * `wrapJ` (default true) controls the second direction: true → it wraps normally
 * (closed both ways, e.g. the figure-8 Klein bottle); false → it is an **open
 * boundary** (nv+1 rows), as a Möbius band needs — the band loops in i with a width
 * flip at the seam, while the width itself (j) is the single free edge.
 *
 * The result is genuinely non-orientable, so consistent winding/2-colouring fail
 * across the seam — chain mail (per-face) is the robust pattern here.
 */
export function makeTwistedGrid(f: Parametric, nu: number, nv: number, tri: boolean, wrapJ = true): ParsedMesh {
  const jCount = wrapJ ? nv : nv + 1;
  const vertices: Vector3[] = [];
  for (let i = 0; i < nu; i++) for (let j = 0; j < jCount; j++) vertices.push(f(i / nu, j / nv));
  const id = (i: number, j: number) => i * jCount + j;
  const faces: number[][] = [];
  for (let i = 0; i < nu; i++) {
    const iN = (i + 1) % nu;
    const seam = i === nu - 1;
    // at the i-seam the next row's columns are reversed (j → nv−j); else identity.
    const fl = (j: number) => (seam ? (wrapJ ? (nv - j) % nv : nv - j) : j);
    for (let j = 0; j < nv; j++) {
      const jN = wrapJ ? (j + 1) % nv : j + 1;
      const a = id(i, j), b = id(i, jN), c = id(iN, fl(jN)), d = id(iN, fl(j));
      if (tri) { faces.push([a, b, d], [b, c, d]); } else faces.push([a, b, c, d]);
    }
  }
  return { vertices, faces };
}

/**
 * Drop faces that have any non-finite or far-away (|v| > maxRadius) vertex, then
 * re-index the survivors. Opens the blow-up ends of surfaces like Costa into
 * clean holes instead of letting runaway vertices stretch the mesh.
 */
export function trimByRadius(mesh: ParsedMesh, maxRadius: number): ParsedMesh {
  const r2 = maxRadius * maxRadius;
  const ok = mesh.vertices.map((v) => {
    const d = v.x * v.x + v.y * v.y + v.z * v.z;
    return Number.isFinite(d) && d <= r2;
  });
  const remap = new Int32Array(mesh.vertices.length).fill(-1);
  const vertices: Vector3[] = [];
  const faces: number[][] = [];
  for (const f of mesh.faces) {
    if (!f.every((i) => ok[i])) continue;
    faces.push(f.map((i) => {
      if (remap[i] < 0) { remap[i] = vertices.length; vertices.push(mesh.vertices[i]); }
      return remap[i];
    }));
  }
  return { vertices, faces };
}
