# Weave

Generate woven, knitted, and chain-mail strand patterns on quad meshes. The pipeline takes a mesh with quadrilateral faces, analyzes its topology, traces continuous strand paths through the faces, and applies a design pattern to produce 3D curves that can be rendered as tubes or exported as OBJ.

## Setup

```
npm install
npm run dev
```

Open `http://localhost:5173` for the demo index, or go directly to any demo. The demos are split by input geometry class:

- `/demos/simple/` — The raw weave on a flat grid: curves only (no tubes), white background, no lighting. The clearest way to see what each knit produces. Single-tab `ControlPanel` (knit picker).
- `/demos/obj/` — Drop in your own quad mesh and knit it. Studio lighting, GPU path tracing, material controls, and OBJ export. Full Geometry / Look / Render panel.
- `/demos/surfaces/` — A gallery of sample surfaces: surfaces of revolution (torus, vase, sphere, hourglass, blob) plus parametric surfaces (helicoid, catenoid, Enneper, monkey saddle), chosen from one dropdown. Full panel. Fork this for a focused single-surface demo.

Demos are independent — each opts into only the controls it needs from the shared `ControlPanel`.

## Project Structure

```
src/
├── mesh/          Mesh topology and generators
├── weave/         Strand computation pipeline
├── output/        WeaveResult → geometry or file format
├── scene/         Three.js app shell, presets, and scene definitions
└── io.ts          Browser IO (file picker, download)

demos/             One folder per demo, each a standalone entry point
public/meshes/     Sample OBJ files (quad meshes)
```

### `src/mesh/` — Mesh Layer

Handles mesh representation, parsing, and procedural generation. No dependency on the weave layer.

| File | Exports | Purpose |
|------|---------|---------|
| `types.ts` | `ParsedMesh`, `Vertex`, `HalfEdge`, `Face` | Mesh types: parsed soup and half-edge data structure |
| `HalfEdgeMesh.ts` | `HalfEdgeMesh` | Half-edge mesh with traversal iterators (`faceEdges`, `faceVertices`, `faceNeighbors`, `faceSides`) |
| `parseOBJ.ts` | `parseOBJ(text)` | OBJ parser (vertices and faces only) |
| `geometry.ts` | `faceEdgeArray`, `edgeMidpoint`, `faceCenter`, `faceNormal`, `faceArea` | Geometric queries on the half-edge mesh |
| `generators/grid.ts` | `makeGrid(nx, nz, width, depth)` | Flat quad grid on the xz-plane |
| `generators/revolution.ts` | `makeRevolutionMesh(profile, nTheta, nT, closed)` | Surface of revolution from a 2D profile `(t) => {r, y}` |
| `generators/parametric.ts` | `makeParametricMesh(f, nu, nv, closedU, closedV)` | Quad mesh sampling a parametric surface `(u, v) => Vector3` over `[0,1]²` |
| `generators/torus.ts` | `makeTorus(R, r, nTheta, nT)` | Torus (wraps `makeRevolutionMesh`) |
| `generators/profiles.ts` | `profiles`, `profileNames` | Named revolution profiles (torus, vase, sphere, hourglass, blob) |
| `generators/surfaces.ts` | `surfaces`, `surfaceNames` | Unified sample-surface registry: revolution + parametric, each with a `build(na, nb)` and `closedA/closedB` flags |

All generators return `ParsedMesh { vertices: Vector3[], faces: number[][] }`. Wrapping directions (`closed*`) must use an **even** division count, or the weave 2-coloring will fail on the odd cycle.

### `src/weave/` — Strand Computation

The core pipeline. Takes a `ParsedMesh` and produces a `WeaveResult`. No rendering code — only uses `Vector3` as a math type.

#### Pipeline

```
ParsedMesh
  │
  ├─ HalfEdgeMesh.fromSoup()        Build half-edge topology
  ├─ classifyEdges(mesh)             Label edges into 2 families (the two grid directions)
  ├─ colorFaces(mesh)                Checkerboard 2-coloring (determines over/under)
  └─ traceStrands(mesh, families)    Trace continuous paths through faces
  │
  = MeshAnalysis { mesh, positions, edgeFamilies, faceColors, strands }
  │
  └─ generateStrands(analysis, design, options)
     │
     = WeaveResult { strands, strandFamilies, strandClosed }
```

