/**
 * Minimal Surfaces Demo
 *
 * The minimal-surface gallery — helicoid, catenoid, Scherk, the Enneper family,
 * Catalan, Henneberg, Richmond, Bour, plus the Weierstrass-built Costa and the
 * three-ended trinoid — knitted as tubes in quad or triangle fabric. Costa's and
 * the trinoid's ends are opened by their Clip slider; Costa's are framed by rings.
 */

import { surfaceDemo } from '../_shared/surfaceDemo.ts';

surfaceDemo({ group: 'minimal', defaultSource: 'Enneper' });
