/**
 * Shared "weave studio" scaffold for the demos.
 *
 * Every demo is the same studio — scene, materials, the Look/Render controls, and
 * the pipeline below — differing only in which geometry it shows. A demo creates
 * a studio, fills the Geometry tab with its source picker (and the Look tab with
 * a pattern picker), then calls `start(providers)`; the studio owns the rest.
 *
 *   width field → analyze → generate → smooth → selvedge → width → clip → tubes
 *
 * The studio owns the **width field** (`weave/width.ts`) because width is a Look
 * decision: the base radius, how far it follows the local cell size (the Conformal
 * control), and the geometry's own metric taper all compose into one field. That
 * field is handed to `analyze` as the fabric context, so the patterns size their
 * over/under lift from the same numbers the tube sweep uses — widen the yarn and
 * the crossings deepen to match instead of interpenetrating.
 *
 * The border is built from the geometry (`output/border.ts`) as ordinary strands,
 * so it renders and exports through the same path as the fabric.
 */

import * as THREE from 'three';
import type { App } from './App.ts';
import { createScene } from './createScene.ts';
import { studioScene } from './scenes/studio.ts';
import { ControlPanel, Tab } from './panel.ts';
import { addPathTraceControl } from './pathTraceToggle.ts';
import { addScreenshotControl, addThumbnailControl } from './screenshot.ts';
import { attachPermalink } from './permalink.ts';
import { analyze } from '../weave/routing/analyze.ts';
import { generateStrands } from '../weave/generateStrands.ts';
import { applyWidth } from '../weave/radius.ts';
import { buildWidthField } from '../weave/width.ts';
import { smoothStrands } from '../weave/smooth.ts';
import { joinSelvedges } from '../weave/selvedge.ts';
import { makeStrandTubes } from '../output/tubes.ts';
import { makeStrandLines } from '../output/lines.ts';
import { removeStrandGroup } from '../output/cleanup.ts';
import { buildBorder } from '../output/border.ts';
import { exportTubesOBJ, exportCurvesOBJ } from '../output/obj.ts';
import { downloadOBJ } from '../io.ts';
import { clipStrands, type ClipCan } from '../weave/clip.ts';
import type { Geometry } from '../geometry/types.ts';
import type { Pattern, WeaveResult } from '../weave/types.ts';

export interface WeaveStudioOptions {
  /** Floor height. Default -2.5. */
  floorY?: number;
  /** Show the border controls. The border itself appears for any geometry with
   *  an open edge (or a declared model boundary). Default false. */
  border?: boolean;
  /** Camera position. Default [0, 2.5, 5]. */
  cameraPosition?: [number, number, number];
  /** Called at the end of each rebuild with the rendered geometry (e.g. for
   *  demo-specific overlays like the tile inspector's port markers). */
  onRebuild?: (geometry: Geometry) => void;
}

export interface StudioProviders {
  geometry: () => Geometry | null;
  pattern: () => Pattern<any>;
  options: () => Record<string, number>;
}

export interface WeaveStudio {
  readonly app: App;
  /** Demo adds its source picker here. */
  readonly geometryTab: Tab;
  /** Demo adds its pattern picker here (above the studio's look controls). */
  readonly lookTab: Tab;
  /** Rebuild the strands (wire as the `onChange` of the demo's controls). */
  rebuild(): void;
  /** Add the studio's look/render controls, wire providers, mount, render. */
  start(providers: StudioProviders): void;
}

const YARN_COLORS = ['#3e3e44', '#3e3e44', '#3e3e44'];

