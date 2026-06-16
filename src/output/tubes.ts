/**
 * WeaveResult → Three.js TubeGeometry meshes.
 *
 * Strand points are already densely sampled by the design functions,
 * so we connect them with a piecewise-linear CurvePath rather than
 * re-interpolating through a second Catmull-Rom pass.
 */

import * as THREE from 'three';
import type { WeaveResult } from '../weave/types.ts';

export interface TubeOptions {
  /** Material(s) — single or per-family [family0, family1]. */
  materials: THREE.Material | [THREE.Material, THREE.Material];
  /** Tube radius. Default 0.015 */
  tubeRadius?: number;
  /** Radial segments. Default 8 */
  radialSegments?: number;
}

/** Build a piecewise-linear curve through pre-sampled strand points. */
function strandCurve(points: THREE.Vector3[], closed: boolean): THREE.CurvePath<THREE.Vector3> {
  const path = new THREE.CurvePath<THREE.Vector3>();
  const n = closed ? points.length : points.length - 1;
  for (let j = 0; j < n; j++) {
    path.add(new THREE.LineCurve3(points[j], points[(j + 1) % points.length]));
  }
  return path;
}

/**
 * Build a Group of TubeGeometry meshes from strand curves.
 */
export function makeStrandTubes(result: WeaveResult, opts: TubeOptions): THREE.Group {
  const group = new THREE.Group();
  group.name = 'strand-tubes';
  const radius = opts.tubeRadius ?? 0.015;
  const radial = opts.radialSegments ?? 8;

  for (let i = 0; i < result.strands.length; i++) {
    const strand = result.strands[i];
    if (strand.length < 2) continue;

    const closed = result.strandClosed[i];
    const material = Array.isArray(opts.materials)
      ? opts.materials[result.strandFamilies[i]]
      : opts.materials;

    const curve = strandCurve(strand, closed);
    const geometry = new THREE.TubeGeometry(curve, strand.length, radius, radial, closed);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  return group;
}
