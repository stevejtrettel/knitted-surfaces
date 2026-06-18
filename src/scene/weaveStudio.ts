/**
 * Shared "weave studio" scaffold for the demos.
 *
 * Every demo is the same studio — scene, materials, the Look/Render controls, and
 * the analyze → generate → smooth → metric-taper → tubes/curves(+border) pipeline
 * — differing only in which geometry it shows. A demo creates a studio, fills the
 * Geometry tab with its source picker (and the Look tab with a pattern picker),
 * then calls `start(providers)`; the studio owns the rest.
 *
 * The metric taper and the disk border are driven by the GEOMETRY: tubes follow
 * `geometry.radiusField` automatically (hyperbolic `metricTaper`, S³
 * `stereographicTaper`), and the boundary border appears when the geometry
 * declares `meta.diskRadius`.
 */

import * as THREE from 'three';
import type { App } from './App.ts';
import { createScene } from './createScene.ts';
import { studioScene } from './scenes/studio.ts';
import { ControlPanel, Tab } from './panel.ts';
import { addPathTraceControl } from './pathTraceToggle.ts';
import { addScreenshotControl } from './screenshot.ts';
import { analyze } from '../weave/routing/analyze.ts';
import { generateStrands } from '../weave/generateStrands.ts';
import { applyRadiusTaper } from '../weave/radius.ts';
import { smoothStrands } from '../weave/smooth.ts';
import { makeStrandTubes } from '../output/tubes.ts';
import { makeStrandLines } from '../output/lines.ts';
import { removeStrandGroup } from '../output/cleanup.ts';
import { exportTubesOBJ, exportCurvesOBJ } from '../output/obj.ts';
import { downloadOBJ } from '../io.ts';
import { boundaryLoops, fitCircle, type Circle } from '../geometry/boundary.ts';
import { clipStrands, type ClipCan } from '../weave/clip.ts';
import type { Geometry } from '../geometry/types.ts';
import type { Pattern, WeaveResult } from '../weave/types.ts';

