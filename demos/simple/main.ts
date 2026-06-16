/**
 * Simple Demo
 *
 * The clearest look at the raw weave: a flat quad grid rendered as curves
 * (no tubes, no studio lighting, white background). Pick a knit type and
 * tune its parameters to see exactly what each design produces.
 */

import { createScene } from '@/scene/createScene.ts';
import { emptyScene } from '@/scene/scenes/empty.ts';
import { ControlPanel } from '@/scene/panel.ts';
import { analyzeMesh } from '@/weave/analyzeMesh.ts';
import { generateStrands } from '@/weave/generateStrands.ts';
import { buildDesignControls } from '@/weave/designs/index.ts';
import { makeGrid } from '@/mesh/generators/grid.ts';
import { makeStrandLines } from '@/output/lines.ts';
import { removeStrandGroup } from '@/output/cleanup.ts';
import * as THREE from 'three';

// ── Mesh ───────────────────────────────────────────────────────

const mesh = makeGrid(8, 8, 4, 4);

// ── Scene ──────────────────────────────────────────────────────

const { app } = createScene(emptyScene());
app.camera.position.set(0, 4, 4);
app.controls.target.set(0, 0, 0);

// ── Materials (two-tone per family) ────────────────────────────

const materials: [THREE.Material, THREE.Material] = [
  new THREE.LineBasicMaterial({ color: 0xcc4444 }),
  new THREE.LineBasicMaterial({ color: 0x2244aa }),
];

// ── State ──────────────────────────────────────────────────────

let group: THREE.Group | null = null;

function rebuild(): void {
  if (group) removeStrandGroup(group);
  const analysis = analyzeMesh(mesh, controls.design.families);
  const result = generateStrands(analysis, controls.design, controls.options);
  group = makeStrandLines(result, { materials });
  app.scene.add(group);
}

// ── Panel (single tab — just the knit picker) ──────────────────

const panel = new ControlPanel({ title: 'Knit' });
const controls = buildDesignControls(panel.tab('Design'), { value: 'loop', onChange: rebuild });
panel.mount(document.body);

// ── Start ──────────────────────────────────────────────────────

rebuild();
app.start();
