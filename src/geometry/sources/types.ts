import type { ParamSpec } from '../../params.ts';
import type { CellType, Geometry } from '../types.ts';

/**
 * Which demo a source belongs to: ordinary surfaces, minimal surfaces,
 * non-orientable/topological surfaces, the hyperbolic plane, or S³.
 */
export type SourceGroup = 'surface' | 'minimal' | 'topology' | 'hyperbolic' | 's3';

/**
 * A geometry source: a named, parameterized recipe for building a `Geometry`.
 * Parallel to a weave `Pattern` — both are `{ id, label, params }` registry
 * entries the UI can render uniformly. `group` lets each demo show only its own.
 */
export interface GeometrySource {
  id: string;
  label: string;
  cellType: CellType;
  group: SourceGroup;
  params?: ParamSpec[];
  build(options: Record<string, number>): Geometry;
}