export interface WeaveStudioOptions {
  /** Floor height. Default -2.5. */
  floorY?: number;
  /** Show disk-border controls (Width / Inset / Color); the border itself only
   *  appears for geometries that declare `meta.diskRadius`. Default false. */
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

export function createWeaveStudio(opts: WeaveStudioOptions = {}): WeaveStudio {
  const { app, lights } = createScene(studioScene({ floor: { y: opts.floorY ?? -2.5 } }), {
    antialias: true, pathTracerDefaults: { bounces: 10, samples: 1 },
  });
  const [cx, cy, cz] = opts.cameraPosition ?? [0, 2.5, 5];
  app.camera.position.set(cx, cy, cz);
  app.controls.target.set(0, 0, 0);

  const tubeMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x3e3e44, roughness: 0.35, metalness: 0.85, clearcoat: 0.4, clearcoatRoughness: 0.2,
  });
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x3e3e44 });
  const borderMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xc9a24a, roughness: 0.3, metalness: 0.9, clearcoat: 0.4, clearcoatRoughness: 0.2,
  });

  let tubeRadius = 0.012;
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

  function buildResult(geometry: Geometry): WeaveResult {
    const pattern = providers!.pattern();
    const analysis = analyze(geometry, pattern);
    let result = generateStrands(analysis, pattern, providers!.options());
    result = smoothStrands(result, smoothing);
    if (geometry.radiusField) result = applyRadiusTaper(result, geometry.radiusField, tubeRadius);
    const clip = geometry.meta?.clip as ClipCan | undefined;
    if (clip) result = clipStrands(result, clip);
    return result;
  }

  function clearBorder(): void {
    if (!borderGroup) return;
    app.scene.remove(borderGroup);
    borderGroup.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
    borderGroup = null;
  }

  function addBorderMesh(g: THREE.Group, geom: THREE.BufferGeometry): THREE.Mesh {
    const m = new THREE.Mesh(geom, borderMaterial);
    m.frustumCulled = false;
    g.add(m);
    return m;
  }
  const Z_AXIS = new THREE.Vector3(0, 0, 1);

  /** A round border ring on an oriented circle (the Möbius edge). */
  function drawCircle(g: THREE.Group, c: Circle): void {
    const mesh = addBorderMesh(g, new THREE.TorusGeometry(c.radius, borderWidth, 16, 220));
    mesh.quaternion.setFromUnitVectors(Z_AXIS, c.normal);
    mesh.position.copy(c.center);
  }

  /** A border ring that follows a closed boundary loop (waves with the surface). */
  function drawLoop(g: THREE.Group, loop: THREE.Vector3[]): void {
    const curve = new THREE.CatmullRomCurve3(loop, true, 'centripetal');
    addBorderMesh(g, new THREE.TubeGeometry(curve, Math.max(loop.length * 3, 64), borderWidth, 16, true));
  }

  /**
   * Frame a geometry's boundary: a flat ring for the hyperbolic disk
   * (`meta.diskRadius`); smooth parameter-traced loops for a clipped surface
   * (`meta.boundaryCurves` — Costa's ends, riding the true surface); else a circle
   * per open mesh boundary loop (`meta.boundaryRings` — the Möbius edge).
   */
  function updateBorder(geometry: Geometry): void {
    clearBorder();
    const diskRadius = geometry.meta?.diskRadius as number | undefined;
    const rings = geometry.meta?.boundaryRings === true;
    const curves = geometry.meta?.boundaryCurves as THREE.Vector3[][] | undefined;
    if (!showBorder || (diskRadius === undefined && !rings && !curves?.length)) return;
    const g = new THREE.Group();
    if (diskRadius !== undefined) {
      const ring = new THREE.TorusGeometry(Math.max(borderWidth, diskRadius - borderInset), borderWidth, 24, 320);
      ring.rotateX(Math.PI / 2); // lie flat in the xz-plane (the disk plane)
      addBorderMesh(g, ring);
    }
    if (curves?.length) {
      for (const loop of curves) drawLoop(g, loop);
    } else if (rings) {
      for (const loop of boundaryLoops(geometry.mesh)) drawCircle(g, fitCircle(loop));
    }
    borderGroup = g;
    app.scene.add(g);
  }

  function rebuild(): void {
    if (!providers) return;
    if (group) { removeStrandGroup(group); group = null; }
    const geometry = providers.geometry();
    if (!geometry) { clearBorder(); return; }
    const result = buildResult(geometry);
    group = showTubes
      ? makeStrandTubes(result, { materials: tubeMaterial, tubeRadius })
      : makeStrandLines(result, { materials: lineMaterial });
    app.scene.add(group);
    updateBorder(geometry);
    opts.onRebuild?.(geometry);
    app.notifyMaterialsChanged();
  }

  function start(p: StudioProviders): void {
    providers = p;

    // Look controls (appended below whatever picker the demo added to lookTab).
    lookTab.slider('Strand Width', { min: 0.003, max: 0.15, step: 0.001, value: tubeRadius },
      (v) => { tubeRadius = v; rebuild(); });
    lookTab.slider('Smoothing', { min: 0, max: 6, step: 1, value: smoothing },
      (v) => { smoothing = v; rebuild(); });
    lookTab.color('Color', '#3e3e44', (hex) => {
      tubeMaterial.color.set(hex); lineMaterial.color.set(hex); app.notifyMaterialsChanged();
    });
    lookTab.slider('Roughness', { min: 0, max: 1, step: 0.01, value: tubeMaterial.roughness },
      (v) => { tubeMaterial.roughness = v; app.notifyMaterialsChanged(); });
    lookTab.slider('Metalness', { min: 0, max: 1, step: 0.01, value: tubeMaterial.metalness },
      (v) => { tubeMaterial.metalness = v; app.notifyMaterialsChanged(); });
    if (opts.border) {
      lookTab.toggle('Border', showBorder, (v) => { showBorder = v; rebuild(); });
      lookTab.slider('Border Width', { min: 0.01, max: 0.3, step: 0.005, value: borderWidth },
        (v) => { borderWidth = v; rebuild(); });
      lookTab.slider('Border Inset', { min: 0, max: 0.6, step: 0.01, value: borderInset },
        (v) => { borderInset = v; rebuild(); });
      lookTab.color('Border Color', '#c9a24a', (hex) => {
        borderMaterial.color.set(hex); app.notifyMaterialsChanged();
      });
    }

    // Render controls.
    addPathTraceControl(app, renderTab, { lights });
    addScreenshotControl(app, renderTab);
    const styleToggle = renderTab.toggle('Tubes', showTubes, (v) => {
      showTubes = v; styleToggle.setLabel(v ? 'Tubes' : 'Curves'); rebuild();
    });
    renderTab.color('Background', '#eef4ff', (hex) => { app.scene.background = new THREE.Color(hex); });
    renderTab.button('Export OBJ', () => {
      const geometry = providers!.geometry();
      if (!geometry) return;
      const result = buildResult(geometry);
      if (showTubes) {
        downloadOBJ(exportTubesOBJ(makeStrandTubes(result, { materials: tubeMaterial, tubeRadius })), 'weave-tubes.obj');
      } else {
        downloadOBJ(exportCurvesOBJ(result), 'weave-curves.obj');
      }
    });

    panel.mount(document.body);
    rebuild();
    app.start();
  }

  return { app, geometryTab, lookTab, rebuild, start };
}
