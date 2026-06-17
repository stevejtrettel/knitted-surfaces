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
