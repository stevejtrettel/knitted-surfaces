/**
 * Geometry-source registry.
 *
 * Each surface recipe (a map + wrap flags + default resolution) emits BOTH a
 * quad source (via `makeParametricMesh`) and a triangle source (via
 * `makeTriangleGrid`), so triangle and quad fabrics offer the same shapes.
 * Plus a flat grid in each flavour. `buildSourceControls` renders the picker +
 * resolution sliders into a panel tab, exactly like the pattern picker.
 */

import { Vector3 } from 'three';
import type { CellType, Geometry, ParsedMesh } from '../types.ts';
import type { GeometrySource, SourceGroup } from './types.ts';
import { makeParametricMesh, type Parametric, type Domain } from '../parametric.ts';
import { makeTriangleGrid } from '../triangleGrid.ts';
import { makeTriangleGroupMesh, type DiskModel } from '../tilings/triangleGroup.ts';
import { cliffordTorus, hopfNGon } from '../s3.ts';
import { metricTaper, stereographicTaper } from '../radiusFields.ts';
import { profiles, revolutionMap, gridMap, triLatticeMap, helicoid, catenoid, enneper, monkeySaddle } from '../maps.ts';
import { Tab } from '../../scene/panel.ts';
import { buildParamPicker } from '../../scene/paramPicker.ts';
import type { ParamSpec } from '../../params.ts';

export type { GeometrySource, SourceGroup };

/** Wrapping directions need even counts, or the 2-colouring fails. */
function evenIf(wrap: boolean | undefined, n: number): number {
  return wrap ? n - (n % 2) : n;
}

function resolutionParams(defU: number, defV: number) {
  return [
    { key: 'nu', label: 'Knits u', min: 8, max: 120, step: 1, default: defU },
    { key: 'nv', label: 'Knits v', min: 8, max: 120, step: 1, default: defV },
  ];
}

/** A surface recipe shared by the quad and triangle variants. */
interface Recipe {
  id: string;
  label: string;
  map: Parametric;
  wrapU?: boolean;
  wrapV?: boolean;
  nu: number;
  nv: number;
}

const recipes: Recipe[] = [
  // Surfaces of revolution (wrap around the axis; wrapV if the profile closes)
  ...(['Torus', 'Vase', 'Sphere', 'Hourglass', 'Blob'] as const).map((name) => {
    const p = profiles[name];
    return { id: name, label: p.label, map: revolutionMap(p.profile), wrapU: true, wrapV: p.closed, nu: 36, nv: 48 };
  }),
  // Parametric surfaces
  { id: 'Helicoid', label: 'Helicoid', map: helicoid, nu: 24, nv: 96 },
  { id: 'Catenoid', label: 'Catenoid', map: catenoid, wrapV: true, nu: 28, nv: 48 },
  { id: 'Enneper', label: 'Enneper surface', map: enneper, nu: 44, nv: 44 },
  { id: 'MonkeySaddle', label: 'Monkey saddle', map: monkeySaddle, nu: 44, nv: 44 },
  // Flat grid
  { id: 'Grid', label: 'Flat grid', map: gridMap(4, 4), nu: 8, nv: 8 },
];

function sourceFromRecipe(r: Recipe, cellType: CellType): GeometrySource {
  const build = (o: Record<string, number>): Geometry => {
    const domain: Domain = {
      nu: evenIf(r.wrapU, o.nu),
      nv: evenIf(r.wrapV, o.nv),
      wrapU: r.wrapU,
      wrapV: r.wrapV,
    };
    const mesh = cellType === 'tri' ? makeTriangleGrid(r.map, domain) : makeParametricMesh(r.map, domain);
    return { cellType, mesh };
  };
  return { id: r.id, label: r.label, cellType, group: 'surface', params: resolutionParams(r.nu, r.nv), build };
}

/** A single equilateral triangle on the xz-plane — the minimal tri model. */
function singleTriangleMesh(): ParsedMesh {
  const R = 1.15;
  const corner = (deg: number) =>
    new Vector3(R * Math.cos((deg * Math.PI) / 180), 0, R * Math.sin((deg * Math.PI) / 180));
  return { vertices: [corner(90), corner(210), corner(330)], faces: [[0, 1, 2]] };
}

const singleTriangle: GeometrySource = {
  id: 'Triangle', label: 'Single triangle', cellType: 'tri', group: 'surface',
  build: () => ({ cellType: 'tri', mesh: singleTriangleMesh() }),
};

/** Regular {3,6} triangular tiling — equilateral triangles, symmetric weave. */
const regularTriGrid: GeometrySource = {
  id: 'RegularTriGrid', label: 'Regular triangle grid', cellType: 'tri', group: 'surface',
  params: [{ key: 'n', label: 'Knits', min: 4, max: 80, step: 1, default: 10 }],
  build: (o) => ({ cellType: 'tri', mesh: makeTriangleGrid(triLatticeMap(4), { nu: o.n, nv: o.n }) }),
};

