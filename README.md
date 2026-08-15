# Knitted Surfaces

Generate woven, knitted, chain-mail, and triaxial strand patterns on **quad and triangle meshes**. The pipeline builds a mesh of cells, traces continuous strands through them, draws a stitch pattern in each cell, and renders the result as variable-radius tubes (or exports OBJ).

## Setup

```
npm install
npm run dev      # gallery at http://localhost:5173
npm test         # pipeline invariants + every source × pattern
```

Open `http://localhost:5173` for the demo gallery — its cards are **generated
from the demos themselves** (see `vite.config.ts`): any directory under `demos/`
with a `main.ts` gets a card, titled and described by its own `index.html`
(`<title>`, `<meta name="description">`, optional `<meta name="demo-featured">`).
A demo's "Save Thumbnail" button (dev only) writes `public/thumbs/<demo>.jpg`,
which the card then shows. Go directly to any demo if you prefer. They
all share one studio scaffold (`src/scene/weaveStudio.ts`) — scene, materials, the
Look/Render controls, and the rebuild pipeline — differing only in which geometry
they show:

- `/demos/hyperbolic/` — Triangle tilings of the Poincaré disk. Metric-tapered tubes (thick centre → thin boundary) and a disk border with its own width / inset / colour.
- `/demos/3-sphere/` — Clifford and Hopf tori in S³, stereographically projected; tube width follows the stereographic metric (fattens outward).
- `/demos/surfaces/` — A gallery of ordinary surfaces (revolution + parametric), quad or triangle fabric.
- `/demos/quad-obj/` and `/demos/tri-obj/` — Load and knit your own quad or triangle mesh.
- `/demos/tile/` — Fundamental-domain inspector: one triangle with its weave and the **ports** each pattern declares; toggle the tiling to see how it repeats.

A geometry can carry its own **metric** as `radiusField` (hyperbolic `metricTaper`,
S³ `stereographicTaper`) and a **`meta.diskRadius`** for the disk border — the studio
applies both automatically. Every control's value lives in the URL hash
(`scene/permalink.ts`), so a look you find by fiddling is a link you can keep.

## The pipeline

```
Source → Geometry → Tile + Stitch → Sides → Pattern → Selvedge → Width → Output → Scene
registry  cells +    ports → global  over/   curves,   boundary   per-    tubes    app,
          cellType   strands         under   per type  turns      point   +border  ui
```

Each stage has a clear seam:

- **Geometry** builds an explicit quad *or* triangle mesh from any source.
- **Connectivity** is one model for every fabric: a pattern's **tile** declares *ports* on each cell edge + *arcs* pairing them, and the **stitcher** joins ports across shared edges purely by topology (twin half-edge + matching position) into continuous global strands. A thread weave is just the one-port-per-edge tile; chain mail is a closed-per-face tile; corner weaves are two-ports-per-edge.
- **Sides** (`weave/routing/sides.ts`) decides who is over at each crossing, by walking the alternation *along each strand* — breadth-first through the fabric so every strand arrives already constrained by a neighbour. The crossing rule (a pair must be opposite) is hard; alternation gives way to it, so the defects a bad 2-colouring used to spread in bands become isolated stitches. `Analysis.sideDefects` counts them.
- **Pattern** is the rendering half — the 3D curve a strand draws — and is free to read the whole mesh (e.g. Omega arches into the neighbouring cell).
- **Selvedge** (`weave/selvedge.ts`) joins strand ends that sit on the mesh boundary into hairpin turns, so an open surface ends in turns rather than cut stubs — see below.
- **Width** (`weave/width.ts` → `weave/radius.ts`) bakes the yarn thickness into per-point radii.
- **Output / Scene** are arity-agnostic.

### Width: constant, conformal, and clearance

`WidthField` answers "how thick is the yarn here?", and is the single source of
truth for it — the tube sweep uses it for the swept radius, and the patterns use
it to size their over/under lift. Three things multiply into it: the base radius,
the geometry's own metric taper, and a **conformal** blend of the local cell
scale (per-vertex mean edge length, Laplacian-smoothed, normalized to geometric
mean 1). The blend is continuous — `scale^conformal` — so 0 is constant width, 1
is fully proportional to the neighbouring cells, and the partial settings in
between are usually the nicest.

Because patterns read the same field, **Clearance** works: a crossing's lift is
floored at `width × (1 + clearance)`, so the two tubes are always at least that
far apart (`weave/clearance.ts`). Widening the yarn deepens the crossings instead
of pushing them through each other, and where the conformal blend draws the yarn
finer, the crossings shallow to match.

Uneven cells are also attacked at the source: `evenProfile` (in `maps.ts`)
reparameterizes a revolution profile by arc length, so rows of cells are evenly
spaced down the piece instead of bunching wherever the profile happened to move
fastest.

### Selvedge and border

Two different halves of "finish the edge":

- **Selvedge** is topological. Boundary strand ends are paired (nearest-first,
  same family, with a union-find guard that stops two-row loops from forming) and
  joined by a hairpin that bulges past the mesh edge. Cloth works this way — the
  weft turns at the edge and comes back on the next row — so a sheet that was
  hundreds of stubs becomes a few long boustrophedon threads.
