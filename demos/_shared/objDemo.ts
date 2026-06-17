/**
 * Shared OBJ-loader demo, parameterized by cell type. The quad-obj and tri-obj
 * demos are each one call to this — a studio + a "Load OBJ…" button + the pattern
 * picker for that fabric. The caller seeds the initial mesh via `setGeometry`.
 */

import { createWeaveStudio } from '@/scene/weaveStudio.ts';
import { buildPatternControls } from '@/weave/patterns/index.ts';
import { loadOBJFile } from '@/io.ts';
import type { CellType, Geometry } from '@/geometry/types.ts';

export interface ObjDemo {
  /** Swap in a mesh (also used to seed the default) and re-render. */
  setGeometry(geometry: Geometry): void;
}

export function objDemo(cellType: CellType, patternValue: string): ObjDemo {
  const studio = createWeaveStudio();
  let geometry: Geometry | null = null;

  const setGeometry = (g: Geometry): void => { geometry = g; studio.rebuild(); };

  studio.geometryTab.button('Load OBJ…', async () => {
    const parsed = await loadOBJFile();
    if (parsed) setGeometry({ cellType, mesh: parsed });
  });

  const pattern = buildPatternControls(studio.lookTab, cellType, { value: patternValue, onChange: studio.rebuild });

  studio.start({
    geometry: () => geometry,
    pattern: () => pattern.pattern,
    options: () => pattern.options,
  });

  return { setGeometry };
}
