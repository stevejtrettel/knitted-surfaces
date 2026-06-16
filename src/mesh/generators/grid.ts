import { Vector3 } from 'three';
import type { ParsedMesh } from '../types.ts';

/**
 * Generate a flat quad grid on the xz-plane (y = 0).
 *
 * @param nx     Number of quads along x. Default 12
 * @param nz     Number of quads along z. Default 12
 * @param width  Total extent along x. Default 4
 * @param depth  Total extent along z. Default 4
 */
export function makeGrid(
  nx: number = 12,
  nz: number = 12,
  width: number = 4,
  depth: number = 4,
): ParsedMesh {
  const vertices: Vector3[] = [];
  const faces: number[][] = [];

  for (let iz = 0; iz <= nz; iz++) {
    for (let ix = 0; ix <= nx; ix++) {
      const x = (ix / nx - 0.5) * width;
      const z = (iz / nz - 0.5) * depth;
      vertices.push(new Vector3(x, 0, z));
    }
  }

  const cols = nx + 1;
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const a = iz * cols + ix;
      const b = a + 1;
      const c = b + cols;
      const d = a + cols;
      faces.push([a, b, c, d]);
    }
  }

  return { vertices, faces };
}