- **Border** is the rail (`output/border.ts`). It is produced as ordinary
  strands, so it flows through the same tube builder as the fabric, gets the same
  rounded ends, and lands in OBJ exports. Any open mesh gets one from its
  boundary loops (offset inward along the surface); geometries that know better
  can declare `meta.diskRadius`, `meta.boundaryCurves`, or `meta.boundaryRings`.

### Yarn

`output/tubes.ts` sweeps rings along the polyline with a rotation-minimizing
frame. Open strands are **capped** with hemispherical rings (an uncapped end
reads as a black disc under the path tracer and is not a closed solid for
export), and **plies** turn one yarn into 2–4 finer ones spiralling around the
centreline — the offsets are just the transported frame, the twist is measured
per unit arc length, and on a closed strand it snaps to whole turns so the helix
meets itself. Geometries are merged per material, so a fabric is a few draw calls
rather than thousands.

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
│   ├── maps.ts             Profiles (+ evenProfile arc-length reparam) + surface maps + grid map
│   ├── s3.ts               Clifford / Hopf tori in S³ (stereographic projection)
│   ├── radiusFields.ts     metricTaper (hyperbolic) / stereographicTaper — per-geometry tube metric
│   ├── boundary.ts         Boundary loops (positions + indices) and circle fitting
│   ├── tilings/            Hyperbolic (p,q,r) triangle-group tiling
│   └── sources/            GeometrySource registry (grouped) + buildSourceControls
├── weave/
│   ├── types.ts            Port, Strand, StrandSegment, Analysis, Pattern, StrandSample, WeaveResult
│   ├── tile/               Tile/Port/Arc types, the stitcher, and the tile factories
│   ├── routing/            classifyEdges(+Tri), colorFaces, sides (over/under), analyze
│   ├── patterns/           weave, loop, omega (quad) · triaxialWeave, chainMail, cornerWeaves (tri) · registry
│   ├── generateStrands.ts  apply a pattern's render to every stitched strand
│   ├── width.ts            WidthField: base × cell-scale^conformal × metric
│   ├── clearance.ts        Crossing lift floored by the yarn's own thickness
│   ├── selvedge.ts         Boundary strand ends → hairpin turnarounds
│   ├── resample.ts         Arc-length resampling / cumulative lengths
│   └── splines.ts          Hermite / Catmull-Rom helpers
├── output/        WeaveResult → tubes (variable radius, capped, plied) / lines / border / OBJ
├── scene/         App, weaveStudio (shared demo scaffold), ControlPanel, presets, path-trace + screenshot + thumbnail, paramPicker, permalink
├── params.ts      Shared ParamSpec (neutral, used by sources and patterns)
└── io.ts          Browser IO (file picker, downloads)

test/              node --test, straight off the TS sources (no DOM)
├── weave.test.ts    Pipeline invariants: arcs consumed once, ports twin up,
│                    over/under alternates, clearance floors the lift, …
└── sources.test.ts  Every geometry source × every pattern of its cell type
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

`makeStrandTubes` sweeps a **variable-radius** tube along each strand using a parallel-transport (rotation-minimizing) frame with a closing-twist correction — honoring per-point radius from `WeaveResult.strandRadii`, falling back to `tubeRadius` — with rounded caps on open ends and optional plies. (Adapted from `threejs-demos`' `buildTubeGeometry`.) `makeStrandLines` is the fast curve preview; `border.ts` builds the edge rail as strands; `obj.ts` exports tube meshes or polylines (fabric **and** border).

### Scene layer

`App` (renderer, camera, controls, loop, path-tracer), `createScene`, studio presets, the `ControlPanel`/`Tab` widget toolkit, `paramPicker` (the shared "pick-one + tweak-its-params" control), `addPathTraceControl`, and `addScreenshotControl`.

## Constraints

- **Quad meshes:** every face has 4 sides. A clean checkerboard sign needs a 2-colourable, connected face-dual; otherwise `colorFaces` falls back to a best-effort colouring (some same-colour adjacencies) rather than failing.
- **Triangle meshes:** every face has 3 sides. A proper 3-edge-colouring exists only for 3-edge-colourable triangulations (the regular grid, polar annuli); others get a best-effort colouring with some defect points.
- **Wrapping directions** (revolution angle, catenoid loop, …) should use an **even** division count, or the 2-colouring picks up an odd-cycle defect.

## Roadmap (deferred)

**Next, and the big one: yarn-level relaxation.** Everything above draws where a
strand ideally goes; relaxation would let it settle — length constraints along
each thread, contact repulsion between nearby samples, attraction to the surface
— which is the difference between curves drawn on a surface and fabric. It also
subsumes the clearance floor, since contacts would resolve themselves.

Also deferred: a correct odd-valence over/under rule (3-phase / cyclic) for
non-bipartite triangle tilings · crossing-sign (writhe) link verification ·
triangle-OBJ import · breaking `scene/` into engine / render / ui · full
conformal (Ricci-flow) reparameterization for even stitches on curved surfaces
(`evenProfile` only handles surfaces of revolution).
