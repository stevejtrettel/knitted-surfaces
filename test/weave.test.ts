/**
 * Invariants of the weaving pipeline.
 *
 * Everything here is pure geometry and topology — no DOM, no renderer — so it
 * runs under `node --test` straight from the TypeScript sources. These are the
 * properties that are easy to break silently while adding a pattern or changing
 * the stitcher, and expensive to notice by eye: a strand that skips an arc, an
 * over/under that stops alternating, a crossing whose tubes intersect.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';

import { makeParametricMesh } from '../src/geometry/parametric.ts';
import { makeTriangleGrid } from '../src/geometry/triangleGrid.ts';
import { gridMap, revolutionMap, profiles, evenProfile } from '../src/geometry/maps.ts';
import { boundaryIndexLoops } from '../src/geometry/boundary.ts';
import type { Geometry } from '../src/geometry/types.ts';
import { analyze } from '../src/weave/routing/analyze.ts';
import { generateStrands } from '../src/weave/generateStrands.ts';
import { weavePattern } from '../src/weave/patterns/weave.ts';
import { triaxialWeavePattern } from '../src/weave/patterns/triaxialWeave.ts';
import { buildWidthField, cellScaleField, constantWidth } from '../src/weave/width.ts';
import { applyWidth } from '../src/weave/radius.ts';
import { joinSelvedges } from '../src/weave/selvedge.ts';
import { resampleByArcLength, arcLengths } from '../src/weave/resample.ts';
import { buildBorder } from '../src/output/border.ts';
import { buildSweptTube, plyCenterlines } from '../src/output/tubes.ts';

const N = 6;

/** A flat open grid in the xz-plane — every crossing is exactly ±y off it. */
function flatGrid(n = N): Geometry {
  return { cellType: 'quad', mesh: makeParametricMesh(gridMap(4, 4), { nu: n, nv: n }) };
}

/** A closed torus: no boundary, and (with even counts) a bipartite face dual. */
function torus(): Geometry {
  return {
    cellType: 'quad',
    mesh: makeParametricMesh(revolutionMap(profiles.Torus.profile), { nu: 12, nv: 16, wrapU: true, wrapV: true }),
  };
}

test('stitching consumes every tile arc exactly once', () => {
  const geometry = flatGrid();
  const analysis = analyze(geometry, weavePattern);
  const segments = analysis.strands.reduce((n, s) => n + s.segments.length, 0);
  // The thread tile puts one arc per family in every face; nothing may be
  // visited twice and nothing may be dropped.
  assert.equal(segments, analysis.mesh.faces.length * 2);
});

test('consecutive segments meet at topological twins', () => {
  const analysis = analyze(flatGrid(), weavePattern);
  for (const strand of analysis.strands) {
    for (let i = 0; i + 1 < strand.segments.length; i++) {
      const exit = strand.segments[i].exit;
      const entry = strand.segments[i + 1].entry;
      assert.equal(exit.halfEdge.twin, entry.halfEdge, 'exit port crosses into the next cell');
      assert.ok(Math.abs(1 - exit.t - entry.t) < 1e-9, 'port positions mirror across the edge');
    }
  }
});

test('over/under alternates along strands and opposes at crossings', () => {
  for (const geometry of [flatGrid(), torus()]) {
    const analysis = analyze(geometry, weavePattern);
    assert.equal(analysis.sideDefects, 0);

    for (const strand of analysis.strands) {
      for (let i = 0; i + 1 < strand.segments.length; i++) {
        assert.notEqual(strand.segments[i].side, strand.segments[i + 1].side, 'alternates along the thread');
      }
    }

    // In each face the two families must be on opposite sides — that is the
    // crossing itself, and it is the constraint alternation is allowed to break.
    const perFace = new Map<number, number[]>();
    for (const strand of analysis.strands) {
      for (const seg of strand.segments) {
        const list = perFace.get(seg.face.index) ?? [];
        list.push(seg.side);
        perFace.set(seg.face.index, list);
      }
    }
    for (const sides of perFace.values()) {
      assert.equal(sides.length, 2);
      assert.equal(sides[0] + sides[1], 0);
    }
  }
});