/**
 * Hyperbolic (p,q,r) Schwarz-triangle tiling, projected to a flat disk.
 * For a clean triaxial weave every valence (2p,2q,2r) must be divisible by 3,
 * i.e. p, q, r all divisible by 3 — otherwise the directional colouring tears.
 */
const TILING_SCALE = 2.4; // disk radius (projection scale) — the metric boundary
const TILING_MODEL: DiskModel = 'poincare';

function tilingSource(p: number, q: number, r: number): GeometrySource {
  return {
    id: `tiling-${p}-${q}-${r}`, label: `Hyperbolic (${p},${q},${r})`, cellType: 'tri', group: 'hyperbolic',
    params: [{ key: 'depth', label: 'Depth', min: 4, max: 24, step: 1, default: 16 }],
    build: (o) => ({
      cellType: 'tri',
      mesh: makeTriangleGroupMesh({ p, q, r, depth: o.depth, scale: TILING_SCALE, model: TILING_MODEL }),
      // Tubes follow the hyperbolic metric: thick at the centre, thinning toward
      // the disk boundary at radius TILING_SCALE (the conformal factor, fixed).
      radiusField: metricTaper(TILING_SCALE, TILING_MODEL),
      // The Poincaré disk boundary radius, so the demo can frame it with a border.
      meta: { diskRadius: TILING_SCALE },
    }),
  };
}

const TWO_PI = Math.PI * 2;

/** S³ surface, stereographically projected, with the stereographic taper — in
 *  BOTH fabrics (quad + triangle), sharing the same (u,v) map. */
function s3Sources(
  id: string, label: string, map: (p: Record<string, number>) => Parametric,
  defNu: number, defNv: number, shapeParams: ParamSpec[],
): GeometrySource[] {
  return (['quad', 'tri'] as CellType[]).map((cellType) => ({
    id, label, cellType, group: 's3',
    params: [...shapeParams, ...resolutionParams(defNu, defNv)],
    build: (o) => ({
      cellType,
      mesh: (cellType === 'tri' ? makeTriangleGrid : makeParametricMesh)(
        map(o), { nu: evenIf(true, o.nu), nv: evenIf(true, o.nv), wrapU: true, wrapV: true },
      ),
      radiusField: stereographicTaper(1),
    }),
  }));
}

export const sources: GeometrySource[] = [
  ...recipes.map((r) => sourceFromRecipe(r, 'quad')),
  singleTriangle,
  regularTriGrid,
  ...recipes.map((r) => sourceFromRecipe(r, 'tri')),
  tilingSource(3, 3, 6),   // ÷3 — triaxial or rings
  tilingSource(6, 6, 6),   // ÷3
  tilingSource(3, 3, 9),   // ÷3
  tilingSource(2, 3, 7),   // not ÷3 — rings only
  tilingSource(2, 4, 5),   // not ÷3 — rings only
  ...s3Sources('Clifford', 'Clifford torus', (o) => cliffordTorus(o.eta, o.rot), 80, 80, [
    { key: 'eta', label: 'Shape', min: 0.3, max: 1.2, step: 0.01, default: Math.PI / 4 },
    { key: 'rot', label: 'Rotate S³', min: 0, max: TWO_PI, step: 0.01, default: 0 },
  ]),
  ...s3Sources('Hopf', 'Hopf torus', (o) => hopfNGon(Math.round(o.n), o.amp, o.rot), 160, 60, [
    { key: 'n', label: 'Symmetry', min: 2, max: 9, step: 1, default: 3 },
    { key: 'amp', label: 'Lobes', min: 0, max: 1.3, step: 0.01, default: 0.6 },
    { key: 'rot', label: 'Rotate S³', min: 0, max: TWO_PI, step: 0.01, default: 0 },
  ]),
];

export function sourcesFor(cellType: CellType, group?: SourceGroup): GeometrySource[] {
  return sources.filter((s) => s.cellType === cellType && (group === undefined || s.group === group));
}

export interface SourceControls {
  readonly source: GeometrySource;
  readonly geometry: Geometry;
}

/**
 * Add a geometry-source dropdown + resolution sliders to a tab, restricted to
 * one cell type. Read `controls.geometry` after any change to rebuild.
 */
export function buildSourceControls(
  tab: Tab,
  cellType: CellType,
  config: { value?: string; label?: string; group?: SourceGroup; onChange: () => void },
): SourceControls {
  const items = sourcesFor(cellType, config.group);
  const picker = buildParamPicker(tab, {
    label: config.label ?? 'Surface',
    items,
    value: config.value,
    onChange: config.onChange,
  });
  return {
    get source() { return picker.item; },
    get geometry() { return picker.item.build(picker.options); },
  };
}