`analyzeMesh(parsedMesh, families)` runs the first four steps. Then call `generateStrands(analysis, design, options)` with any design to get the final curves.

#### Key types

```ts
// The pipeline output — an array of 3D curves with metadata
interface WeaveResult {
  strands: Vector3[][];       // Dense sampled point arrays per strand
  strandFamilies: (0 | 1)[];  // Which grid direction each strand follows
  strandClosed: boolean[];    // Whether each strand forms a closed loop
}

// Strategy interface for strand patterns
interface StrandDesign<Opts> {
  readonly name: string;
  readonly families?: (0 | 1)[];  // Which edge families to trace ([0], [1], or [0,1])
  readonly id?: string;           // Stable id for pickers (defaults to name)
  readonly label?: string;        // Display label for the knit-type picker
  readonly params?: ParamSpec[];  // Tunable params with slider ranges + defaults
  generateStrandCurve(strand: Strand, analysis: MeshAnalysis, options: Opts): Vector3[];
}
```

#### Edge families and strand tracing

Every quad has 4 edges. `classifyEdges` labels them into two families — opposite edges get the same family, adjacent edges get different families. These are the two "grid directions" on the mesh.

```
    family 1
  ┌─────────┐
  │         │
family 0    │  face  │  family 0
  │         │
  └─────────┘
    family 1
```

`traceStrands` follows paths that cross through faces along one family: enter through a family-edge, exit through the opposite family-edge. On a torus, family-0 strands are parallel rings going one way, family-1 strands go the other way.

#### Designs

Each design file exports a `StrandDesign` and its own options type:

| Design | File | Families | Description |
|--------|------|----------|-------------|
| `weaveDesign` | `designs/weaveDesign.ts` | `[0, 1]` | Classic over/under weave. Hermite splines with sinusoidal normal displacement. |
| `loopDesign` | `designs/loopDesign.ts` | `[0]` | Knit-stitch loops. Catmull-Rom splines through 7 waypoints forming a loop into the adjacent face. |
| `omegaDesign` | `designs/omegaDesign.ts` | `[0]` | Horseshoe arches. Catmull-Rom splines through 9 waypoints forming an omega shape. Chain-mail effect. |

#### Implementing a new design

Create a file in `src/weave/designs/` that exports a `StrandDesign<YourOptions>`:

```ts
import type { Vector3 } from 'three';
import type { StrandDesign, Strand, MeshAnalysis } from '../types.ts';
import { edgeMidpoint, faceCenter, faceNormal } from '../../mesh/geometry.ts';
import { sampleCatmullRom } from '../splines.ts';

export interface MyOptions {
  amplitude?: number;
}

export const myDesign: StrandDesign<MyOptions> = {
  name: 'my-design',
  families: [0],  // which edge families to trace

  generateStrandCurve(strand: Strand, analysis: MeshAnalysis, options: MyOptions): Vector3[] {
    // For each segment in the strand:
    //   - segment.face: the quad face being crossed
    //   - segment.entryEdge / exitEdge: half-edges entering and leaving the face
    //
    // Use geometry helpers:
    //   edgeMidpoint(edge, positions)  — midpoint of an edge
    //   faceCenter(mesh, face, positions) — centroid of a face
    //   faceNormal(mesh, face, positions) — surface normal
    //
    // Use spline helpers:
    //   sampleCatmullRom(waypoints, samplesPerSegment, includeFirst) — smooth curve through points
    //   sampleHermite(p0, p1, t0, t1, n, includeFirst) — cubic Hermite interpolation
    //
    // Return a dense array of Vector3 points.
  },
};
```

All shared types (`Strand`, `StrandSegment`, `MeshAnalysis`, `StrandDesign`, `WeaveResult`) are exported from `src/weave/types.ts`.

Then use it in a demo:

```ts
const analysis = analyzeMesh(parsedMesh, myDesign.families);
const result = generateStrands(analysis, myDesign, { amplitude: 0.1 });
```

#### Available helpers

**Geometry** (`src/mesh/geometry.ts`) — generic mesh queries:

