/**
 * Quad-mesh OBJ Demo
 *
 * Load and knit an arbitrary quad mesh (connected, 2-colourable — see README).
 * Starts on a bundled torus; use "Load OBJ…" to swap in your own.
 */

import { objDemo } from '../_shared/objDemo.ts';
import { parseOBJ } from '@/geometry/parseOBJ.ts';

const demo = objDemo('quad', 'loop');

fetch(`${import.meta.env.BASE_URL}meshes/torus.obj`)
  .then((r) => r.text())
  .then((text) => demo.setGeometry({ cellType: 'quad', mesh: parseOBJ(text) }))
  .catch((e) => console.error('Failed to load default mesh:', e));
