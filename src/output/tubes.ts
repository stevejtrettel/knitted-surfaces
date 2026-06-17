/**
 * WeaveResult → variable-radius tube meshes.
 *
 * Strand points are already densely sampled by the patterns, so we sweep a
 * ring of vertices directly along the polyline (no Catmull-Rom re-smoothing).
 * The cross-section frame is parallel-transported (rotation-minimizing) to
 * avoid the twist Frenet frames produce at inflections, with a closing-twist
 * correction for loops. Radius can vary per point (see `WeaveResult.strandRadii`).
 *
 * Adapted from threejs-demos `src/math/curves/buildTubeGeometry.ts`.
 */

import * as THREE from 'three';
import type { WeaveResult } from '../weave/types.ts';

export interface TubeOptions {
  /** Material(s) — single, or per-family [family0, family1, …]. */
  materials: THREE.Material | THREE.Material[];
  /** Fallback radius where a strand has no per-point radius. Default 0.015 */
  tubeRadius?: number;
  /** Radial segments around the tube. Default 8 */
  radialSegments?: number;
}

const _axis = new THREE.Vector3();
const _cross = new THREE.Vector3();

/** Unit tangent at point i of a polyline (central differences; wraps if closed). */
function tangentAt(points: THREE.Vector3[], i: number, closed: boolean, out: THREE.Vector3): THREE.Vector3 {
  const n = points.length;
  if (closed) {
    out.subVectors(points[(i + 1) % n], points[(i - 1 + n) % n]);
  } else if (i === 0) {
    out.subVectors(points[1], points[0]);
  } else if (i === n - 1) {
    out.subVectors(points[n - 1], points[n - 2]);
  } else {
    out.subVectors(points[i + 1], points[i - 1]);
  }
  if (out.lengthSq() < 1e-20) out.set(0, 0, 1);
  return out.normalize();
}

/** Rotate `normal` from tangent `a` to tangent `b` (parallel transport step). */
function transport(normal: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): void {
  _axis.crossVectors(a, b);
  const sin = _axis.length();
  if (sin > 1e-6) {
    _axis.divideScalar(sin);
    normal.applyAxisAngle(_axis, Math.atan2(sin, a.dot(b)));
  }
  normal.addScaledVector(b, -normal.dot(b)).normalize(); // re-orthogonalize
}

/**
 * Build a swept tube along a polyline with per-point radius.
 * `radii[i]` is the radius at point i.
 */
export function buildSweptTube(
  points: THREE.Vector3[],
  radii: number[],
  closed: boolean,
  radialSegments: number,
): THREE.BufferGeometry {
  const n = points.length;

  // Tangents.
  const tangents: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) tangents.push(tangentAt(points, i, closed, new THREE.Vector3()));

  // Parallel-transported normals.
  const normals: THREE.Vector3[] = [];
  let normal = new THREE.Vector3(1, 0, 0);
  if (Math.abs(tangents[0].x) > 0.9) normal.set(0, 1, 0);
  normal.crossVectors(tangents[0], normal).normalize();
  normals.push(normal.clone());
  for (let i = 1; i < n; i++) {
    transport(normal, tangents[i - 1], tangents[i]);
    normals.push(normal.clone());
  }

  // Close the frame: distribute residual twist so the seam matches.
  if (closed) {
    const pred = normals[n - 1].clone();
    transport(pred, tangents[n - 1], tangents[0]);
    const angle = Math.atan2(
      _cross.crossVectors(pred, normals[0]).dot(tangents[0]),
      pred.dot(normals[0]),
    );
    for (let i = 0; i < n; i++) {
      normals[i].applyAxisAngle(tangents[i], (angle * i) / n);
    }
  }

  const stride = radialSegments + 1;
  const positions: number[] = [];
  const normalAttr: number[] = [];
  const indices: number[] = [];
  const dir = new THREE.Vector3();
  const binormal = new THREE.Vector3();

  for (let i = 0; i < n; i++) {
    const t = tangents[i];
    const nrm = normals[i];
    binormal.crossVectors(t, nrm);
    const r = radii[i];
    for (let j = 0; j <= radialSegments; j++) {
      const v = (j / radialSegments) * Math.PI * 2;
      dir.copy(nrm).multiplyScalar(Math.cos(v)).addScaledVector(binormal, Math.sin(v)).normalize();
      positions.push(points[i].x + dir.x * r, points[i].y + dir.y * r, points[i].z + dir.z * r);
      normalAttr.push(dir.x, dir.y, dir.z);
    }
  }

  const segCount = closed ? n : n - 1;
  for (let i = 0; i < segCount; i++) {
    const iN = (i + 1) % n;
    for (let j = 0; j < radialSegments; j++) {
      const a = i * stride + j;
      const b = iN * stride + j;
      const c = iN * stride + j + 1;
      const d = i * stride + j + 1;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normalAttr, 3));
  return geometry;
}

/** Build a Group of swept-tube meshes from strand curves. */
export function makeStrandTubes(result: WeaveResult, opts: TubeOptions): THREE.Group {
  const group = new THREE.Group();
  group.name = 'strand-tubes';
  const fallback = opts.tubeRadius ?? 0.015;
  const radial = opts.radialSegments ?? 8;

  for (let i = 0; i < result.strands.length; i++) {
    const strand = result.strands[i];
    if (strand.length < 2) continue;

    const closed = result.strandClosed[i];
    const perPoint = result.strandRadii[i];
    const radii = strand.map((_, j) => {
      const r = perPoint?.[j];
      return r !== undefined && Number.isFinite(r) ? r : fallback;
    });

    const material = Array.isArray(opts.materials)
      ? (opts.materials[result.strandFamilies[i]] ?? opts.materials[0])
      : opts.materials;

    const geometry = buildSweptTube(strand, radii, closed, radial);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  return group;
}
