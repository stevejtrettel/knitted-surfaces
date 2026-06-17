/**
 * Surfaces Demo
 *
 * Knit a gallery of sample surfaces as tubes, in either fabric: pick a
 * **Cell Type** (Quad or Triangle) and a surface, then a pattern for that
 * fabric. Studio lighting, GPU path tracing, screenshot, OBJ export.
 *
 * Fork this for a focused single-surface demo.
 */

import { createScene } from '@/scene/createScene.ts';
import { studioScene } from '@/scene/scenes/studio.ts';
import { ControlPanel, Tab } from '@/scene/panel.ts';
import { addPathTraceControl } from '@/scene/pathTraceToggle.ts';
import { addScreenshotControl } from '@/scene/screenshot.ts';
import { analyze } from '@/weave/routing/analyze.ts';
import { generateStrands } from '@/weave/generateStrands.ts';
import { buildPatternControls, type PatternControls } from '@/weave/patterns/index.ts';
import { buildSourceControls, type SourceControls } from '@/geometry/sources/index.ts';
import type { CellType } from '@/geometry/types.ts';
import { makeStrandTubes } from '@/output/tubes.ts';
import { makeStrandLines } from '@/output/lines.ts';
import { removeStrandGroup } from '@/output/cleanup.ts';
import { exportTubesOBJ, exportCurvesOBJ } from '@/output/obj.ts';
import { downloadOBJ } from '@/io.ts';
import * as THREE from 'three';

// ── Scene ──────────────────────────────────────────────────────

const { app, lights } = createScene(studioScene({ floor: { y: -2.5 } }), {
  antialias: true, pathTracerDefaults: { bounces: 10, samples: 1 },
});
app.camera.position.set(0, 2.5, 5);
app.controls.target.set(0, 0, 0);

const tubeMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x3e3e44, roughness: 0.35, metalness: 0.85,
  clearcoat: 0.4, clearcoatRoughness: 0.2,
});
const lineMaterial = new THREE.LineBasicMaterial({ color: 0x3e3e44 });

// ── State ──────────────────────────────────────────────────────

let cellType: CellType = 'quad';
let tubeRadius = 0.012;
let showTubes = true;
let group: THREE.Group | null = null;

function rebuild(): void {
  if (group) removeStrandGroup(group);
  const analysis = analyze(geoControls.geometry, patternControls.pattern);
  const result = generateStrands(analysis, patternControls.pattern, patternControls.options);
  group = showTubes
    ? makeStrandTubes(result, { materials: tubeMaterial, tubeRadius })
    : makeStrandLines(result, { materials: lineMaterial });
  app.scene.add(group);
  app.notifyMaterialsChanged();
}

// ── Panel ──────────────────────────────────────────────────────

const panel = new ControlPanel({ title: 'Knit' });

// Geometry tab: cell type + a rebuildable source picker for that fabric.
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
  geoControls = buildSourceControls(sourceTab, cellType, { value: 'Torus', onChange: rebuild });
}

// Look tab: a rebuildable pattern picker + material controls.
const look = panel.tab('Look');
const patternBox = document.createElement('div');
patternBox.style.cssText = 'display:flex;flex-direction:column;gap:9px;';
look.page.appendChild(patternBox);
const patternTab = new Tab(patternBox);
let patternControls: PatternControls;
function refreshPattern(): void {
  patternBox.innerHTML = '';
  patternControls = buildPatternControls(patternTab, cellType, { onChange: rebuild });
}
look.slider('Strand Width', { min: 0.003, max: 0.04, step: 0.001, value: tubeRadius },
  (v) => { tubeRadius = v; rebuild(); });
look.color('Color', '#3e3e44', (hex) => {
  tubeMaterial.color.set(hex);
  lineMaterial.color.set(hex);
  app.notifyMaterialsChanged();
});
look.slider('Roughness', { min: 0, max: 1, step: 0.01, value: tubeMaterial.roughness },
  (v) => { tubeMaterial.roughness = v; app.notifyMaterialsChanged(); });
look.slider('Metalness', { min: 0, max: 1, step: 0.01, value: tubeMaterial.metalness },
  (v) => { tubeMaterial.metalness = v; app.notifyMaterialsChanged(); });

// Render tab.
const render = panel.tab('Render');
addPathTraceControl(app, render, { lights });
addScreenshotControl(app, render);
const styleToggle = render.toggle('Tubes', showTubes, (v) => {
  showTubes = v;
  styleToggle.setLabel(v ? 'Tubes' : 'Curves');
  rebuild();
});
render.color('Background', '#eef4ff', (hex) => { app.scene.background = new THREE.Color(hex); });
render.button('Export OBJ', () => {
  const analysis = analyze(geoControls.geometry, patternControls.pattern);
  const result = generateStrands(analysis, patternControls.pattern, patternControls.options);
  if (showTubes) {
    downloadOBJ(exportTubesOBJ(makeStrandTubes(result, { materials: tubeMaterial, tubeRadius })), 'weave-tubes.obj');
  } else {
    downloadOBJ(exportCurvesOBJ(result), 'weave-curves.obj');
  }
});

refreshSource();
refreshPattern();
panel.mount(document.body);

// ── Start ──────────────────────────────────────────────────────

rebuild();
app.start();
