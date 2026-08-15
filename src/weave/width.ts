/**
 * Tube width as a field over the surface.
 *
 * A `WidthField` answers one question — "how thick is the yarn HERE?" — and is
 * the single source of truth for it: the tube sweep uses it for the swept radius,
 * and the patterns use it to size their over/under lift (see `clearance.ts`), so
 * widening the yarn automatically deepens the crossings instead of making them
 * interpenetrate.
 *
 * Three things multiply into it:
 *
 *  • the base radius — the "Strand Width" slider;
 *  • a **conformal** factor: the local cell scale of the mesh, raised to a blend
 *    exponent. At 0 the yarn has constant width; at 1 it is proportional to the
 *    size of the neighbouring cells, so a stitch on a dense part of the mesh is
 *    drawn with correspondingly finer yarn and the fabric reads as one weave at
 *    one gauge. Anything between is a partial equalization — usually the prettiest
 *    setting, which is why this is a continuous blend and not a switch. Blending
 *    happens in the exponent (`scale^conformal`) so it is smooth and never crosses
 *    zero;
 *  • the geometry's own metric `radiusField`, if it declares one (the hyperbolic
 *    taper, the stereographic one) — unchanged, and composes with the above.
 *
 * The conformal factor is a *mesh* quantity, not a closed-form function of
 * position: per-vertex mean incident edge length, Laplacian-smoothed so it varies
 * continuously rather than jumping cell to cell, and normalized to geometric mean
 * 1 so turning the blend up doesn't change the overall gauge. Values are looked up
 * at arbitrary points by inverse-distance weighting over a uniform grid — the
 * strand samples don't carry their cell of origin, and after smoothing the field
 * is flat enough that interpolation is indistinguishable from the exact value.
 */

import { Vector3 } from 'three';
import type { Geometry, ParsedMesh } from '../geometry/types.ts';

/** Absolute tube radius at a point, plus the nominal radius it varies around. */
export interface WidthField {
  (p: Vector3): number;
  /** The radius where the conformal factor and the metric are both 1. */
  readonly base: number;
}

export interface WidthOptions {
  /** Nominal tube radius (the "Strand Width" control). */
  baseRadius: number;
  /** 0 = constant width · 1 = fully proportional to local cell size. Default 0. */
  conformal?: number;
  /** Laplacian smoothing passes over the cell-scale field. Default 12. */
  smoothing?: number;
}

/** A width field of the same radius everywhere. */
export function constantWidth(base: number): WidthField {
  return Object.assign((_p: Vector3) => base, { base });
}

/** Vertex neighbour lists (undirected, deduped) from face index lists. */
function vertexAdjacency(mesh: ParsedMesh): number[][] {
  const adj: Set<number>[] = mesh.vertices.map(() => new Set<number>());
  for (const f of mesh.faces) {
    for (let i = 0; i < f.length; i++) {
      const a = f[i], b = f[(i + 1) % f.length];
      adj[a].add(b);
      adj[b].add(a);
    }
  }
  return adj.map((s) => [...s]);
}

/**
 * Per-vertex local cell scale: the mean length of the edges meeting the vertex,
 * smoothed, then normalized so the geometric mean over the mesh is 1. Geometric
 * (not arithmetic) mean because the field is used multiplicatively — it keeps
 * `scale^conformal` gauge-preserving for every blend value.
 *
 * Returns the normalized field and the absolute scale it was divided by, so a
 * caller can recover cell size in world units.
 */
