# Knitted Surfaces

Generate woven, knitted, chain-mail, and triaxial strand patterns on **quad and triangle meshes**. The pipeline builds a mesh of cells, traces continuous strands through them, draws a stitch pattern in each cell, and renders the result as variable-radius tubes (or exports OBJ).

## Setup

```
npm install
npm run dev
```

Open `http://localhost:5173` for the demo index, or go directly to any demo:

- `/demos/simple/` — The raw weave on a flat grid, curves only, no lighting. Switch between a **Quad grid** and a **Triangle grid** — each a first-class fabric with its own pattern set.
- `/demos/obj/` — Drop in your own quad mesh. Studio lighting, GPU path tracing, screenshot, material controls, OBJ export.
- `/demos/surfaces/` — A gallery of sample surfaces (revolution + parametric) from the geometry-source registry, with the full panel. Fork this for a focused single-surface demo.

## The pipeline

```
Source → Geometry → Tile + Stitch → Pattern → Output → Scene
registry  cells +    ports → global   curves,  variable  app, render,
          cellType   strands          per type  tubes     ui
```

Each stage has a clear seam:

- **Geometry** builds an explicit quad *or* triangle mesh from any source.
- **Connectivity** is one model for every fabric: a pattern's **tile** declares *ports* on each cell edge + *arcs* pairing them, and the **stitcher** joins ports across shared edges purely by topology (twin half-edge + matching position) into continuous global strands. A thread weave is just the one-port-per-edge tile; chain mail is a closed-per-face tile; corner weaves are two-ports-per-edge.
- **Pattern** is the rendering half — the 3D curve a strand draws — and is free to read the whole mesh (e.g. Omega arches into the neighbouring cell).
- **Output / Scene** are arity-agnostic.

## Project structure

```
src/
├── geometry/      Mesh data, builders, and the source registry
│   ├── types.ts            ParsedMesh, half-edge types, Geometry, CellType
│   ├── HalfEdgeMesh.ts     Half-edge mesh + traversal iterators
│   ├── geometry.ts         faceCenter, edgeMidpoint, faceNormal/faceArea (any arity)
│   ├── parseOBJ.ts         OBJ parser
│   ├── parametric.ts       makeParametricMesh(f, domain) — the one quad builder
│   ├── triangleGrid.ts     makeTriangleGrid(f, domain) — triangle builder
│   ├── maps.ts             Profiles + parametric-surface maps + grid map
│   └── sources/            GeometrySource registry + buildSourceControls
├── weave/
│   ├── types.ts            Port, Strand, StrandSegment, Analysis, Pattern, StrandSample, WeaveResult
│   ├── tile/               Tile/Port/Arc types, the stitcher, and the tile factories
│   ├── routing/            classifyEdges(+Tri), colorFaces, analyze (geometry → Analysis)
│   ├── patterns/           weave, loop, omega (quad) · triaxialWeave, chainMail, cornerWeaves (tri) · registry
│   ├── generateStrands.ts  apply a pattern's render to every stitched strand
│   └── splines.ts          Hermite / Catmull-Rom helpers
├── output/        WeaveResult → tubes (variable radius) / lines / OBJ
├── scene/         App, ControlPanel, presets, path-trace + screenshot, paramPicker
├── params.ts      Shared ParamSpec (neutral, used by sources and patterns)
└── io.ts          Browser IO (file picker, downloads)
```

### Geometry layer

A `Geometry` is `{ cellType: 'quad' | 'tri', mesh: ParsedMesh }`. Builders guarantee homogeneous arity. There is **one** quad builder — `makeParametricMesh(f, { nu, nv, wrapU, wrapV })` — and surfaces of revolution and flat grids are just particular maps fed to it (see `maps.ts`). `makeTriangleGrid` splits each quad cell on a diagonal (3-edge-colourable, bipartite face-dual).

Sources are first-class registry entries, parallel to patterns:

```ts
interface GeometrySource {
  id: string; label: string; cellType: CellType;
  params?: ParamSpec[];                       // resolution sliders
  build(options: Record<string, number>): Geometry;
}
```

`buildSourceControls(tab, cellType, { onChange })` renders the source dropdown + its sliders. Add a surface by adding one entry to `src/geometry/sources/index.ts`.

### Connectivity: tile + stitch

