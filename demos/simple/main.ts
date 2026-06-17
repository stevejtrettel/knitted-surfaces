/**
 * Simple Demo
 *
 * The clearest look at the raw weave — curves only, no tubes, no lighting.
 * Pick a **Cell Type** (Quad or Triangle): each is a first-class fabric with
 * its own surfaces and its own pattern set. Quad meshes weave with two strand
 * families; triangle meshes weave tri-axially with three.
 */

import { createScene } from '@/scene/createScene.ts';
import { emptyScene } from '@/scene/scenes/empty.ts';
import { ControlPanel, Tab } from '@/scene/panel.ts';
import { analyze } from '@/weave/routing/analyze.ts';
import { generateStrands } from '@/weave/generateStrands.ts';
import { buildPatternControls, type PatternControls } from '@/weave/patterns/index.ts';
import { buildSourceControls, type SourceControls } from '@/geometry/sources/index.ts';
import type { CellType } from '@/geometry/types.ts';
import { makeStrandLines } from '@/output/lines.ts';
import { removeStrandGroup } from '@/output/cleanup.ts';
import * as THREE from 'three';

// ── Scene ──────────────────────────────────────────────────────

const { app } = createScene(emptyScene());
app.camera.position.set(0, 3, 5);
app.controls.target.set(0, 0, 0);

// One line material per family (triangle meshes use all three).
const materials = [
  new THREE.LineBasicMaterial({ color: 0xcc4444 }),
  new THREE.LineBasicMaterial({ color: 0x2244aa }),
  new THREE.LineBasicMaterial({ color: 0x22aa55 }),
];

// ── State ──────────────────────────────────────────────────────

let cellType: CellType = 'quad';
let group: THREE.Group | null = null;

function rebuild(): void {
  if (group) removeStrandGroup(group);
  const analysis = analyze(geoControls.geometry, patternControls.pattern);
  const result = generateStrands(analysis, patternControls.pattern, patternControls.options);
  group = makeStrandLines(result, { materials });
  app.scene.add(group);
}

// ── Panel ──────────────────────────────────────────────────────

const panel = new ControlPanel({ title: 'Knit' });

// Geometry tab: cell type + a (rebuildable) source picker for that fabric.
const geo = panel.tab('Geometry');
geo.dropdown('Cell Type',
  { options: [{ label: 'Quad', value: 'quad' }, { label: 'Triangle', value: 'tri' }], value: cellType },
  (v) => { cellType = v as CellType; refreshSource(); refreshPattern(); rebuild(); });

const sourceBox = document.createElement('div');
sourceBox.style.cssText = 'display:flex;flex-direction:column;gap:9px;';
geo.page.appendChild(sourceBox);
const sourceTab = new Tab(sourceBox);
let geoControls: SourceControls;
function refreshSource(): void {
  sourceBox.innerHTML = '';
  const value = cellType === 'tri' ? 'Triangle' : 'Grid';
  geoControls = buildSourceControls(sourceTab, cellType, { value, onChange: rebuild });
}

// Pattern tab: rebuilt when the cell type (and thus the pattern set) changes.
const patternTab = panel.tab('Pattern');
let patternControls: PatternControls;
function refreshPattern(): void {
  patternTab.page.innerHTML = '';
  patternControls = buildPatternControls(patternTab, cellType, { onChange: rebuild });
}

refreshSource();
refreshPattern();
panel.mount(document.body);

// ── Start ──────────────────────────────────────────────────────

rebuild();
app.start();