export function createWeaveStudio(opts: WeaveStudioOptions = {}): WeaveStudio {
  const { app, lights } = createScene(studioScene({ floor: { y: opts.floorY ?? -2.5 } }), {
    antialias: true, pathTracerDefaults: { bounces: 10, samples: 1 },
  });
  const [cx, cy, cz] = opts.cameraPosition ?? [0, 2.5, 5];
  app.camera.position.set(cx, cy, cz);
  app.controls.target.set(0, 0, 0);

  // One material per strand family, so a two- or three-colour weave is just a
  // matter of picking colours; they start identical, so nothing changes until
  // someone does.
  const tubeMaterials = YARN_COLORS.map((hex) => new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(hex), roughness: 0.35, metalness: 0.85, clearcoat: 0.4, clearcoatRoughness: 0.2,
  }));
  const lineMaterials = YARN_COLORS.map((hex) => new THREE.LineBasicMaterial({ color: new THREE.Color(hex) }));
  const borderMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xc9a24a, roughness: 0.3, metalness: 0.9, clearcoat: 0.4, clearcoatRoughness: 0.2,
  });
  const borderLineMaterial = new THREE.LineBasicMaterial({ color: 0xc9a24a });

  let tubeRadius = 0.012;
  let conformal = 0;
  let clearance = 0.15;
  let selvedge = 0.6; // on by default — a cut edge is the thing it fixes
  let plies = 1;
  let plyTwist = 4;
  let showTubes = true;
  let smoothing = 0;
  let showBorder = true;
  let borderWidth = 0.06;
  let borderInset = 0.1;
  let group: THREE.Group | null = null;
  let borderGroup: THREE.Group | null = null;
  let providers: StudioProviders | null = null;

  const panel = new ControlPanel({ title: 'Knit' });
  const geometryTab = panel.tab('Geometry');
  const lookTab = panel.tab('Look');
  const renderTab = panel.tab('Render');

  const tubeOptions = () => ({
    materials: tubeMaterials, tubeRadius, plies, plyTwist,
  });

  function buildResult(geometry: Geometry): WeaveResult {
    const pattern = providers!.pattern();
    const width = buildWidthField(geometry, { baseRadius: tubeRadius, conformal });
    const analysis = analyze(geometry, pattern, { width, clearance });
    let result = generateStrands(analysis, pattern, providers!.options());
    result = smoothStrands(result, smoothing);
    // Before the width pass: a turn is drawn from the strands' own endpoints, and
    // its points then pick up the field like everything else.
    if (selvedge > 0) result = joinSelvedges(result, analysis, { bulge: selvedge });
    result = applyWidth(result, width);
    const clip = geometry.meta?.clip as ClipCan | undefined;
    if (clip) result = clipStrands(result, clip);
    return result;
  }

  function borderResult(geometry: Geometry): WeaveResult | null {
    if (!showBorder) return null;
    return buildBorder(geometry, { inset: borderInset });
  }

  function clearBorder(): void {
    if (!borderGroup) return;
    removeStrandGroup(borderGroup);
    borderGroup = null;
  }

  function rebuild(): void {
    if (!providers) return;
    if (group) { removeStrandGroup(group); group = null; }
    clearBorder();
    const geometry = providers.geometry();
    if (!geometry) return;

    const result = buildResult(geometry);
    group = showTubes
      ? makeStrandTubes(result, tubeOptions())
      : makeStrandLines(result, { materials: lineMaterials });
    app.scene.add(group);

    const border = borderResult(geometry);
    if (border) {
      borderGroup = showTubes
        ? makeStrandTubes(border, { materials: borderMaterial, tubeRadius: borderWidth, radialSegments: 12 })
        : makeStrandLines(border, { materials: borderLineMaterial });
      app.scene.add(borderGroup);
    }

    opts.onRebuild?.(geometry);
    app.notifyMaterialsChanged();
  }

  function start(p: StudioProviders): void {
    providers = p;

    // Look controls (appended below whatever picker the demo added to lookTab).
    lookTab.slider('Strand Width', { min: 0.003, max: 0.15, step: 0.001, value: tubeRadius },
      (v) => { tubeRadius = v; rebuild(); });
    lookTab.slider('Conformal', { min: 0, max: 1, step: 0.01, value: conformal },
      (v) => { conformal = v; rebuild(); });
    lookTab.slider('Clearance', { min: 0, max: 0.6, step: 0.01, value: clearance },
      (v) => { clearance = v; rebuild(); });
    lookTab.slider('Smoothing', { min: 0, max: 6, step: 1, value: smoothing },
      (v) => { smoothing = v; rebuild(); });
    lookTab.slider('Selvedge', { min: 0, max: 1.5, step: 0.05, value: selvedge },
      (v) => { selvedge = v; rebuild(); });
    lookTab.slider('Plies', { min: 1, max: 4, step: 1, value: plies },
      (v) => { plies = v; rebuild(); });
    lookTab.slider('Ply Twist', { min: 0, max: 24, step: 0.5, value: plyTwist },
      (v) => { plyTwist = v; rebuild(); });
    for (let f = 0; f < tubeMaterials.length; f++) {
      lookTab.color(f === 0 ? 'Color' : `Color ${f + 1}`, YARN_COLORS[f], (hex) => {
        tubeMaterials[f].color.set(hex);
        lineMaterials[f].color.set(hex);
        app.notifyMaterialsChanged();
      });
    }
    lookTab.slider('Roughness', { min: 0, max: 1, step: 0.01, value: tubeMaterials[0].roughness },
      (v) => { for (const m of tubeMaterials) m.roughness = v; app.notifyMaterialsChanged(); });
    lookTab.slider('Metalness', { min: 0, max: 1, step: 0.01, value: tubeMaterials[0].metalness },
      (v) => { for (const m of tubeMaterials) m.metalness = v; app.notifyMaterialsChanged(); });
    if (opts.border) {
      lookTab.toggle('Border', showBorder, (v) => { showBorder = v; rebuild(); });
      lookTab.slider('Border Width', { min: 0.01, max: 0.3, step: 0.005, value: borderWidth },
        (v) => { borderWidth = v; rebuild(); });
      lookTab.slider('Border Inset', { min: 0, max: 0.6, step: 0.01, value: borderInset },
        (v) => { borderInset = v; rebuild(); });
      lookTab.color('Border Color', '#c9a24a', (hex) => {
        borderMaterial.color.set(hex);
        borderLineMaterial.color.set(hex);
        app.notifyMaterialsChanged();
      });
    }

    // Render controls.
    addPathTraceControl(app, renderTab, { lights });
    addScreenshotControl(app, renderTab);
    addThumbnailControl(app, renderTab);
    const styleToggle = renderTab.toggle('Tubes', showTubes, (v) => {
      showTubes = v; styleToggle.setLabel(v ? 'Tubes' : 'Curves'); rebuild();
    });
    renderTab.color('Background', '#eef4ff', (hex) => { app.scene.background = new THREE.Color(hex); });
    renderTab.button('Export OBJ', () => {
      const geometry = providers!.geometry();
      if (!geometry) return;
      const result = buildResult(geometry);
      const border = borderResult(geometry);
      if (showTubes) {
        // Fabric and border in one file — the border used to be built straight
        // into the scene as a torus, and so never reached the exporter.
        const bundle = new THREE.Group();
        bundle.add(makeStrandTubes(result, tubeOptions()));
        if (border) bundle.add(makeStrandTubes(border, { materials: borderMaterial, tubeRadius: borderWidth, radialSegments: 12 }));
        downloadOBJ(exportTubesOBJ(bundle), 'weave-tubes.obj');
        removeStrandGroup(bundle);
      } else {
        const merged: WeaveResult = border ? {
          strands: [...result.strands, ...border.strands],
          strandRadii: [...result.strandRadii, ...border.strandRadii],
          strandFamilies: [...result.strandFamilies, ...border.strandFamilies],
          strandClosed: [...result.strandClosed, ...border.strandClosed],
        } : result;
        downloadOBJ(exportCurvesOBJ(merged), 'weave-curves.obj');
      }
    });

    panel.mount(document.body);
    // Restore any settings encoded in the URL, then keep the URL in sync — a look
    // you found by fiddling with fifteen sliders is worth being able to link to.
    attachPermalink(panel);
    rebuild();
    app.start();
  }

  return { app, geometryTab, lookTab, rebuild, start };
}
