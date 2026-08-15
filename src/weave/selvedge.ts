/**
 * Selvedge turnarounds — what a thread does when it reaches the edge of the cloth.
 *
 * The stitcher walks a strand until a port has no twin, which at an open boundary
 * means the thread simply stops. An open surface therefore comes out as hundreds
 * of stubs, each ending in a raw tube end hanging in the air a half-cell past the
 * mesh — the single most unfinished-looking thing about a woven open surface.
 *
 * Real cloth doesn't do that. At the selvedge the weft turns around and comes
 * back on the next row, so what looks like many parallel threads is one long
 * thread folded back and forth; knitting binds off the same way. This module
 * reproduces that: it finds the strand ends that sit on the mesh boundary, pairs
 * them up, and joins each pair into one continuous strand with a hairpin that
 * bulges out past the edge — so the fabric ends in a row of turns rather than a
 * row of cut ends, and the strand count drops by roughly half.
 *
 * Pairing is greedy nearest-neighbour among same-family ends, with a union-find
 * guard that refuses (on the first pass) to join two ends of the same chain. That
 * guard is what produces the boustrophedon: having joined rows 1–2 on the right,
 * row 2's left end can no longer close a two-row loop, so it takes row 3 instead,
 * and the whole sheet zig-zags into one thread. Pairs further apart than a few
 * times the typical turn are left alone — better an honest cut end than a wire
 * flung across the surface.
 *
 * Runs on the finished curves, so it works for every pattern without any of them
 * knowing about it.
 */

import { Vector3 } from 'three';
import type { Analysis, Port, WeaveResult } from './types.ts';
import { faceCenter, faceNormal } from '../geometry/geometry.ts';

export interface SelvedgeOptions {
  /**
   * How far a turn bulges past the mesh edge, relative to the gap it spans.
   * 0 disables the whole pass.
   */
  bulge: number;
  /** Points generated along each turn. Default 10. */
  samples?: number;
  /** Reject pairs further apart than this multiple of the median turn. Default 3. */
  maxSpan?: number;
}

/** One end of an open strand that sits on the mesh boundary. */
interface End {
  strand: number;
  /** true = the polyline's first point, false = its last. */
  isStart: boolean;
  point: Vector3;
  /** In-plane direction pointing out of the mesh, for the hairpin's bulge. */
  outward: Vector3;
}

const endId = (strand: number, isStart: boolean) => strand * 2 + (isStart ? 0 : 1);

/**
 * In-plane direction leaving the mesh at a boundary port: perpendicular to the
 * port's edge, in the plane of its face, pointing away from that face's centre.
 */
function outwardAt(port: Port, analysis: Analysis): Vector3 {
  const { mesh, positions } = analysis;
  const he = port.halfEdge;
  const o = positions[he.origin.index];
  const d = positions[he.next.origin.index];
  const dir = new Vector3().subVectors(d, o);
  if (dir.lengthSq() < 1e-20) return new Vector3(0, 1, 0);
  dir.normalize();

  const face = he.face;
  if (!face) return dir;
  const normal = faceNormal(mesh, face, positions);
  const out = new Vector3().crossVectors(normal, dir);
  if (out.lengthSq() < 1e-20) return dir;
  out.normalize();

  const at = new Vector3().lerpVectors(o, d, port.t);
  if (out.dot(at.clone().sub(faceCenter(mesh, face, positions))) < 0) out.negate();
  return out;
}

/** Cubic Bézier hairpin from a to b, bulging along each end's outward direction. */
function hairpin(a: End, b: End, height: number, samples: number): Vector3[] {
  const c1 = a.point.clone().addScaledVector(a.outward, height);
  const c2 = b.point.clone().addScaledVector(b.outward, height);
  const pts: Vector3[] = [];
  for (let i = 1; i < samples; i++) {
    const t = i / samples;
    const u = 1 - t;
    pts.push(new Vector3()
      .addScaledVector(a.point, u * u * u)
      .addScaledVector(c1, 3 * u * u * t)
      .addScaledVector(c2, 3 * u * t * t)
      .addScaledVector(b.point, t * t * t));
  }
  return pts;
}

/** Simple union-find over strand indices, so a pass can avoid closing a chain. */
function makeUnionFind(n: number) {
  const parent = new Int32Array(n).map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  };
  return {
    find,
    union(a: number, b: number) { parent[find(a)] = find(b); },
    same(a: number, b: number) { return find(a) === find(b); },
  };
}

/**
 * Join boundary strand ends into selvedge turns. Returns a new result whose
 * strands are the merged chains (untouched strands are carried through as-is).
 */
