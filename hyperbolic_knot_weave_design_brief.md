# Hyperbolic Knot / Knit / Chainmail Pattern Design Brief

## Goal

We want to generate beautiful interlaced knot, knit, chainmail, or weave patterns from a hyperbolic triangular tiling. The desired aesthetic is similar to the supplied reference image: a Poincaré disk filled with glossy, thick, interlinked curved tubes, where the pattern is generated from local rules on a fundamental triangular tile and then propagated across the hyperbolic tiling.

The central design problem is:

> Start with a triangular hyperbolic tiling. Draw one or more curve snippets inside a single triangular fundamental domain. Allow the curves to move above or below the tile in a height direction. Then copy the decorated tile across the tiling so that the snippets join continuously into global strings, loops, links, or chainmail structures.

The output should be both mathematically coherent and visually rich.

---

## Conceptual Model: A Triangle as a Tangle Tile

Treat each triangular tile not merely as a decorated face, but as a **tangle tile**.

A tile design consists of:

1. **Boundary ports**: marked points on the three edges where strands enter or exit the triangle.
2. **Interior strand arcs**: smooth curves connecting ports or forming closed loops inside the triangle.
3. **Endpoint data**: tangent direction, height, and possibly normal/framing at each port.
4. **Crossing data**: which strand goes over or under at each projected crossing.
5. **Copying rule**: how the tile decoration transforms under reflection, rotation, or orientation reversal across neighboring triangles.
6. **Height rule**: a function assigning a vertical coordinate to the strand, so crossings become genuine 3D over/under passages rather than planar intersections.

A global pattern is valid when reflected/copied tiles join ports consistently and all intended over/under crossings are resolved in 3D.

---

## Basic Geometric Setup

Use a triangular tiling of the hyperbolic plane, for example a regular triangular tiling \(\{3,q\}\), where \(q\) triangles meet at every vertex. The visual reference resembles a \(\{7,3\}\) or dual \(\{3,7\}\)-type hyperbolic ring pattern, but the design language should work for general triangular tilings.

There are two useful viewpoints:

### Primal triangle viewpoint

The fundamental tile is an original triangle of the tiling. Strands are drawn inside that triangle and copied across edges.

### Medial / rectified viewpoint

Take the medial or rectified graph of the triangular tiling. Original edges become crossing sites, original vertices become \(q\)-gonal cells, and original triangular faces remain triangular cells. This is often the most natural viewpoint for Celtic knotwork and chainmail.

---

## Essential Matching Rules

For the pattern to link up cleanly, the following conditions should be enforced.

### 1. Port matching across edges

If a tile has a port at position \(t\) along an edge, the reflected neighboring tile must have a corresponding port at the same geometric point. Depending on edge orientation conventions, this is usually \(t \leftrightarrow 1-t\).

Each port should carry:

```text
edge_id
position_along_edge
tangent_direction
height
strand_id or strand_type
```

### 2. Smoothness across reflected tile boundaries

If adjacent tiles are related by reflection across an edge, then a curve meeting the boundary will continue smoothly after reflection if it hits the edge orthogonally.

Therefore a useful rule is:

> All strands crossing tile edges should meet the edge at right angles.

This prevents visible kinks after reflection.

### 3. Height compatibility

If a strand passes through a boundary port, the height should match the height of the corresponding strand in the neighboring tile. If a tile is flipped upside down in alternate copies, the copying rule must specify whether height is preserved, negated, or shifted.

Examples:

```text
same orientation copy:      z -> z
reflected copy:             z -> -z
alternating layer copy:      z -> z + phase(tile_color)
```

### 4. Crossings must be explicit

Every projected crossing should have a declared over/under assignment. Avoid accidental crossings caused by arbitrary curve drawing. A global pattern should be a link diagram plus a vertical realization.

### 5. Parity around odd-valence vertices

If \(q\) triangles meet at a vertex, a simple alternating over/under pattern around that vertex closes perfectly only when \(q\) is even. For odd \(q\), use one of:

