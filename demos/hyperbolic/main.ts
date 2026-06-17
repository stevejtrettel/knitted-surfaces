/**
 * Hyperbolic Plane Demo
 *
 * Triangle tilings of the Poincaré disk, knitted into interlaced weaves. Tubes
 * follow the hyperbolic metric automatically (thick centre → thin boundary), and
 * a border frames the disk — its width, inset, and colour are in the Look tab.
 */

import { createWeaveStudio } from '@/scene/weaveStudio.ts';
import { buildSourceControls } from '@/geometry/sources/index.ts';
import { buildPatternControls } from '@/weave/patterns/index.ts';

const studio = createWeaveStudio({ border: true });

const geo = buildSourceControls(studio.geometryTab, 'tri', {
  label: 'Tiling', group: 'hyperbolic', value: 'tiling-2-3-7', onChange: studio.rebuild,
});
const pat = buildPatternControls(studio.lookTab, 'tri', { value: 'linkedcorners', onChange: studio.rebuild });

studio.start({
  geometry: () => geo.geometry,
  pattern: () => pat.pattern,
  options: () => pat.options,
});