test('clearance floors the crossing lift for fat yarn', () => {
  const geometry = flatGrid();
  const width = constantWidth(0.05);
  const clearance = 0.2;
  const analysis = analyze(geometry, weavePattern, { width, clearance });
  // Amplitude far below what the yarn needs: the floor has to take over.
  const result = generateStrands(analysis, weavePattern, { amplitude: 0.001, samplesPerSegment: 8 });

  let peak = 0;
  for (const strand of result.strands) for (const p of strand) peak = Math.max(peak, Math.abs(p.y));
  const needed = 0.05 * (1 + clearance);
  assert.ok(peak >= needed * 0.99, `lift ${peak} should reach the clearance floor ${needed}`);
  // Two strands at ±lift are 2·lift apart, so with radius 0.05 they cannot touch.
  assert.ok(2 * peak > 2 * 0.05, 'crossing tubes stay clear of each other');
});

test('triaxial weave also respects the clearance floor', () => {
  const geometry: Geometry = { cellType: 'tri', mesh: makeTriangleGrid(gridMap(4, 4), { nu: N, nv: N }) };
  const width = constantWidth(0.04);
  const analysis = analyze(geometry, triaxialWeavePattern, { width, clearance: 0.1 });
  const result = generateStrands(analysis, triaxialWeavePattern, { amplitude: 0, samplesPerSegment: 4 });
  let peak = 0;
  for (const strand of result.strands) for (const p of strand) peak = Math.max(peak, Math.abs(p.y));
  assert.ok(peak >= 0.04 * 1.1 * 0.99, `lift ${peak} should reach the floor`);
});

test('cell-scale field is normalized and follows the mesh', () => {
  // A map that packs cells together at one end and stretches them at the other.
  const graded: Geometry = {
    cellType: 'quad',
    mesh: makeParametricMesh((u, v) => new Vector3((u * u - 0.5) * 4, 0, (v - 0.5) * 4), { nu: 20, nv: 20 }),
  };
  const { scale } = cellScaleField(graded.mesh);
  let logSum = 0;
  for (const s of scale) logSum += Math.log(s);
  assert.ok(Math.abs(Math.exp(logSum / scale.length) - 1) < 1e-9, 'geometric mean is 1');

  const width = buildWidthField(graded, { baseRadius: 0.02, conformal: 1 });
  const dense = width(new Vector3(-1.9, 0, 0));  // u ≈ 0: cells are packed
  const sparse = width(new Vector3(1.9, 0, 0));  // u ≈ 1: cells are stretched
  assert.ok(dense < sparse, `yarn should be finer where cells are smaller (${dense} vs ${sparse})`);

  const flat = buildWidthField(graded, { baseRadius: 0.02, conformal: 0 });
  assert.equal(flat(new Vector3(-1.9, 0, 0)), 0.02);
  assert.equal(flat(new Vector3(1.9, 0, 0)), 0.02);
});

test('applyWidth writes a radius for every point', () => {
  const geometry = flatGrid();
  const width = buildWidthField(geometry, { baseRadius: 0.03, conformal: 0.5 });
  const analysis = analyze(geometry, weavePattern, { width, clearance: 0.15 });
  const result = applyWidth(generateStrands(analysis, weavePattern, {}), width);
  for (let i = 0; i < result.strands.length; i++) {
    const radii = result.strandRadii[i];
    assert.ok(radii, 'every strand gets radii');
    assert.equal(radii.length, result.strands[i].length);
    for (const r of radii) assert.ok(Number.isFinite(r) && r > 0);
  }
});

test('selvedge turns join boundary ends into longer threads', () => {
  const geometry = flatGrid();
  const analysis = analyze(geometry, weavePattern);
  const before = generateStrands(analysis, weavePattern, {});
  const after = joinSelvedges(before, analysis, { bulge: 0.6 });

  assert.ok(after.strands.length < before.strands.length, 'strand count drops');
  const count = (r: typeof before) => r.strands.reduce((n, s) => n + s.length, 0);
  assert.ok(count(after) > count(before), 'turns add points rather than dropping any');
  for (const s of after.strands) for (const p of s) assert.ok(Number.isFinite(p.x + p.y + p.z));

  // Every joined pair was a pair of same-family ends.
  assert.equal(after.strandFamilies.length, after.strands.length);
  assert.equal(joinSelvedges(before, analysis, { bulge: 0 }), before, 'bulge 0 is a no-op');
});

test('a closed surface has no selvedge and no border', () => {
  const geometry = torus();
  const analysis = analyze(geometry, weavePattern);
  const result = generateStrands(analysis, weavePattern, {});
  assert.equal(joinSelvedges(result, analysis, { bulge: 0.6 }).strands.length, result.strands.length);
  assert.equal(buildBorder(geometry), null);
});

