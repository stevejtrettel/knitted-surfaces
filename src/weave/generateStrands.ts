import type { Vector3 } from 'three';
import type { MeshAnalysis, StrandDesign, WeaveResult } from './types.ts';

export function generateStrands<Opts>(
  analysis: MeshAnalysis,
  design: StrandDesign<Opts>,
  options: Opts,
): WeaveResult {
  const strands: Vector3[][] = [];
  const strandFamilies: (0 | 1)[] = [];
  const strandClosed: boolean[] = [];

  for (const strand of analysis.strands) {
    const points = design.generateStrandCurve(strand, analysis, options);
    strands.push(points);
    strandFamilies.push(strand.family);
    strandClosed.push(strand.closed);
  }

  return { strands, strandFamilies, strandClosed };
}
