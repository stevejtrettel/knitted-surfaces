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
import { makeParametricMesh, makeTwistedGrid, trimByRadius, type Parametric, type Domain } from '../parametric.ts';
import { costa, costaBoundaryLoops } from '../costa.ts';
import { makeTriangleGrid } from '../triangleGrid.ts';
import { makeTriangleGroupMesh, type DiskModel } from '../tilings/triangleGroup.ts';
import { cliffordTorus, hopfNGon } from '../s3.ts';
import { metricTaper, stereographicTaper } from '../radiusFields.ts';
import { profiles, revolutionMap, evenProfile, gridMap, triLatticeMap, helicoid, catenoid, enneper, monkeySaddle, scherk, dini, kuen, kleinBottle, kleinClassic, boySurface, sudaneseMobius, sudaneseKlein, enneperN, catalan, henneberg, richmond, bour, roman, crossCap, trinoid } from '../maps.ts';
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
  /** Which demo it shows in. Default 'surface'. */
  group?: SourceGroup;
}

const recipes: Recipe[] = [
  // Surfaces of revolution (wrap around the axis; wrapV if the profile closes)
  ...(['Torus', 'Vase', 'Sphere', 'Hourglass', 'Blob'] as const).map((name) => {
    const p = profiles[name];
    const group: SourceGroup = name === 'Torus' ? 'topology' : 'surface';
    // Arc-length parameterization, so rows of cells are evenly spaced down the
    // profile instead of bunching wherever it happened to move fastest.
    return { id: name, label: p.label, map: revolutionMap(evenProfile(p.profile)), wrapU: true, wrapV: p.closed, nu: 36, nv: 48, group };
  }),
  // Classic differential-geometry surfaces
  { id: 'MonkeySaddle', label: 'Monkey saddle', map: monkeySaddle, nu: 44, nv: 44 },
  { id: 'Dini', label: 'Dini surface', map: dini, nu: 80, nv: 28 },
  { id: 'Kuen', label: 'Kuen surface', map: kuen, nu: 56, nv: 48 },
  // Minimal surfaces
  { id: 'Helicoid', label: 'Helicoid', map: helicoid, group: 'minimal', nu: 24, nv: 96 },
  { id: 'Catenoid', label: 'Catenoid', map: catenoid, group: 'minimal', wrapV: true, nu: 28, nv: 48 },
  { id: 'Scherk', label: 'Scherk surface', map: scherk, group: 'minimal', nu: 48, nv: 48 },
  { id: 'Enneper', label: 'Enneper surface', map: enneper, group: 'minimal', nu: 44, nv: 44 },
  { id: 'Enneper2', label: 'Enneper (order 2)', map: enneperN(2, 1.3, 0.32), group: 'minimal', nu: 52, nv: 52 },
  { id: 'Enneper3', label: 'Enneper (order 3)', map: enneperN(3, 1.15, 0.28), group: 'minimal', nu: 56, nv: 56 },
  { id: 'Catalan', label: 'Catalan surface', map: catalan, group: 'minimal', nu: 96, nv: 32 },
  { id: 'Henneberg', label: 'Henneberg surface', map: henneberg, group: 'minimal', nu: 56, nv: 56 },
  { id: 'Richmond', label: 'Richmond surface', map: richmond, group: 'minimal', wrapU: true, nu: 60, nv: 40 },
  { id: 'Bour', label: 'Bour surface', map: bour, group: 'minimal', wrapU: true, nu: 96, nv: 40 },
  // Non-orientable / projective-plane immersions
  { id: 'Roman', label: 'Roman surface', map: roman, group: 'topology', wrapU: true, nu: 56, nv: 56 },
  { id: 'CrossCap', label: 'Cross-cap', map: crossCap, group: 'topology', wrapU: true, nu: 56, nv: 36 },
  { id: 'Klein', label: 'Klein bottle', map: kleinClassic, group: 'topology', wrapU: true, nu: 40, nv: 120 },
  { id: 'Boy', label: "Boy's surface", map: boySurface, group: 'topology', wrapV: true, nu: 50, nv: 60 },
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
  return { id: r.id, label: r.label, cellType, group: r.group ?? 'surface', params: resolutionParams(r.nu, r.nv), build };
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

/** Costa minimal surface (quad + tri). The ℘-summed mesh is cached per resolution
 *  so the Clip slider (which only re-trims) stays responsive. */
function costaSources(): GeometrySource[] {
  const map = costa(1);
  return (['quad', 'tri'] as CellType[]).map((cellType) => {
    let cacheKey = '';
    let cached: ParsedMesh | null = null;
    return {
      id: 'Costa', label: 'Costa surface', cellType, group: 'minimal',
      params: [
        { key: 'radius', label: 'Radius', min: 1.5, max: 5, step: 0.1, default: 4 },
        { key: 'height', label: 'Height', min: 1, max: 5, step: 0.1, default: 2 },
        ...resolutionParams(80, 80),
      ],
      build: (o) => {
        const nu = evenIf(true, o.nu), nv = evenIf(true, o.nv);
        const key = `${nu}x${nv}`;
        if (key !== cacheKey) {
          cached = (cellType === 'tri' ? makeTriangleGrid : makeParametricMesh)(
            map, { nu, nv, wrapU: true, wrapV: true });
          cacheKey = key;
        }
        // trimByRadius bounds the mesh and removes the blow-up ends; the studio then
        // clips the strands to the can {radius, |y|≤height} for a flush cut. The
        // border curves are traced on the smooth surface (not the cut points).
        const safety = Math.hypot(o.radius, o.height) * 1.3;
        return {
          cellType,
          mesh: trimByRadius(cached!, safety),
          meta: { clip: { radius: o.radius, halfHeight: o.height }, boundaryCurves: costaBoundaryLoops(o.radius, o.height) },
        };
      },
    };
  });
}

/** Trinoid (quad + tri) — a three-ended minimal surface. The WE integral is run
 *  per vertex, so the mesh is cached per resolution; Clip re-trims to open the ends. */
function trinoidSources(): GeometrySource[] {
  return (['quad', 'tri'] as CellType[]).map((cellType) => {
    let cacheKey = '';
    let cached: ParsedMesh | null = null;
    return {
      id: 'Trinoid', label: 'Trinoid', cellType, group: 'minimal',
      params: [
        { key: 'clip', label: 'Clip', min: 1, max: 6, step: 0.1, default: 3 },
        ...resolutionParams(120, 60),
      ],
      build: (o) => {
        const nu = evenIf(true, o.nu), nv = o.nv;
        const key = `${nu}x${nv}`;
        if (key !== cacheKey) {
          cached = (cellType === 'tri' ? makeTriangleGrid : makeParametricMesh)(
            trinoid, { nu, nv, wrapU: true });
          cacheKey = key;
        }
        return { cellType, mesh: trimByRadius(cached!, o.clip) };
      },
    };
  });
}

/** Sudanese Möbius band in S³ (quad + tri) — non-orientable, with the width as an
 *  open edge (makeTwistedGrid wrapJ=false). Its single boundary circle is ringed. */
function sudaneseSources(): GeometrySource[] {
  return (['quad', 'tri'] as CellType[]).map((cellType) => ({
    id: 'Sudanese', label: 'Sudanese Möbius', cellType, group: 's3',
    params: resolutionParams(120, 40),
    build: (o) => ({
      cellType,
      // nu = around the loop (even, the twisted wrap); nv = across (open edge).
      mesh: makeTwistedGrid(sudaneseMobius, evenIf(true, o.nu), o.nv, cellType === 'tri', false),
      radiusField: stereographicTaper(1),
      meta: { boundaryRings: true },
    }),
  }));
}

/** Sudanese Klein bottle in S³ (quad + tri) — the doubled Möbius band, closed
 *  (wrapJ=true), with a Rotate S³ slider. Non-orientable → chain mail is robust. */
function sudaneseKleinSources(): GeometrySource[] {
  return (['quad', 'tri'] as CellType[]).map((cellType) => ({
    id: 'SudaneseKlein', label: 'Sudanese Klein bottle', cellType, group: 's3',
    params: [
      { key: 'rot', label: 'Rotate S³', min: 0, max: TWO_PI, step: 0.01, default: 0 },
      ...resolutionParams(120, 60),
    ],
    build: (o) => ({
      cellType,
      mesh: makeTwistedGrid(sudaneseKlein(o.rot), evenIf(true, o.nu), evenIf(true, o.nv), cellType === 'tri', true),
      radiusField: stereographicTaper(1),
    }),
  }));
}

/** Klein bottle (quad + tri) — non-orientable u-seam gluing (see makeTwistedGrid). */
function kleinSources(): GeometrySource[] {
  return (['quad', 'tri'] as CellType[]).map((cellType) => ({
    id: 'KleinFig8', label: 'Klein bottle (fig-8)', cellType, group: 'topology',
    params: resolutionParams(48, 48),
    build: (o) => ({
      cellType,
      mesh: makeTwistedGrid(kleinBottle, evenIf(true, o.nu), evenIf(true, o.nv), cellType === 'tri'),
    }),
  }));
}

export const sources: GeometrySource[] = [
  ...recipes.map((r) => sourceFromRecipe(r, 'quad')),
  singleTriangle,
  regularTriGrid,
  ...recipes.map((r) => sourceFromRecipe(r, 'tri')),
  ...kleinSources(),
  ...costaSources(),
  ...trinoidSources(),
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
  ...sudaneseSources(),
  ...sudaneseKleinSources(),
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