- a non-alternating crossing somewhere;
- a 3-phase height rule;
- a cyclic rule modulo \(q\);
- vertex coloring or edge coloring;
- a non-periodic but deterministic crossing sequence.

This matters especially for \(\{3,7\}\), where seven triangles meet at each vertex.

---

## Major Design Families

### Design Family A: Vertex-Ring Chainmail

This is closest to the supplied reference aesthetic.

#### Idea

Put one ring around every vertex of the triangular tiling. Each ring is assembled from snippets contributed by the triangles incident to that vertex. Neighboring vertex-rings link across the edge between them.

In each triangle, near each corner, draw an arc connecting the two adjacent sides. When all incident triangles are copied around a vertex, these snippets close into a \(q\)-sided ring around that vertex.

Then, along each edge of the tiling, arrange the two endpoint-rings to clasp each other.

#### Local tile behavior

A triangle contributes three corner arcs:

```text
corner A: connects side AB to side AC
corner B: connects side BA to side BC
corner C: connects side CA to side CB
```

Each corner arc is a piece of the ring surrounding the corresponding vertex.

#### Linking rule

For every original edge, the two vertex-rings at its endpoints should have a two-crossing clasp.

Two main options:

1. **Hopf clasp**: both crossings have the same sign. Neighboring rings are genuinely linked.
2. **Weave clasp**: crossings have opposite signs. This looks woven but may be topologically unlinked pairwise.

#### Why it is promising

- Produces a literal chainmail of rings.
- Works beautifully in high-valence hyperbolic tilings.
- The geometry is simple: one ring per vertex, clasps along edges.
- Easy to thicken into glossy tubes.

#### Variations

- Make rings circular, rounded \(q\)-gons, triangular lobed rings, or star-shaped rosettes.
- Assign clasp signs by edge coloring.
- Give rings different heights by vertex color.
- Let ring radius shrink toward the disk boundary to maintain visual spacing.

---

### Design Family B: Rectified Celtic Weave

This is the cleanest form of the “cut off the corners and form circles around vertices” idea.

#### Idea

Rectify the triangular tiling. That is, cut off the corners of every triangle. This produces:

- a small triangle inside each original triangular face;
- a \(q\)-gon around each original vertex.

Now draw loops around both types of cells:

```text
face loops: small rounded triangles inside original triangles
vertex loops: rounded q-gons around original vertices
```

The loops cross at the midpoints of original edges.

#### Crossing rule

At each original edge midpoint, a face-loop and a vertex-loop cross. Choose an over/under rule.

Options:

1. **Uniform two-layer chainmail**
   - vertex loops always pass over face loops;
   - or face loops always pass over vertex loops.

2. **Alternating Celtic rule**
   - each component alternates over/under as it travels.
   - requires care with parity; perfect alternation around a \(q\)-gon needs \(q\) even.

3. **Three-phase rule**
   - assign vertices or face types phases \(0,1,2\);
   - crossing order follows a cyclic rule such as phase \(0\) over \(1\), \(1\) over \(2\), \(2\) over \(0\).

#### Why it is promising

- Very canonical.
- Guaranteed to link up if built from the medial graph.
- Naturally produces a Celtic knotwork aesthetic.
- Provides both triangle loops and vertex loops, giving multiple visual scales.

---

### Design Family C: Medial-Graph Alternating Links

This is a mathematically robust way to produce global links.

#### Idea

Take the medial graph of the triangular tiling. The medial graph has one vertex for each original edge and is 4-valent. A 4-valent planar graph is exactly the data needed for a knot diagram: each 4-valent vertex becomes a crossing.

For a \(\{3,q\}\) triangular tiling, the medial graph has triangular faces and \(q\)-gonal faces.

#### Construction

1. Construct the medial graph of the tiling.
2. At every medial vertex, choose one of the two crossing types.
3. Smooth edges into rounded arcs.
4. Lift overpasses upward and underpasses downward.
5. Thicken the resulting curves into tubes.