export function joinSelvedges(
  result: WeaveResult,
  analysis: Analysis,
  opts: SelvedgeOptions,
): WeaveResult {
  const samples = Math.max(2, opts.samples ?? 10);
  const maxSpan = opts.maxSpan ?? 3;
  if (!(opts.bulge > 0) || result.strands.length !== analysis.strands.length) return result;

  // --- Collect the ends that actually sit on the boundary ---------------------
  const ends = new Map<number, End>();
  for (let i = 0; i < result.strands.length; i++) {
    const pts = result.strands[i];
    const strand = analysis.strands[i];
    if (result.strandClosed[i] || pts.length < 2 || strand.segments.length === 0) continue;

    const first = strand.segments[0].entry;
    const last = strand.segments[strand.segments.length - 1].exit;
    if (first.halfEdge.twin === null) {
      ends.set(endId(i, true), { strand: i, isStart: true, point: pts[0], outward: outwardAt(first, analysis) });
    }
    if (last.halfEdge.twin === null) {
      ends.set(endId(i, false), { strand: i, isStart: false, point: pts[pts.length - 1], outward: outwardAt(last, analysis) });
    }
  }
  if (ends.size < 2) return result;

  // --- Pair them: nearest first, same family, no early loop closing ------------
  const ids = [...ends.keys()];
  const candidates: { a: number; b: number; d: number }[] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const A = ends.get(ids[i])!, B = ends.get(ids[j])!;
      if (A.strand === B.strand && result.strands[A.strand].length < 4) continue;
      if (result.strandFamilies[A.strand] !== result.strandFamilies[B.strand]) continue;
      candidates.push({ a: ids[i], b: ids[j], d: A.point.distanceTo(B.point) });
    }
  }
  if (candidates.length === 0) return result;
  candidates.sort((x, y) => x.d - y.d);

  // A turn should span about one cell. Take the median of each end's nearest
  // option as "typical" and refuse anything far longer — those are ends on
  // opposite sides of the mesh that happen to be each other's last resort.
  const nearest = new Map<number, number>();
  for (const c of candidates) {
    if (!nearest.has(c.a)) nearest.set(c.a, c.d);
    if (!nearest.has(c.b)) nearest.set(c.b, c.d);
  }
  const sortedNearest = [...nearest.values()].sort((a, b) => a - b);
  const median = sortedNearest[Math.floor(sortedNearest.length / 2)] ?? 0;
  const limit = median > 0 ? median * maxSpan : Infinity;

  const partner = new Map<number, number>();
  const uf = makeUnionFind(result.strands.length);
  for (const avoidLoops of [true, false]) {
    for (const c of candidates) {
      if (c.d > limit) break;
      if (partner.has(c.a) || partner.has(c.b)) continue;
      const A = ends.get(c.a)!, B = ends.get(c.b)!;
      if (avoidLoops && uf.same(A.strand, B.strand)) continue;
      partner.set(c.a, c.b);
      partner.set(c.b, c.a);
      uf.union(A.strand, B.strand);
    }
  }
  if (partner.size === 0) return result;

  // --- Walk the chains and concatenate ----------------------------------------
  const strands: Vector3[][] = [];
  const strandRadii: (number[] | null)[] = [];
  const strandFamilies: WeaveResult['strandFamilies'] = [];
  const strandClosed: boolean[] = [];
  const used = new Uint8Array(result.strands.length);

  const radiusOf = (i: number, j: number): number | null => {
    const r = result.strandRadii[i];
    return r && Number.isFinite(r[j]) ? r[j] : null;
  };

  const walk = (entry: number): void => {
    const pts: Vector3[] = [];
    const radii: number[] = [];
    let anyRadius = false;
    let closed = false;
    let cursor = entry;

    while (true) {
      const at = ends.get(cursor)!;
      const i = at.strand;
      if (used[i]) break;
      used[i] = 1;

      const src = result.strands[i];
      const order = at.isStart ? src.map((_, k) => k) : src.map((_, k) => src.length - 1 - k);

      // Bridge from the previous piece with a hairpin over the mesh edge.
      if (pts.length > 0) {
        const prevEnd = ends.get(partner.get(cursor)!)!;
        const gap = prevEnd.point.distanceTo(at.point);
        const r = radii.length > 0 ? radii[radii.length - 1] : 0;
        const height = opts.bulge * Math.max(0.5 * gap, 2 * r);
        const bridge = hairpin(prevEnd, at, height, samples);
        for (const p of bridge) {
          pts.push(p);
          radii.push(r);
        }
      }

      for (const k of order) {
        pts.push(src[k]);
        const r = radiusOf(i, k);
        if (r !== null) anyRadius = true;
        radii.push(r ?? 0);
      }

      const exit = endId(i, !at.isStart);
      const next = partner.get(exit);
      if (next === undefined) break;
      if (used[next >> 1]) {
        // Back to where the chain started: close it with one more turn.
        if (next === entry) {
          const a = ends.get(exit)!;
          const b = ends.get(entry)!;
          const gap = a.point.distanceTo(b.point);
          const r = radii[radii.length - 1] ?? 0;
          for (const p of hairpin(a, b, opts.bulge * Math.max(0.5 * gap, 2 * r), samples)) {
            pts.push(p);
            radii.push(r);
          }
          closed = true;
        }
        break;
      }
      cursor = next;
    }

    if (pts.length < 2) return;
    strands.push(pts);
    strandRadii.push(anyRadius ? radii : null);
    strandFamilies.push(result.strandFamilies[entry >> 1]);
    strandClosed.push(closed);
  };

  // Chain starts first (an end with no partner), so a chain is never entered in
  // the middle; whatever remains is a closed ring of turns, entered anywhere.
  for (const id of ids) if (!partner.has(id) && !used[id >> 1]) walk(id);
  for (const id of ids) if (!used[id >> 1]) walk(id);

  // Anything the pass never touched (closed strands, interior ends) carries over.
  for (let i = 0; i < result.strands.length; i++) {
    if (used[i]) continue;
    strands.push(result.strands[i]);
    strandRadii.push(result.strandRadii[i]);
    strandFamilies.push(result.strandFamilies[i]);
    strandClosed.push(result.strandClosed[i]);
  }

  return { strands, strandRadii, strandFamilies, strandClosed };
}