`analyze(geometry, pattern)` classifies edges (the family/colour each strand follows), 2-colours the faces (a best-effort over/under sign source), then `stitch`es the pattern's **tile** into global strands and returns an `Analysis`. Each strand is a list of `StrandSegment { face, entry, exit, entryEdge, exitEdge, topEdge }` — `entry`/`exit` are the boundary `Port`s (a position `t` along a half-edge), and `topEdge` is the arced-over edge (a quad's perpendicular side, a triangle's third edge), both set by the stitcher so patterns don't re-derive them.

A **tile** (`src/weave/tile/`) decorates one cell with `ports` (edge index + `t` + family) and `arcs` (port pairings). The stitcher matches a port at `(halfEdge, t)` to its twin at `(halfEdge.twin, 1 - t)` — pure topology, never world coordinates — and walks the result into strands. Three factories cover every fabric:

- `threadTile([…families])` — one port per edge at `t = 0.5` (quad weaves + triaxial). Subsumes the old tracers.
- `cornerTile(fEntry, fExit)` — two ports per edge (corner weaves), arcs flanking each corner.
- `ringTile` — `closedPerFace`: one closed ring per face (chain mail); rings link in 3D, nothing to stitch.

### Pattern layer

A `Pattern` belongs to one cell type and pairs a **tile** (connectivity) with a render. Quad and triangle patterns are **separate registries**; the picker filters by the active geometry's cell type.

```ts
interface Pattern<Opts> {
  id: string; label: string; cellType: CellType;
  tile: TileFactory;                     // connectivity: ports + arc pairings per cell
  params?: ParamSpec[];
  generateStrandCurve(strand, analysis, options): Vector3[] | StrandSample[];
}
```

Return bare `Vector3[]` for constant-radius tubes, or `StrandSample[]` (`{ position, radius? }`) for a stitch whose tube **tapers**. `buildPatternControls(tab, cellType, { onChange })` builds the knit-type dropdown + parameter sliders. Add a pattern by adding one file (a tile + a render) + registering it in `src/weave/patterns/index.ts` (tagged `'quad'` or `'tri'`).

| Pattern | Cell | Tile | Description |
|---------|------|------|-------------|
| `loop` | quad | thread [0] | Knit-stitch loops |
| `weave` | quad | thread [0,1] | Classic over/under weave |
| `omega` | quad | thread [0] | Horseshoe arches |
| `triaxialWeave` | tri | thread [0,1,2] | Three-family over/under weave |
| `chainMail` | tri | ring (closed/face) | Interlocking ring per triangle |
| `linkedcorners` | tri | corner 1/3↔2/3 | Through-arc corner weave |
| `triquetra` | tri | corner 2/3↔1/3 | Trinity-knot corner link |

### Output layer

`makeStrandTubes` sweeps a **variable-radius** tube along each strand using a parallel-transport (rotation-minimizing) frame with a closing-twist correction — honoring per-point radius from `WeaveResult.strandRadii`, falling back to `tubeRadius`. (Adapted from `threejs-demos`' `buildTubeGeometry`.) `makeStrandLines` is the fast curve preview; `obj.ts` exports tube meshes or polylines.

### Scene layer

`App` (renderer, camera, controls, loop, path-tracer), `createScene`, studio presets, the `ControlPanel`/`Tab` widget toolkit, `paramPicker` (the shared "pick-one + tweak-its-params" control), `addPathTraceControl`, and `addScreenshotControl`.

## Constraints

- **Quad meshes:** every face has 4 sides. A clean checkerboard sign needs a 2-colourable, connected face-dual; otherwise `colorFaces` falls back to a best-effort colouring (some same-colour adjacencies) rather than failing.
- **Triangle meshes:** every face has 3 sides. A proper 3-edge-colouring exists only for 3-edge-colourable triangulations (the regular grid, polar annuli); others get a best-effort colouring with some defect points.
- **Wrapping directions** (revolution angle, catenoid loop, …) should use an **even** division count, or the 2-colouring picks up an odd-cycle defect.

## Roadmap (deferred)

A correct odd-valence over/under rule (3-phase / cyclic) for non-bipartite triangle tilings · crossing-sign (writhe) link verification · radial tube/height taper toward the disk boundary · triangle-OBJ import · breaking `scene/` into engine / render / ui · conformal (Ricci-flow) reparameterization for even stitches on curved surfaces.
