/**
 * Triangle-mesh OBJ Demo
 *
 * Load and knit an arbitrary triangle mesh. Starts on a generated regular
 * triangle grid; use "Load OBJ…" to swap in your own triangulated surface.
 */

import { objDemo } from '../_shared/objDemo.ts';
import { makeTriangleGrid } from '@/geometry/triangleGrid.ts';
import { triLatticeMap } from '@/geometry/maps.ts';

const demo = objDemo('tri', 'chainmail');

demo.setGeometry({ cellType: 'tri', mesh: makeTriangleGrid(triLatticeMap(4), { nu: 12, nv: 12 }) });