#### Crossing rules

Possible global crossing assignments:

```text
checkerboard alternating
edge-color based
vertex-color based
radial phase based
random but deterministic
height = sin(k * angle + phase)
```

#### Why it is promising

- Connectivity is automatic.
- The link diagram is clean and canonical.
- It gives a large family of Celtic and chainmail patterns.
- Good foundation for algorithmic generation.

---

### Design Family D: Triangular Braid Tiles

This design family is more “knitted cable” than “chainmail ring.”

#### Idea

Each triangle contains a small 3-strand braid. The three strands enter through the three sides and braid before exiting through the sides.

The local tile is defined by a braid word in the 3-strand braid group:

\[
B_3 = \langle \sigma_1, \sigma_2 \mid \sigma_1 \sigma_2 \sigma_1 = \sigma_2 \sigma_1 \sigma_2 \rangle.
\]

Examples:

```text
sigma_1 sigma_2
sigma_1 sigma_2^{-1}
sigma_1 sigma_2 sigma_1
(sigma_1 sigma_2)^2
```

#### Why it is promising

- Produces cable-knit visual structure.
- Local tiles can be very ornate.
- Good for patterns that look like braided strands rather than isolated rings.

#### Important condition

The ports on each side must match after reflection. It may be useful to put two or three ports per side and define a permutation of ports across the triangle.

---

### Design Family E: Triangular Truchet Tangle Tiles

This is a flexible generative family.

#### Idea

Place two ports on each side of the triangle, giving six boundary ports total. Inside the triangle, pair the six ports by smooth arcs. Different pairings give different local motifs.

Label the sides \(a,b,c\), and the ports:

```text
a_L, a_R
b_L, b_R
c_L, c_R
```

Possible matchings:

#### Corner-turn motif

```text
a_L <-> b_R
b_L <-> c_R
c_L <-> a_R
```

This makes strands circulate around vertices.

#### Straight-through motif

```text
a_L <-> a_R
b_L <-> b_R
c_L <-> c_R
```

This creates band-like strands across triangles.

#### Spiral motif

```text
a_L <-> b_L
b_R <-> c_R
c_L <-> a_R
```

This creates local pinwheels.

#### Why it is promising

- Many patterns can be generated from a small set of motifs.
- Motifs can be selected by tile color, distance from origin, random seed, or local symmetry.
- It supports both periodic and quasi-random ornamental designs.

---

### Design Family F: Vertex Rosettes and Star Rings

This is a higher-valence variation on vertex rings.

#### Idea

Around a vertex where \(q\) triangles meet, do not simply connect each snippet to the next. Instead connect snippet \(i\) to snippet \(i+k\) modulo \(q\). This creates star-polygon rings of type \(\{q/k\}\).

If \(\gcd(q,k)=1\), the snippets form one large star ring. If \(\gcd(q,k)>1\), they form several interleaved rings.

#### Examples

For \(q=7\):

```text
k = 1: ordinary heptagonal ring
k = 2: heptagram-like ring
k = 3: sharper heptagram-like ring
```

#### 3D height rule

Use a vertical oscillation:

\[
z(\theta) = \epsilon \sin(k\theta + \phi).
\]

This produces a rosette ring weaving above and below nearby structures.

#### Why it is promising

- High-valence hyperbolic vertices become ornate focal points.
- The resulting pattern has strong floral / mandala-like geometry.
- Can be combined with edge clasps to make rosettes link with neighboring rosettes.

---

### Design Family G: Edge-Ring Chainmail

#### Idea

Place one ring around each edge of the triangular tiling. Each ring straddles an original edge. Inside each triangle, the three edge-rings interact with one another near the center.

This gives a dense triangular chainmail pattern.

#### Local interaction

In every triangle, the three edge-rings form a small 3-ring tangle. Possible local crossing types:

