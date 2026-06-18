/**
 * Topology Demo
 *
 * Non-orientable and projective-plane surfaces — the Klein bottle (classic and
 * figure-8 immersions), Boy's surface, the Roman (Steiner) surface, and the
 * cross-cap — knitted as tubes. These are one-sided or self-intersecting, so
 * chain mail (triangle) is the most robust pattern on them.
 */

import { surfaceDemo } from '../_shared/surfaceDemo.ts';

surfaceDemo({ group: 'topology', defaultSource: 'Klein' });