export function cellScaleField(
  mesh: ParsedMesh,
  smoothing = 12,
): { scale: Float64Array; meanCellSize: number } {
  const n = mesh.vertices.length;
  const sum = new Float64Array(n);
  const count = new Float64Array(n);

  for (const f of mesh.faces) {
    for (let i = 0; i < f.length; i++) {
      const a = f[i], b = f[(i + 1) % f.length];
      const len = mesh.vertices[a].distanceTo(mesh.vertices[b]);
      if (!Number.isFinite(len)) continue;
      sum[a] += len; count[a]++;
      sum[b] += len; count[b]++;
    }
  }

  const scale = new Float64Array(n);
  for (let i = 0; i < n; i++) scale[i] = count[i] > 0 ? sum[i] / count[i] : 0;

  // Fill isolated vertices with the mesh mean so smoothing has something sane.
  let total = 0, seen = 0;
  for (let i = 0; i < n; i++) if (scale[i] > 0) { total += scale[i]; seen++; }
  const fallback = seen > 0 ? total / seen : 1;
  for (let i = 0; i < n; i++) if (!(scale[i] > 0)) scale[i] = fallback;

  // Laplacian passes: half-step toward the neighbour mean. Facet-to-facet jitter
  // dies quickly; the large-scale variation we actually want to follow survives.
  if (smoothing > 0) {
    const adj = vertexAdjacency(mesh);
    let cur = scale;
    let next = new Float64Array(n);
    for (let pass = 0; pass < smoothing; pass++) {
      for (let i = 0; i < n; i++) {
        const nb = adj[i];
        if (nb.length === 0) { next[i] = cur[i]; continue; }
        let acc = 0;
        for (const j of nb) acc += cur[j];
        next[i] = 0.5 * cur[i] + 0.5 * (acc / nb.length);
      }
      const swap = cur; cur = next; next = swap;
    }
    if (cur !== scale) scale.set(cur);
  }

  let logSum = 0;
  for (let i = 0; i < n; i++) logSum += Math.log(Math.max(1e-12, scale[i]));
  const meanCellSize = Math.exp(logSum / Math.max(1, n));
  for (let i = 0; i < n; i++) scale[i] /= meanCellSize;

  return { scale, meanCellSize };
}

/**
 * Look up a per-vertex field at an arbitrary point: inverse-distance-squared
 * weighting over the vertices in the neighbouring cells of a uniform grid. The
 * search widens until it finds vertices, so points off the mesh (a stitch arching
 * above the surface, a strand outside a trimmed edge) still get a value.
 */
function makeFieldLookup(
  mesh: ParsedMesh,
  field: Float64Array,
  cell: number,
): (p: Vector3) => number {
  const size = Math.max(1e-6, cell);
  const grid = new Map<string, number[]>();
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  const cellOf = (v: number) => Math.floor(v / size);

  for (let i = 0; i < mesh.vertices.length; i++) {
    const v = mesh.vertices[i];
    if (!Number.isFinite(v.x + v.y + v.z)) continue;
    const k = key(cellOf(v.x), cellOf(v.y), cellOf(v.z));
    const bucket = grid.get(k);
    if (bucket) bucket.push(i); else grid.set(k, [i]);
  }

  const soften = (0.35 * size) ** 2; // keeps the weight finite at a vertex

  return (p: Vector3) => {
    const cx = cellOf(p.x), cy = cellOf(p.y), cz = cellOf(p.z);
    for (let ring = 1; ring <= 6; ring++) {
      let wSum = 0, fSum = 0;
      for (let x = cx - ring; x <= cx + ring; x++) {
        for (let y = cy - ring; y <= cy + ring; y++) {
          for (let z = cz - ring; z <= cz + ring; z++) {
            const bucket = grid.get(key(x, y, z));
            if (!bucket) continue;
            for (const i of bucket) {
              const w = 1 / (mesh.vertices[i].distanceToSquared(p) + soften);
              wSum += w;
              fSum += w * field[i];
            }
          }
        }
      }
      if (wSum > 0) return fSum / wSum;
    }
    return 1;
  };
}

/**
 * Build the width field for a geometry: base radius × cell-scale^conformal ×
 * the geometry's own metric taper. With `conformal = 0` and no metric this is a
 * constant, and the whole mesh pass is skipped.
 */
export function buildWidthField(geometry: Geometry, opts: WidthOptions): WidthField {
  const base = opts.baseRadius;
  const conformal = Math.min(1, Math.max(0, opts.conformal ?? 0));
  const metric = geometry.radiusField;

  if (conformal <= 0) {
    if (!metric) return constantWidth(base);
    return Object.assign((p: Vector3) => base * metric(p), { base });
  }

  const { scale, meanCellSize } = cellScaleField(geometry.mesh, opts.smoothing);
  const lookup = makeFieldLookup(geometry.mesh, scale, 2 * meanCellSize);
  const f = (p: Vector3) => {
    const s = Math.pow(Math.max(1e-6, lookup(p)), conformal);
    return base * s * (metric ? metric(p) : 1);
  };
  return Object.assign(f, { base });
}