```text
cyclic over-under: edge 1 over edge 2, edge 2 over edge 3, edge 3 over edge 1
one dominant ring over the other two
alternating braid-like clasp
Borromean-inspired triangular clasp
```

#### Why it is promising

- The visual density is high.
- The pattern aligns naturally with the edges of the triangular tiling.
- It may look more like metal mesh than Celtic knotwork.

---

## Height and Over/Under Design

The 3D height coordinate is essential. It turns a planar curve diagram into an actual embedded link or weave.

Useful height models:

### Binary over/under model

```text
overpass:  z = +h
underpass: z = -h
transition: smooth interpolation along the strand
```

This is simplest and works well for tube rendering.

### Sinusoidal strand model

Let each strand carry a phase \(\phi\). Along arclength \(s\):

\[
z(s) = h \sin(\omega s + \phi).
\]

Crossings are arranged so the phases differ by approximately \(\pi\).

### Color/phase layer model

Assign each tile, vertex, edge, or strand a phase in \(\mathbb Z/n\). Heights are determined by phase:

```text
phase 0: high
phase 1: middle
phase 2: low
```

or cyclically:

```text
0 over 1, 1 over 2, 2 over 0
```

This works especially well when simple alternation fails due to odd valence.

### Radial height modulation

For Poincaré disk renderings, it may help to modulate height or tube radius by hyperbolic distance from the origin or Euclidean radius in the disk.

Example:

\[
r_{tube}(\rho) = r_0 (1 - \alpha \rho^2)
\]

where \(\rho\) is Euclidean disk radius. This keeps boundary detail from becoming visually overwhelming.

---

## Rendering Notes

The target visual style is glossy, thick, rounded tubes in the Poincaré disk.

Useful rendering choices:

1. **Tube geometry**
   - Sweep a circular or slightly elliptical profile along each strand.
   - Use smooth joins and enough samples near high-curvature bends.

2. **Metallic or enamel materials**
   - Glossy anisotropic highlights make the weave legible.
   - Use color variation by hyperbolic radius, strand family, or height layer.

3. **Depth cues**
   - Make overpasses visibly lift above underpasses.
   - Use shadows or ambient occlusion where strands pass near one another.

4. **Boundary treatment**
   - As the hyperbolic tiling accumulates near the Poincaré disk boundary, reduce tube radius, opacity, or detail level.
   - Alternatively, crop at a finite hyperbolic radius and add a decorative border.

5. **Avoid accidental contacts**
   - Tube radius must be smaller than the minimum distance between unrelated strands in the same projected layer.
   - Crossings need enough vertical clearance for two tubes to pass without intersecting.

---

## Suggested Data Structures

A useful programmatic representation:

```python
class Port:
    tile_side: int          # 0, 1, 2
    t: float                # position along side, 0 to 1
    tangent_rule: str       # e.g. "orthogonal"
    height: float
    label: str

class StrandArc:
    start_port: Port | None
    end_port: Port | None
    control_points: list    # in local triangle coordinates
    strand_family: str
    phase: int
    closed: bool

class Crossing:
    arc_a: int
    arc_b: int
    location: tuple
    over_arc: int
    sign: int

class TangleTile:
    ports: list[Port]
    arcs: list[StrandArc]
    crossings: list[Crossing]
    copy_rule: str          # reflection, rotation, alternating reflection, etc.
```

For a global pattern:

```python
class TileInstance:
    transform: HyperbolicIsometry
    orientation: int
    color_class: int
    depth: int

class GlobalStrand:
    segments: list
    closed: bool
    family: str
    color: tuple
```

---

## Algorithmic Pipeline

A possible generation pipeline:

1. **Choose tiling**
   - Example: triangular tiling \(\{3,q\}\), such as \(q=7\).

2. **Generate finite patch**
   - Produce tiles in a Poincaré disk up to a chosen hyperbolic radius.

3. **Choose design family**
   - vertex-ring chainmail;
   - rectified Celtic weave;
   - medial graph alternating link;
   - braid tile;
   - Truchet tangle tile;
   - edge-ring chainmail;
   - vertex rosettes.

