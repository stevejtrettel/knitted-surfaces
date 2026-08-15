/**
 * WeaveResult → variable-radius tube meshes.
 *
 * Strand points are already densely sampled by the patterns (and evenly spaced in
 * arc length once they have been through `smoothStrands`), so we sweep a ring of
 * vertices directly along the polyline — no Catmull-Rom re-smoothing. The
 * cross-section frame is parallel-transported (rotation-minimizing) to avoid the
 * twist Frenet frames produce at inflections, with a closing-twist correction for
 * loops. Radius can vary per point (see `WeaveResult.strandRadii`).
 *
 * Two things turn the swept tube into something that reads as yarn:
 *
 *  • **Caps.** An open strand used to end in a hole — the sweep emits side quads
 *    only, so the path tracer saw a surface facing away from every light and drew
 *    a black disc, and exports were not closed solids. Ends are now rounded off
 *    with hemispherical rings.
 *
 *  • **Plies.** Real yarn is several finer strands twisted around each other.
 *    Given the transported frame, a ply is just the same sweep along a helix
 *    around the centreline, so the whole feature is an offset and a phase. The
 *    twist is measured per unit ARC LENGTH (hence `resample.ts`), and on a closed
 *    strand it is rounded to a whole number of turns so the helix meets itself.
 *
 * Adapted from threejs-demos `src/math/curves/buildTubeGeometry.ts`.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { WeaveResult } from '../weave/types.ts';
import { arcLengths } from '../weave/resample.ts';

export interface TubeOptions {
  /** Material(s) — single, or per-family [family0, family1, …]. */
  materials: THREE.Material | THREE.Material[];
  /** Fallback radius where a strand has no per-point radius. Default 0.015 */
  tubeRadius?: number;
  /** Radial segments around the tube. Default 8 */
  radialSegments?: number;
  /** Sub-strands twisted around the yarn's centre; 1 = a plain tube. Default 1. */
  plies?: number;
  /** Ply twist in turns per unit length. Default 4. */
  plyTwist?: number;
  /** Round off the ends of open strands. Default true. */
  caps?: boolean;
  /** Rings used to round each end. Default 4. */
  capSegments?: number;
}

const _axis = new THREE.Vector3();
const _cross = new THREE.Vector3();

/** Unit tangent at point i of a polyline (central differences; wraps if closed). */
function tangentAt(points: THREE.Vector3[], i: number, closed: boolean, out: THREE.Vector3): THREE.Vector3 {
  const n = points.length;
  if (closed) {
    out.subVectors(points[(i + 1) % n], points[(i - 1 + n) % n]);
  } else if (i === 0) {
    out.subVectors(points[1], points[0]);
  } else if (i === n - 1) {
    out.subVectors(points[n - 1], points[n - 2]);
  } else {
    out.subVectors(points[i + 1], points[i - 1]);
  }
  if (out.lengthSq() < 1e-20) out.set(0, 0, 1);
  return out.normalize();
}

/** Rotate `normal` from tangent `a` to tangent `b` (parallel transport step). */
function transport(normal: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): void {
  _axis.crossVectors(a, b);
  const sin = _axis.length();
  if (sin > 1e-6) {
    _axis.divideScalar(sin);
    normal.applyAxisAngle(_axis, Math.atan2(sin, a.dot(b)));
  }
  normal.addScaledVector(b, -normal.dot(b)).normalize(); // re-orthogonalize
}

export interface Frames {
  tangents: THREE.Vector3[];
  normals: THREE.Vector3[];
  binormals: THREE.Vector3[];
}

/**
 * Rotation-minimizing frame along a polyline. For a closed curve the residual
 * twist left after going all the way round is distributed evenly over the points,
 * so the frame — and anything phased against it, like a ply helix — meets itself
 * at the seam.
 */
export function transportFrames(points: THREE.Vector3[], closed: boolean): Frames {
  const n = points.length;
  const tangents: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) tangents.push(tangentAt(points, i, closed, new THREE.Vector3()));

  const normals: THREE.Vector3[] = [];
  const normal = new THREE.Vector3(1, 0, 0);
  if (Math.abs(tangents[0].x) > 0.9) normal.set(0, 1, 0);
  normal.crossVectors(tangents[0], normal).normalize();
  normals.push(normal.clone());
  for (let i = 1; i < n; i++) {
    transport(normal, tangents[i - 1], tangents[i]);
    normals.push(normal.clone());
  }

  if (closed && n > 1) {
    const pred = normals[n - 1].clone();
    transport(pred, tangents[n - 1], tangents[0]);
    const angle = Math.atan2(
      _cross.crossVectors(pred, normals[0]).dot(tangents[0]),
      pred.dot(normals[0]),
    );
    for (let i = 0; i < n; i++) normals[i].applyAxisAngle(tangents[i], (angle * i) / n);
  }

  const binormals = tangents.map((t, i) => new THREE.Vector3().crossVectors(t, normals[i]));
  return { tangents, normals, binormals };
}

