import { Vector3 } from 'three';
import type { ParsedMesh } from './types.ts';

/**
 * Parse OBJ file text into vertices and faces.
 *
 * Only reads `v` (vertex position) and `f` (face) records.
 * Normals (`vn`), texture coordinates (`vt`), and all other
 * OBJ features are silently ignored.
 */
export function parseOBJ(text: string): ParsedMesh {
  const vertices: Vector3[] = [];
  const faces: number[][] = [];

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('v ')) {
      const parts = trimmed.split(/\s+/);
      vertices.push(new Vector3(
        parseFloat(parts[1]),
        parseFloat(parts[2]),
        parseFloat(parts[3]),
      ));
    } else if (trimmed.startsWith('f ')) {
      const parts = trimmed.split(/\s+/).slice(1);
      const faceIndices: number[] = [];
      for (const part of parts) {
        faceIndices.push(parseInt(part.split('/')[0], 10) - 1);
      }
      if (faceIndices.length >= 3) faces.push(faceIndices);
    }
  }

  return { vertices, faces };
}
