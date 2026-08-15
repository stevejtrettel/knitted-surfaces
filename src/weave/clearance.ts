/**
 * How far a strand must lift to pass over another one.
 *
 * Every pattern draws its over/under displacement as some fraction of a local
 * feature size — an edge length, a chord. That fraction is an artistic choice and
 * knows nothing about how thick the yarn is, so turning "Strand Width" up used to
 * push the tubes straight through each other. Here we give that displacement a
 * floor derived from the yarn itself.
 *
 * At a crossing the two strands sit at ±`lift` along the surface normal, so their
 * centres are `2·lift` apart and they touch when `lift = width`. `clearance` is
 * the gap on top of that, as a fraction of the yarn radius: at 0 the tubes kiss,
 * at 0.2 they leave a fifth of a radius of daylight. The floor is evaluated
 * against the LOCAL width, so it follows the conformal blend (see `width.ts`) —
 * where the yarn is drawn finer, the crossings get correspondingly shallower.
 *
 * Patterns keep their own amplitude control; this only ever raises it.
 */

import type { Vector3 } from 'three';
import type { Analysis } from './types.ts';

/** The smallest lift that keeps two crossing strands apart at `p`. */
export function minLift(analysis: Analysis, p: Vector3): number {
  const { width, clearance } = analysis.fabric;
  return width(p) * (1 + clearance);
}

/**
 * The lift a pattern should actually use at `p`: its own artistic amplitude, or
 * the yarn's minimum if that is larger.
 */
export function liftAt(analysis: Analysis, p: Vector3, amplitude: number): number {
  return Math.max(amplitude, minLift(analysis, p));
}
