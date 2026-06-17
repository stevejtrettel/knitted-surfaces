/**
 * 3-Sphere Demo
 *
 * Tori in S³ (Clifford and Hopf), stereographically projected to ℝ³ and knitted
 * in either fabric (quad or triangle). Tube width follows the stereographic
 * metric automatically — strands keep a constant intrinsic (spherical) width, so
 * they fatten away from the origin. "Rotate S³" folds the torus through the pole.
 */

import { createWeaveStudio } from '@/scene/weaveStudio.ts';
import { Tab } from '@/scene/panel.ts';
import { buildSourceControls, type SourceControls } from '@/geometry/sources/index.ts';
import { buildPatternControls, type PatternControls } from '@/weave/patterns/index.ts';
import type { CellType } from '@/geometry/types.ts';

const studio = createWeaveStudio({ cameraPosition: [0, 3, 7] });
let cellType: CellType = 'quad';

// Geometry tab: cell type + a rebuildable S³-source picker.
studio.geometryTab.dropdown('Cell Type',
  { options: [{ label: 'Quad', value: 'quad' }, { label: 'Triangle', value: 'tri' }], value: cellType },
  (v) => { cellType = v as CellType; refreshSource(); refreshPattern(); studio.rebuild(); });

const sourceBox = document.createElement('div');
sourceBox.style.cssText = 'display:flex;flex-direction:column;gap:9px;';
studio.geometryTab.page.appendChild(sourceBox);
const sourceTab = new Tab(sourceBox);
let geoControls: SourceControls;
function refreshSource(): void {
  sourceBox.innerHTML = '';
  geoControls = buildSourceControls(sourceTab, cellType, { value: 'Clifford', group: 's3', onChange: studio.rebuild });
}

// Look tab: a rebuildable pattern picker (above the studio's look controls).
const patternBox = document.createElement('div');
patternBox.style.cssText = 'display:flex;flex-direction:column;gap:9px;';
studio.lookTab.page.appendChild(patternBox);
const patternTab = new Tab(patternBox);
let patternControls: PatternControls;
function refreshPattern(): void {
  patternBox.innerHTML = '';
  const value = cellType === 'tri' ? 'triaxial' : 'weave';
  patternControls = buildPatternControls(patternTab, cellType, { value, onChange: studio.rebuild });
}

refreshSource();
refreshPattern();

studio.start({
  geometry: () => geoControls.geometry,
  pattern: () => patternControls.pattern,
  options: () => patternControls.options,
});