4. **Construct local tile geometry**
   - ports, arcs, crossings, height rules.

5. **Propagate across tiling**
   - reflect/copy tile decoration into every tile instance.

6. **Stitch strands**
   - identify matching ports across tile edges;
   - build global connected components.

7. **Resolve crossings**
   - assign over/under data consistently;
   - lift strands in height direction.

8. **Smooth geometry**
   - fit splines through strand points;
   - enforce tangency and curvature constraints.

9. **Render tubes**
   - sweep tube profiles;
   - shade with glossy/metallic material;
   - color by radius, family, or component.

10. **Evaluate aesthetics**
   - continuity;
   - no unintended intersections;
   - good density;
   - visible over/under hierarchy;
   - interesting global variation;
   - no excessive clutter near boundary.

---

## Specific Promising Experiments

### Experiment 1: Hyperbolic ring chainmail

Use a \(\{3,7\}\) triangular tiling. Put one heptagonal ring around each vertex. Along every edge, make the two endpoint rings form a Hopf clasp.

Expected look: very close to the supplied reference image.

### Experiment 2: Rectified \(\{3,7\}\) Celtic weave

Construct the medial graph. It has triangular faces and heptagonal faces. Put alternating crossings at every medial vertex, using a 3-phase rule to avoid odd-valence parity failure.

Expected look: Celtic hyperbolic knotwork with triangle loops and heptagon loops.

### Experiment 3: Heptagram rosette chainmail

Around every valence-7 vertex, use the \(k=2\) star connection rule. Then add edge clasps between neighboring rosettes.

Expected look: ornate hyperbolic floral chainmail.

### Experiment 4: Triangular cable knit

Inside each triangle, place a 3-strand braid with braid word:

\[
\sigma_1 \sigma_2^{-1} \sigma_1.
\]

Reflect the braid tile across edges, perhaps reversing the braid word under reflection.

Expected look: dense hyperbolic cable knitting.

### Experiment 5: Truchet random weave

Use two ports per side and a small library of triangular tangle tiles. Assign motifs randomly but deterministically by tile index or hash, preserving port matching.

Expected look: organic hyperbolic woven ornament, less symmetric than the reference.

---

## Aesthetic Objectives

The desired patterns should have:

- clear global hyperbolic structure;
- local interlacing that reads as physical over/under weaving;
- thick, smooth, glossy strands;
- no ambiguous crossings;
- strong scale variation from center to boundary;
- a balance between regularity and complexity;
- components that form loops, linked rings, or long continuous strands;
- robust tile-local rules that produce global coherence automatically.

---

## Questions for Further Design Exploration

1. Which tilings are most visually effective: \(\{3,7\}\), \(\{3,8\}\), \(\{3,9\}\), or nonregular Coxeter triangles?
2. Should global components be mostly small rings, long strands, or a mixture?
3. Should neighboring rings be topologically linked, or merely woven visually?
4. Should crossings alternate along every component, or should height be controlled by color/phase layers?
5. Should the pattern be maximally symmetric or use symmetry-breaking color/phase/noise?
6. Can one design a tile grammar that enumerates all valid tangle tiles with a fixed number of ports?
7. What is the best way to keep the boundary from becoming visually overcrowded?
8. Can we generate a score function for “good weave”: smoothness, link consistency, density, symmetry, and absence of collisions?

---

## Recommended Direction

The first serious implementation should probably be:

> **Vertex-ring chainmail on a \(\{3,7\}\) triangular tiling, with one ring around each vertex and Hopf-style clasps along edges.**

This most directly targets the visual style of the reference image. After that, the next best direction is:

> **Medial-graph / rectified Celtic weave, with triangular face loops and heptagonal vertex loops crossing at original edge midpoints.**

Together these two constructions cover the main desired aesthetics: physical chainmail rings and continuous Celtic knotwork.

