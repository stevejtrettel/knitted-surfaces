/**
 * Shared scaffold for the mesh-surface galleries (Surfaces, Minimal, Topology).
 *
 * Each is the same studio: a Cell Type toggle (Quad / Triangle), a source picker
 * restricted to one `group`, and a pattern picker — differing only in which group
 * of surfaces it lists and which one it opens on.
 */

import { createWeaveStudio } from '@/scene/weaveStudio.ts';
import { Tab } from '@/scene/panel.ts';
import { buildSourceControls, type SourceControls } from '@/geometry/sources/index.ts';
import { buildPatternControls, type PatternControls } from '@/weave/patterns/index.ts';
import type { CellType } from '@/geometry/types.ts';
import type { SourceGroup } from '@/geometry/sources/types.ts';

export function surfaceDemo(opts: { group: SourceGroup; defaultSource: string }): void {
  const studio = createWeaveStudio({ border: true });
  let cellType: CellType = 'quad';

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
    geoControls = buildSourceControls(sourceTab, cellType, { value: opts.defaultSource, group: opts.group, onChange: studio.rebuild });
  }

  const patternBox = document.createElement('div');
  patternBox.style.cssText = 'display:flex;flex-direction:column;gap:9px;';
  studio.lookTab.page.appendChild(patternBox);
  const patternTab = new Tab(patternBox);
  let patternControls: PatternControls;
  function refreshPattern(): void {
    patternBox.innerHTML = '';
    patternControls = buildPatternControls(patternTab, cellType, { onChange: studio.rebuild });
  }

  refreshSource();
  refreshPattern();

  studio.start({
    geometry: () => geoControls.geometry,
    pattern: () => patternControls.pattern,
    options: () => patternControls.options,
  });
}