test('an open mesh has one boundary loop, and the border follows it', () => {
  const geometry = flatGrid();
  const loops = boundaryIndexLoops(geometry.mesh);
  assert.equal(loops.length, 1);
  assert.equal(loops[0].length, 4 * N);

  const border = buildBorder(geometry, { inset: 0.1 });
  assert.ok(border);
  assert.equal(border.strands.length, 1);
  assert.equal(border.strandClosed[0], true);
  // Inset pulls the ring inside the 4×4 sheet.
  for (const p of border.strands[0]) assert.ok(Math.max(Math.abs(p.x), Math.abs(p.z)) <= 2.0001);
});

test('arc-length resampling spaces points evenly and keeps the ends', () => {
  const pts = [new Vector3(0, 0, 0), new Vector3(0.05, 0, 0), new Vector3(0.1, 0, 0), new Vector3(3, 0, 0)];
  const out = resampleByArcLength(pts, 16, false);
  assert.equal(out.length, 16);
  assert.ok(out[0].distanceTo(pts[0]) < 1e-9);
  assert.ok(out[15].distanceTo(pts[3]) < 1e-9);

  const gaps: number[] = [];
  for (let i = 1; i < out.length; i++) gaps.push(out[i].distanceTo(out[i - 1]));
  const min = Math.min(...gaps), max = Math.max(...gaps);
  assert.ok(max / min < 1.01, `even spacing (${min}..${max})`);
});

test('an arc-length profile advances at constant speed', () => {
  const even = evenProfile(profiles.Hourglass.profile);
  const raw = profiles.Hourglass.profile;
  const steps = (p: typeof raw) => {
    const d: number[] = [];
    for (let i = 1; i <= 64; i++) {
      const a = p((i - 1) / 64), b = p(i / 64);
      d.push(Math.hypot(b.r - a.r, b.y - a.y));
    }
    return d;
  };
  const spread = (d: number[]) => Math.max(...d) / Math.min(...d);
  assert.ok(spread(steps(even)) < 1.05, 'reparameterized profile is near-uniform');
  assert.ok(spread(steps(even)) < spread(steps(raw)), 'and more uniform than the original');
});

test('plies twist around the yarn and close on a loop', () => {
  const points: Vector3[] = [];
  const count = 64;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    points.push(new Vector3(Math.cos(a), 0, Math.sin(a)));
  }
  const radii = points.map(() => 0.1);
  const plies = plyCenterlines(points, radii, true, 3, 2);
  assert.equal(plies.length, 3);

  const spacing = (2 * Math.PI) / count;
  for (const ply of plies) {
    for (let i = 0; i < ply.points.length; i++) {
      const off = ply.points[i].distanceTo(points[i]);
      assert.ok(off < 0.1 + 1e-9, 'a ply stays inside the yarn');
      assert.ok(ply.radii[i] < 0.1, 'and is thinner than it');
    }
    // Whole turns only, so the helix meets itself at the seam.
    const seam = ply.points[ply.points.length - 1].distanceTo(ply.points[0]);
    assert.ok(seam < 3 * spacing, `ply closes at the seam (${seam})`);
  }
});

test('capped tubes are closed and finite', () => {
  const points = [new Vector3(0, 0, 0), new Vector3(0, 0, 1), new Vector3(0, 0, 2)];
  const radii = [0.1, 0.1, 0.1];
  const bare = buildSweptTube(points, radii, false, 8, { caps: false });
  const capped = buildSweptTube(points, radii, false, 8, { caps: true, capSegments: 4 });

  const count = (g: typeof bare) => g.getAttribute('position').count;
  assert.ok(count(capped) > count(bare), 'caps add rings');

  const pos = capped.getAttribute('position');
  let maxZ = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    assert.ok(Number.isFinite(pos.getX(i) + pos.getY(i) + pos.getZ(i)));
    maxZ = Math.max(maxZ, pos.getZ(i));
  }
  // The cap reaches a radius beyond the last centre point.
  assert.ok(maxZ > 2 + 0.09, `cap extends past the end (${maxZ})`);
});

test('arc lengths accumulate, and close the loop when asked', () => {
  const square = [new Vector3(0, 0, 0), new Vector3(1, 0, 0), new Vector3(1, 0, 1), new Vector3(0, 0, 1)];
  assert.equal(arcLengths(square, false).at(-1), 3);
  assert.equal(arcLengths(square, true).at(-1), 4);
});
