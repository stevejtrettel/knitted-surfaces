/**
 * OBJ export utilities.
 *
 * Two modes:
 * - Tube export: writes the full tube mesh geometry (vertices + triangular faces)
 * - Curve export: writes strand paths as polylines (vertices + line elements)
 */

import * as THREE from 'three';
import type { WeaveResult } from '../weave/types.ts';

/**
 * Export a Group of tube meshes to OBJ format.
 * Each child mesh becomes a named object group.
 */
export function exportTubesOBJ(group: THREE.Group): string {
  const lines: string[] = ['# Exported weave tube geometry'];
  let vertexOffset = 0;

  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    const geometry = child.geometry as THREE.BufferGeometry;
    const position = geometry.getAttribute('position');
    if (!position) return;

    lines.push(`o strand_${vertexOffset}`);

    // Write vertices
    for (let i = 0; i < position.count; i++) {
      lines.push(`v ${position.getX(i).toFixed(6)} ${position.getY(i).toFixed(6)} ${position.getZ(i).toFixed(6)}`);
    }

    // Write faces (1-indexed)
    const index = geometry.getIndex();
    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        const a = index.getX(i) + 1 + vertexOffset;
        const b = index.getX(i + 1) + 1 + vertexOffset;
        const c = index.getX(i + 2) + 1 + vertexOffset;
        lines.push(`f ${a} ${b} ${c}`);
      }
    }

    vertexOffset += position.count;
  });

  return lines.join('\n') + '\n';
}

/**
 * Export strand curves as OBJ polylines (v + l elements).
 * Useful for CNC/CAD wire path import.
 */
export function exportCurvesOBJ(result: WeaveResult): string {
  const lines: string[] = ['# Exported weave strand curves'];
  let vertexOffset = 0;

  for (let i = 0; i < result.strands.length; i++) {
    const strand = result.strands[i];
    if (strand.length < 2) continue;

    lines.push(`o strand_${i}`);

    // Write vertices
    for (const p of strand) {
      lines.push(`v ${p.x.toFixed(6)} ${p.y.toFixed(6)} ${p.z.toFixed(6)}`);
    }

    // Write line element (1-indexed)
    const indices: number[] = [];
    for (let j = 0; j < strand.length; j++) {
      indices.push(j + 1 + vertexOffset);
    }
    // Close the loop if the strand is closed
    if (result.strandClosed[i]) {
      indices.push(1 + vertexOffset);
    }
    lines.push(`l ${indices.join(' ')}`);

    vertexOffset += strand.length;
  }

  return lines.join('\n') + '\n';
}