| Function | Purpose |
|----------|---------|
| `faceEdgeArray(mesh, face)` | All half-edges of a face as an array |
| `edgeMidpoint(he, positions)` | Midpoint of a half-edge |
| `faceCenter(mesh, face, positions)` | Centroid of a face |
| `faceNormal(mesh, face, positions)` | Normal via cross product of diagonals |
| `faceArea(mesh, face, positions)` | Area via cross product magnitude |

**Splines** (`src/weave/splines.ts`) — interpolation:

| Function | Purpose |
|----------|---------|
| `sampleHermite(p0, p1, t0, t1, n, includeFirst)` | Cubic Hermite spline interpolation |
| `catmullRom(p0, p1, p2, p3, t)` | Single Catmull-Rom point evaluation |
| `sampleCatmullRom(waypoints, samplesPerSegment, includeFirst)` | Catmull-Rom spline through waypoints (1 = straight lines between waypoints, higher = smoother) |

**Weave** (`src/weave/helpers.ts`) — weave-specific:

| Function | Purpose |
|----------|---------|
| `familyEdges(mesh, face, edgeFamilies, family)` | The two edges of a face in a given family |

### `src/output/` — Output Layer

Consumes `WeaveResult` and produces Three.js geometry or file exports. No knowledge of the weave pipeline internals.

| File | Exports | Purpose |
|------|---------|---------|
| `tubes.ts` | `makeStrandTubes(result, opts)` | `WeaveResult` → `THREE.Group` of `TubeGeometry` meshes |
| `lines.ts` | `makeStrandLines(result, opts)` | `WeaveResult` → `THREE.Group` of `Line` objects (fast preview) |
| `cleanup.ts` | `removeStrandGroup(group)` | Dispose geometries and remove from parent |
| `obj.ts` | `exportTubesOBJ(group)`, `exportCurvesOBJ(result)` | OBJ string generation (mesh or polyline format) |

`makeStrandTubes` and `makeStrandLines` both accept materials as a single material or a `[family0, family1]` tuple for two-tone rendering.

### `src/scene/` — Scene Infrastructure

Three.js app shell with composable presets and scene definitions.

| File | Exports | Purpose |
|------|---------|---------|
| `App.ts` | `App` | WebGL renderer, camera, controls, animation loop, path-tracer toggle |
| `ui.ts` | `Toolbar`, `Button`, `Slider` | Minimal fixed-position toolbar UI |
| `panel.ts` | `ControlPanel`, `Tab` | Configurable tabbed control panel (slider/dropdown/color/toggle/button) |
| `createScene.ts` | `createScene(setup, appOptions)` | Factory: creates an `App` and runs a scene setup function |
| `presets/environment.ts` | `addGradientEnvironment` | Sky gradient environment map |
| `presets/floor.ts` | `addFloor` | Physical material ground plane |
| `presets/lighting.ts` | `addStudioLighting` | Three-point studio lighting (key, fill, rim) |
| `pathTraceToggle.ts` | `addPathTraceControl(app, tab, {lights})`, `addPathTraceToggle(app, toolbar, lights)` | Path-trace toggle for a `ControlPanel` tab or a `Toolbar` |
| `screenshot.ts` | `addScreenshotControl(app, tab)`, `captureScreenshot(app, filename)` | Save the current frame (raster or path-traced) as a PNG download |
| `scenes/empty.ts` | `emptyScene(opts?)` | White background, nothing else |
| `scenes/studio.ts` | `studioScene(opts?)` | Gradient environment + floor + studio lighting |

`App` accepts a `container` option (defaults to `document.body`) for embedding in a specific element.

### `src/io.ts` — Browser IO

File operations that depend on the DOM, kept separate so the mesh and output layers stay browser-free.

| Function | Purpose |
|----------|---------|
| `loadOBJFile()` | Open a file picker, parse the selected OBJ, return a `ParsedMesh` |
| `downloadOBJ(content, filename)` | Trigger a browser download of OBJ text |

## Control panel (`src/scene/panel.ts`)

`ControlPanel` is a configurable, tabbed panel. A demo opts in and fills it
with only the controls it wants — there is no fixed/monolithic UI. Tabs are
created lazily; the tab bar appears only once there are two or more.

