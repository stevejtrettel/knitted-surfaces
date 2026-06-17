import { Vector3 } from 'three';
import type { Analysis, FamilyId, Pattern, StrandSample, WeaveResult } from './types.ts';

/** True if a pattern returned StrandSamples rather than bare points. */
function isSampleArray(curve: Vector3[] | StrandSample[]): curve is StrandSample[] {
  return curve.length > 0 && !(curve[0] instanceof Vector3);
}

/**
 * Apply a pattern to every strand of an analysis. Strands are already stitched
 * into continuous global components by the routing layer, so each maps to one
 * rendered curve. Patterns may return bare `Vector3[]` (constant radius → null
 * radii) or `StrandSample[]` (per-point radius); both normalize to a `WeaveResult`.
 */
export function generateStrands<Opts>(
  analysis: Analysis,
  pattern: Pattern<Opts>,
  options: Opts,
): WeaveResult {
  const strands: Vector3[][] = [];
  const strandRadii: (number[] | null)[] = [];
  const strandFamilies: FamilyId[] = [];
  const strandClosed: boolean[] = [];

  for (const strand of analysis.strands) {
    const curve = pattern.generateStrandCurve(strand, analysis, options);

    if (isSampleArray(curve)) {
      strands.push(curve.map((s) => s.position));
      strandRadii.push(curve.map((s) => s.radius ?? NaN));
    } else {
      strands.push(curve);
      strandRadii.push(null);
    }
    strandFamilies.push(strand.family);
    strandClosed.push(strand.closed);
  }

  return { strands, strandRadii, strandFamilies, strandClosed };
}