/**
 * One cross-section of the sweep. `tiltCos`/`tiltSin` bend the shading normal
 * toward `axis`, which is what turns the last few rings of a strand into a
 * hemisphere instead of a flat disc: the ring positions shrink while the normals
 * rotate to point along the yarn.
 */
interface Ring {
  c: THREE.Vector3;
  n: THREE.Vector3;
  b: THREE.Vector3;
  r: number;
  axis: THREE.Vector3;
  tiltCos: number;
  tiltSin: number;
  v: number;
}

export interface SweepOptions {
  /** Round off the ends of an open tube. Default true. */
  caps?: boolean;
  /** Rings per cap. Default 4. */
  capSegments?: number;
}

/**
 * Build a swept tube along a polyline with per-point radius.
 * `radii[i]` is the radius at point i.
 */
export function buildSweptTube(
  points: THREE.Vector3[],
  radii: number[],
  closed: boolean,
  radialSegments: number,
  opts: SweepOptions = {},
): THREE.BufferGeometry {
  const n = points.length;
  const { tangents, normals, binormals } = transportFrames(points, closed);

  const rings: Ring[] = [];
  for (let i = 0; i < n; i++) {
    rings.push({
      c: points[i], n: normals[i], b: binormals[i], r: radii[i],
      axis: tangents[i], tiltCos: 1, tiltSin: 0,
      v: n > 1 ? i / (n - 1) : 0,
    });
  }

  const capSegments = Math.max(1, opts.capSegments ?? 4);
  if (!closed && (opts.caps ?? true) && n > 1) {
    // A hemisphere of rings at each end: centre walks outward along the tangent
    // by r·sin φ while the radius shrinks to r·cos φ.
    const cap = (i: number, sign: 1 | -1): Ring[] => {
      const r = radii[i];
      const out: Ring[] = [];
      if (!(r > 0)) return out;
      for (let k = 1; k <= capSegments; k++) {
        const phi = (k / capSegments) * (Math.PI / 2);
        out.push({
          c: points[i].clone().addScaledVector(tangents[i], sign * r * Math.sin(phi)),
          n: normals[i], b: binormals[i], r: r * Math.cos(phi),
          axis: tangents[i].clone().multiplyScalar(sign),
          tiltCos: Math.cos(phi), tiltSin: Math.sin(phi),
          v: i === 0 ? 0 : 1,
        });
      }
      return out;
    };
    rings.unshift(...cap(0, -1).reverse());
    rings.push(...cap(n - 1, 1));
  }

  const stride = radialSegments + 1;
  const positions: number[] = [];
  const normalAttr: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const dir = new THREE.Vector3();

  for (const ring of rings) {
    for (let j = 0; j <= radialSegments; j++) {
      const angle = (j / radialSegments) * Math.PI * 2;
      dir.copy(ring.n).multiplyScalar(Math.cos(angle)).addScaledVector(ring.b, Math.sin(angle)).normalize();
      positions.push(
        ring.c.x + dir.x * ring.r,
        ring.c.y + dir.y * ring.r,
        ring.c.z + dir.z * ring.r,
      );
      normalAttr.push(
        dir.x * ring.tiltCos + ring.axis.x * ring.tiltSin,
        dir.y * ring.tiltCos + ring.axis.y * ring.tiltSin,
        dir.z * ring.tiltCos + ring.axis.z * ring.tiltSin,
      );
      uvs.push(ring.v, j / radialSegments);
    }
  }

  const ringCount = rings.length;
  const segCount = closed ? ringCount : ringCount - 1;
  for (let i = 0; i < segCount; i++) {
    const iN = (i + 1) % ringCount;
    for (let j = 0; j < radialSegments; j++) {
      const a = i * stride + j;
      const b = iN * stride + j;
      const c = iN * stride + j + 1;
      const d = i * stride + j + 1;
      // Wound so the geometric normal matches the outward shading normal. The
      // reverse order (a,b,d / b,c,d) faces the triangles INWARD, which the path
      // tracer reads as the surface facing away from all light → black tubes.
      indices.push(a, d, b, b, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normalAttr, 3));
  // uv is needed so the path tracer can merge tubes with other meshes (e.g. the
  // floor) into one BVH geometry — without it the attribute sets mismatch and the
  // merge throws.
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geometry;
}

/**
 * Split one yarn into `plies` helical sub-strands. Each ply's centreline spirals
 * around the original at offset `e`, with its own radius `r`, packed so the plies
 * touch each other and just fill the original tube: for n circles of radius r
 * arranged on a circle of radius e inside R, `r = R·s/(1+s)` and `e = R − r`,
 * with `s = sin(π/n)`.
 */
export function plyCenterlines(
  points: THREE.Vector3[],
  radii: number[],
  closed: boolean,
  plies: number,
  twist: number,
): { points: THREE.Vector3[]; radii: number[] }[] {
  const { normals, binormals } = transportFrames(points, closed);
  const cum = arcLengths(points, closed);
  const total = cum[cum.length - 1];
  if (!(total > 0)) return [];

  // A closed yarn must come back to its own phase, so round to whole turns.
  const turns = closed ? Math.max(1, Math.round(twist * total)) : twist * total;
  const s = Math.sin(Math.PI / plies);
  const rFactor = s / (1 + s);

  const out: { points: THREE.Vector3[]; radii: number[] }[] = [];
  for (let p = 0; p < plies; p++) {
    const pts: THREE.Vector3[] = [];
    const rad: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const theta = 2 * Math.PI * (p / plies + (turns * cum[i]) / total);
      const r = radii[i] * rFactor;
      const e = radii[i] - r;
      pts.push(points[i].clone()
        .addScaledVector(normals[i], Math.cos(theta) * e)
        .addScaledVector(binormals[i], Math.sin(theta) * e));
      rad.push(r);
    }
    out.push({ points: pts, radii: rad });
  }
  return out;
}

