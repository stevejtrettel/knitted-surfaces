/**
 * WeaveResult → Three.js Line objects (fast curve preview).
 */

import * as THREE from 'three';
import type { WeaveResult } from '../weave/types.ts';

export interface LineOptions {
  /** Material(s) — single or per-family [family0, family1]. */
  materials: THREE.Material | [THREE.Material, THREE.Material];
}

/**
 * Build a Group of Line objects from strand curves.
 */
export function makeStrandLines(result: WeaveResult, opts: LineOptions): THREE.Group {
  const group = new THREE.Group();
  group.name = 'strand-lines';

  for (let i = 0; i < result.strands.length; i++) {
    const strand = result.strands[i];
    if (strand.length < 2) continue;

    const material = Array.isArray(opts.materials)
      ? opts.materials[result.strandFamilies[i]]
      : opts.materials;

    const points = result.strandClosed[i]
      ? [...strand, strand[0]]
      : strand;

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    line.frustumCulled = false;
    group.add(line);
  }

  return group;
}