```ts
const panel = new ControlPanel({ title: 'Knit' });

const geo = panel.tab('Geometry');
geo.dropdown('Shape', { options, value: 'Torus' }, (v) => { shape = v; rebuild(); });
geo.slider('Knits θ', { min: 8, max: 120, step: 1, value: 36 }, (v) => { nTheta = v; rebuild(); });

const render = panel.tab('Render');
addPathTraceControl(app, render, { lights });   // path trace lives in any tab

panel.mount(document.body);
```

Control factories — `slider`, `dropdown`, `color`, `toggle`, `button` — each
return a handle with `.value` / `.set(v)` so a demo can read or update controls
programmatically. The convention is three tabs (**Geometry / Look / Render**),
but any tab names work.

### Knit-type picker

A design carries its own UI metadata (`id`, `label`, and `params` — see
`StrandDesign` in `src/weave/types.ts`), so ranges live with the design rather
than in a central table. `buildDesignControls` (in `src/weave/designs/index.ts`)
uses that metadata to add a knit-type dropdown plus auto-generated parameter
sliders to a tab:

```ts
const look = panel.tab('Look');
const controls = buildDesignControls(look, { value: 'loop', onChange: rebuild });
// then: generateStrands(analysis, controls.design, controls.options)
```

Adding a design or a parameter requires no UI changes — only the design's
`params` array. Shared shape presets live in `src/mesh/generators/profiles.ts`.

## Writing a demo

A minimal demo using the scene system:

```ts
import { createScene } from '@/scene/createScene.ts';
import { studioScene } from '@/scene/scenes/studio.ts';
import { analyzeMesh } from '@/weave/analyzeMesh.ts';
import { generateStrands } from '@/weave/generateStrands.ts';
import { weaveDesign } from '@/weave/designs/weaveDesign.ts';
import { makeTorus } from '@/mesh/generators/torus.ts';
import { makeStrandTubes } from '@/output/tubes.ts';
import * as THREE from 'three';

// 1. Generate or load a quad mesh
const mesh = makeTorus(1.5, 0.7, 48, 64);

// 2. Run the weave pipeline
const analysis = analyzeMesh(mesh, weaveDesign.families);
const result = generateStrands(analysis, weaveDesign, { amplitude: 0.05, samplesPerSegment: 8 });

// 3. Create scene (use studioScene, emptyScene, or a custom setup function)
const { app } = createScene(studioScene());
app.camera.position.set(0, 2.5, 4);

// 4. Render strands
const material = new THREE.MeshPhysicalMaterial({ color: 0xcc4444 });
const group = makeStrandTubes(result, { materials: material, tubeRadius: 0.015 });
app.scene.add(group);

// 5. Start
app.start();
```

For a minimal white-background scene, use `emptyScene()` instead of `studioScene()`. You can also pass a custom setup function directly:

```ts
const { app } = createScene((app) => {
  app.scene.background = new THREE.Color(0x111111);
  return {};
});
```

Create a folder `demos/my-demo/` with a `main.ts` and an `index.html` (copy one from an existing demo). Then add the entry to `vite.config.ts` under `build.rollupOptions.input`.

## Constraints

- **Quad meshes only.** Every face must have exactly 4 sides. The edge classification and strand tracing depend on quads having two pairs of opposite edges. If your input mesh has triangles, subdivide it into quads first (e.g., Catmull-Clark).
- **2-colorable face adjacency.** The mesh's face adjacency graph must be bipartite (checkerboard-colorable). Regular quad meshes satisfy this. Non-orientable or oddly-connected meshes will throw.
- **Connected mesh.** All faces must be reachable from face 0. Disconnected components will throw an error.

## OBJ Export

Two modes:

- **Tube export** (`exportTubesOBJ`) — writes the full tube mesh geometry (vertices + triangle faces). Use for 3D printing or rendering in other software.
- **Curve export** (`exportCurvesOBJ`) — writes strand paths as polylines (vertices + `l` line elements). Use for CNC wire bending or CAD import.

Use `downloadOBJ` from `src/io.ts` to trigger a browser download. The `export` demo has an "Export OBJ" button that exports whichever mode is currently shown (curves or tubes).
