/**
 * Tile / Fundamental-Domain Inspector
 *
 * Look at one tile up close — triangle or quad — its weave strands plus the
 * boundary PORTS each pattern declares (where strands cross the edges). Toggle
 * "Show tiling" to see how the tile repeats and joins across a small patch. An
 * authoring aid for designing new tile patterns.
 */

import * as THREE from 'three';
import { createWeaveStudio } from '@/scene/weaveStudio.ts';
import { Tab } from '@/scene/panel.ts';
import { buildPatternControls, type PatternControls } from '@/weave/patterns/index.ts';
import { sources } from '@/geometry/sources/index.ts';
import { makeParametricMesh } from '@/geometry/parametric.ts';
import { gridMap } from '@/geometry/maps.ts';
import { HalfEdgeMesh } from '@/geometry/HalfEdgeMesh.ts';
import { faceEdgeArray } from '@/geometry/geometry.ts';
import { classifyEdges } from '@/weave/routing/classifyEdges.ts';
import { classifyEdgesTri } from '@/weave/routing/classifyEdgesTri.ts';
import { colorFaces } from '@/weave/routing/colorFaces.ts';
import type { CellType, Geometry } from '@/geometry/types.ts';

const triangleSrc = sources.find((s) => s.id === 'Triangle')!;
const triGridSrc = sources.find((s) => s.id === 'RegularTriGrid')!;

let cellType: CellType = 'tri';
let showTiling = false;

/** One tile, or a small repeating patch, for the active cell type. */
function currentGeometry(): Geometry {
  if (cellType === 'tri') {
    return showTiling ? triGridSrc.build({ n: 4 }) : triangleSrc.build({});
  }
  const mesh = showTiling
    ? makeParametricMesh(gridMap(3, 3), { nu: 4, nv: 4 })
    : makeParametricMesh(gridMap(1.6, 1.6), { nu: 1, nv: 1 });
  return { cellType: 'quad', mesh };
}

let markers: THREE.Group | null = null;
const markerMat = new THREE.MeshBasicMaterial({ color: 0xff5566 });
const sphere = new THREE.SphereGeometry(0.035, 16, 16);

/** Drop a sphere at every port the active pattern's tile declares on every face. */
function drawPorts(geometry: Geometry): void {
  if (markers) { studio.app.scene.remove(markers); markers = null; }
  const mesh = HalfEdgeMesh.fromSoup(geometry.mesh.vertices.length, geometry.mesh.faces);
  const positions = geometry.mesh.vertices;
  const ctx = {
    mesh, positions, cellType: geometry.cellType,
    edgeColors: geometry.cellType === 'quad' ? classifyEdges(mesh) : classifyEdgesTri(mesh),
    faceColors: colorFaces(mesh),
  };
  const group = new THREE.Group();
  for (const face of mesh.faces) {
    const edges = faceEdgeArray(mesh, face);
    for (const port of patternControls.pattern.tile(face, ctx).ports) {
      const e = edges[port.edge];
      const p = new THREE.Vector3().lerpVectors(
        positions[e.origin.index], positions[e.next.origin.index], port.t,
      );
      const m = new THREE.Mesh(sphere, markerMat);
      m.position.copy(p);
      m.frustumCulled = false;
      group.add(m);
    }
  }
  studio.app.scene.add(group);
  markers = group;
}

const studio = createWeaveStudio({
  floorY: -1.5,
  cameraPosition: [0, 2, 3.2],
  onRebuild: drawPorts,
});

studio.geometryTab.dropdown('Cell Type',
  { options: [{ label: 'Triangle', value: 'tri' }, { label: 'Quad', value: 'quad' }], value: cellType },
  (v) => { cellType = v as CellType; refreshPattern(); studio.rebuild(); });
studio.geometryTab.toggle('Show tiling', showTiling, (v) => { showTiling = v; studio.rebuild(); });

// Look tab: a rebuildable pattern picker (rebuilt when the cell type changes).
const patternBox = document.createElement('div');
patternBox.style.cssText = 'display:flex;flex-direction:column;gap:9px;';
studio.lookTab.page.appendChild(patternBox);
const patternTab = new Tab(patternBox);
let patternControls: PatternControls;
function refreshPattern(): void {
  patternBox.innerHTML = '';
  const value = cellType === 'tri' ? 'linkedcorners' : 'weave';
  patternControls = buildPatternControls(patternTab, cellType, { value, onChange: studio.rebuild });
}
refreshPattern();

studio.start({
  geometry: currentGeometry,
  pattern: () => patternControls.pattern,
  options: () => patternControls.options,
});
