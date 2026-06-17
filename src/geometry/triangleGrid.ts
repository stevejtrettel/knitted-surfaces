import { Vector3 } from 'three';
import type { ParsedMesh } from './types.ts';
import type { Parametric, Domain } from './parametric.ts';

/**
 * Build a regular triangle mesh by sampling a parametric surface and
 * splitting every quad cell along one diagonal.
 *
 * The uniform diagonal gives a triangulation whose edges fall into three
 * directions (one per triangle) — so it is 3-edge-colourable, and its
 * face-dual is bipartite (lower vs upper triangles), which the routing
 * layer's colouring and over/under sign both rely on.
 *
 * Same even-count caveat as `makeParametricMesh` for wrapping directions.
 */
export function makeTriangleGrid(f: Parametric, domain: Domain): ParsedMesh {
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
      const a = i * vCount + j;
      const b = i * vCount + jN;
      const c = iN * vCount + jN;
      const d = iN * vCount + j;
      faces.push([a, b, d]); // lower triangle
      faces.push([b, c, d]); // upper triangle
    }
  }

  return { vertices, faces };
}
