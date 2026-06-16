/**
 * Surfaces Demo
 *
 * Knit a gallery of sample surfaces — surfaces of revolution plus parametric
 * surfaces (helicoid, catenoid, Enneper, monkey saddle). Studio lighting, GPU
 * path tracing, and the full Geometry / Look / Render panel.
 *
 * This is the template to fork for a focused single-surface-class demo: drop
 * the surface dropdown and hard-code a `build(na, nb)` from one registry entry.
 */

import { createScene } from '@/scene/createScene.ts';
import { studioScene } from '@/scene/scenes/studio.ts';
import { ControlPanel } from '@/scene/panel.ts';
import { addPathTraceControl } from '@/scene/pathTraceToggle.ts';
import { addScreenshotControl } from '@/scene/screenshot.ts';
import { analyzeMesh } from '@/weave/analyzeMesh.ts';
import { generateStrands } from '@/weave/generateStrands.ts';
import { buildDesignControls } from '@/weave/designs/index.ts';
import { surfaces, surfaceNames } from '@/mesh/generators/surfaces.ts';
import type { ParsedMesh } from '@/mesh/types.ts';
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

// ── Materials ──────────────────────────────────────────────────

const tubeMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x3e3e44, roughness: 0.35, metalness: 0.85,
  clearcoat: 0.4, clearcoatRoughness: 0.2,
});
const lineMaterial = new THREE.LineBasicMaterial({ color: 0x3e3e44 });

// ── State ──────────────────────────────────────────────────────

let surfaceKey = 'Torus';
let na = surfaces[surfaceKey].defaultA;
let nb = surfaces[surfaceKey].defaultB;
let tubeRadius = 0.012;
let showTubes = true;
let group: THREE.Group | null = null;

/** Wrapping directions need even counts, or the 2-coloring fails. */
function evenIf(closed: boolean, n: number): number {
  return closed ? n - (n % 2) : n;
}

function buildMesh(): ParsedMesh {
  const surf = surfaces[surfaceKey];
  return surf.build(evenIf(surf.closedA, na), evenIf(surf.closedB, nb));
}

function rebuild(): void {
  if (group) removeStrandGroup(group);
  const design = controls.design;
  const analysis = analyzeMesh(buildMesh(), design.families);
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
geo.dropdown('Surface',
  { options: surfaceNames.map((n) => ({ label: surfaces[n].label, value: n })), value: surfaceKey },
  (v) => {
    surfaceKey = v;
    na = surfaces[v].defaultA;
    nb = surfaces[v].defaultB;
    knitsA.set(na);
    knitsB.set(nb);
    rebuild();
  });
const knitsA = geo.slider('Knits u', { min: 8, max: 120, step: 1, value: na }, (v) => { na = v; rebuild(); });
const knitsB = geo.slider('Knits v', { min: 8, max: 120, step: 1, value: nb }, (v) => { nb = v; rebuild(); });

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
  const analysis = analyzeMesh(buildMesh(), controls.design.families);
  const result = generateStrands(analysis, controls.design, controls.options);
  if (showTubes) {
    downloadOBJ(exportTubesOBJ(makeStrandTubes(result, { materials: tubeMaterial, tubeRadius })), 'weave-tubes.obj');
  } else {
    downloadOBJ(exportCurvesOBJ(result), 'weave-curves.obj');
  }
});

panel.mount(document.body);

// ── Start ──────────────────────────────────────────────────────

rebuild();
app.start();