/**
 * Build the tube meshes for a whole weave. Geometries are merged per material,
 * so a fabric of hundreds of strands (times its plies) is a handful of draw calls
 * rather than thousands.
 */
export function makeStrandTubes(result: WeaveResult, opts: TubeOptions): THREE.Group {
  const group = new THREE.Group();
  group.name = 'strand-tubes';
  const fallback = opts.tubeRadius ?? 0.015;
  const radial = opts.radialSegments ?? 8;
  const plies = Math.max(1, Math.round(opts.plies ?? 1));
  const twist = opts.plyTwist ?? 4;
  const sweep: SweepOptions = { caps: opts.caps ?? true, capSegments: opts.capSegments };

  // material index → geometries drawn with it
  const buckets = new Map<number, { material: THREE.Material; geometries: THREE.BufferGeometry[] }>();
  const bucketFor = (family: number) => {
    const list = opts.materials;
    const index = Array.isArray(list) ? (list[family] !== undefined ? family : 0) : 0;
    let bucket = buckets.get(index);
    if (!bucket) {
      bucket = { material: Array.isArray(list) ? list[index] : list, geometries: [] };
      buckets.set(index, bucket);
    }
    return bucket;
  };

  for (let i = 0; i < result.strands.length; i++) {
    const strand = result.strands[i];
    if (strand.length < 2) continue;

    const closed = result.strandClosed[i];
    const perPoint = result.strandRadii[i];
    const radii = strand.map((_, j) => {
      const r = perPoint?.[j];
      return r !== undefined && Number.isFinite(r) ? r : fallback;
    });

    const bucket = bucketFor(result.strandFamilies[i]);
    if (plies > 1) {
      for (const ply of plyCenterlines(strand, radii, closed, plies, twist)) {
        bucket.geometries.push(buildSweptTube(ply.points, ply.radii, closed, radial, sweep));
      }
    } else {
      bucket.geometries.push(buildSweptTube(strand, radii, closed, radial, sweep));
    }
  }

  for (const { material, geometries } of buckets.values()) {
    if (geometries.length === 0) continue;
    const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false);
    if (!merged) { // merge only fails on mismatched attributes; keep the parts
      for (const g of geometries) group.add(new THREE.Mesh(g, material));
      continue;
    }
    if (geometries.length > 1) for (const g of geometries) g.dispose();
    const mesh = new THREE.Mesh(merged, material);
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  return group;
}
