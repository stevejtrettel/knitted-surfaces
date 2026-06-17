import type { ParamSpec } from '../../params.ts';
import type { CellType, Geometry } from '../types.ts';

/**
 * A geometry source: a named, parameterized recipe for building a `Geometry`.
 * Parallel to a weave `Pattern` — both are `{ id, label, params }` registry
 * entries the UI can render uniformly.
 */
export interface GeometrySource {
  id: string;
  label: string;
  cellType: CellType;
  params?: ParamSpec[];
  build(options: Record<string, number>): Geometry;
}
