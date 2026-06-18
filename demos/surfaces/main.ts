/**
 * Surfaces Demo
 *
 * A gallery of ordinary surfaces — surfaces of revolution plus the monkey saddle
 * and the constant-negative-curvature Dini/Kuen — knitted as tubes. Pick a Cell
 * Type (Quad or Triangle). Minimal surfaces and non-orientable surfaces have
 * their own demos; the hyperbolic plane and the 3-sphere too.
 */

import { surfaceDemo } from '../_shared/surfaceDemo.ts';

surfaceDemo({ group: 'surface', defaultSource: 'Sphere' });
