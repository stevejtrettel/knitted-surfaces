/**
 * OBJ Loader Demo
 *
 * Drop in your own quad mesh and knit it. Studio lighting, GPU path tracing,
 * and the full Geometry / Look / Render panel. Starts on a bundled sample
 * mesh; use "Load OBJ…" to swap in your own.
 *
 * Input must be a connected, 2-colorable quad mesh (see README constraints).
 */

import { createScene } from '@/scene/createScene.ts';
import { studioScene } from '@/scene/scenes/studio.ts';
import { ControlPanel } from '@/scene/panel.ts';
import { addPathTraceControl } from '@/scene/pathTraceToggle.ts';
import { addScreenshotControl } from '@/scene/screenshot.ts';
import { analyzeMesh } from '@/weave/analyzeMesh.ts';
import { generateStrands } from '@/weave/generateStrands.ts';
import { buildDesignControls } from '@/weave/designs/index.ts';
import { parseOBJ } from '@/mesh/parseOBJ.ts';
import type { ParsedMesh } from '@/mesh/types.ts';
import { makeStrandTubes } from '@/output/tubes.ts';
import { makeStrandLines } from '@/output/lines.ts';
import { removeStrandGroup } from '@/output/cleanup.ts';
import { exportTubesOBJ, exportCurvesOBJ } from '@/output/obj.ts';
import { loadOBJFile, downloadOBJ } from '@/io.ts';
import * as THREE from 'three';

// ── Scene ──────────────────────────────────────────────────────

const { app, lights } = createScene(studioScene({ floor: { y: -2.5 } }), {
  antialias: true, pathTracerDefaults: { bounces: 10, samples: 1 },
});
app.camera.position.set(0, 2.5, 5);
app.controls.target.set(0, 0, 0);

// ── Materials ──────────────────────────────────────────────────

const tubeMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x3e3e44, roughness: 0.35, metalness: 0.85,
  clearcoat: 0.4, clearcoatRoughness: 0.2,
});
const lineMaterial = new THREE.LineBasicMaterial({ color: 0x3e3e44 });

// ── State ──────────────────────────────────────────────────────

let mesh: ParsedMesh | null = null;
let tubeRadius = 0.012;
let showTubes = true;
let group: THREE.Group | null = null;

function rebuild(): void {
  if (group) { removeStrandGroup(group); group = null; }
  if (!mesh) return;
  const design = controls.design;
  const analysis = analyzeMesh(mesh, design.families);
  const result = generateStrands(analysis, design, controls.options);
  group = showTubes
    ? makeStrandTubes(result, { materials: tubeMaterial, tubeRadius })
    : makeStrandLines(result, { materials: lineMaterial });
  app.scene.add(group);
  app.notifyMaterialsChanged();
}

// ── Panel ──────────────────────────────────────────────────────

const panel = new ControlPanel({ title: 'Knit' });

const geo = panel.tab('Geometry');
geo.button('Load OBJ…', async () => {
  const parsed = await loadOBJFile();
  if (parsed) { mesh = parsed; rebuild(); }
});

const look = panel.tab('Look');
const controls = buildDesignControls(look, { value: 'loop', onChange: rebuild });
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
  if (!mesh) return;
  const analysis = analyzeMesh(mesh, controls.design.families);
  const result = generateStrands(analysis, controls.design, controls.options);
  if (showTubes) {
    downloadOBJ(exportTubesOBJ(makeStrandTubes(result, { materials: tubeMaterial, tubeRadius })), 'weave-tubes.obj');
  } else {
    downloadOBJ(exportCurvesOBJ(result), 'weave-curves.obj');
  }
});

panel.mount(document.body);

// ── Start on a bundled sample mesh ─────────────────────────────

fetch(`${import.meta.env.BASE_URL}meshes/torus.obj`)
  .then((r) => r.text())
  .then((text) => { mesh = parseOBJ(text); rebuild(); })
  .catch((e) => console.error('Failed to load sample mesh:', e));

app.start();
