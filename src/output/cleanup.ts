/**
 * Dispose and remove strand geometry groups.
 */

import * as THREE from 'three';

export interface RemoveOptions {
  /** Also dispose materials on each child. Default false. */
  disposeMaterials?: boolean;
}

/**
 * Remove a strand group from its parent and dispose all geometries
 * (and optionally materials).
 */
export function removeStrandGroup(group: THREE.Group, opts: RemoveOptions = {}): void {
  group.removeFromParent();
  group.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      child.geometry.dispose();
      if (opts.disposeMaterials) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of mats) mat.dispose();
      }
    }
  });
}
