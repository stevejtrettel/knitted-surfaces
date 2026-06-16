import type { ParsedMesh } from '../types.ts';
import { makeRevolutionMesh } from './revolution.ts';

/**
 * Generate a torus quad mesh.
 *
 * @param R       Major radius (center of tube to center of torus). Default 1.5
 * @param r       Minor radius (tube radius). Default 0.7
 * @param nTheta  Angular divisions around the Y axis. Default 48
 * @param nT      Profile divisions around the tube. Default 64
 */
export function makeTorus(
  R: number = 1.5,
  r: number = 0.7,
  nTheta: number = 48,
  nT: number = 64,
): ParsedMesh {
  return makeRevolutionMesh(
    (t) => {
      const a = t * 2 * Math.PI;
      return { r: R + r * Math.cos(a), y: r * Math.sin(a) };
    },
    nTheta,
    nT,
    true,
  );
}
