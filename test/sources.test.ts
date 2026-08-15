/**
 * Every geometry source, knitted with every pattern of its cell type.
 *
 * The demos are a matrix — dozens of surfaces × seven stitches — and a change in
 * the shared pipeline can break one corner of it (a non-orientable seam, a mesh
 * with degenerate polar faces, a tiling with the wrong valences) while the demo
 * you happen to have open still looks perfect. This walks the whole matrix
 * head-first at low resolution and demands only that nothing throws and every
 * point that comes out is a real number.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sources } from '../src/geometry/sources/index.ts';
import { patternsFor } from '../src/weave/patterns/index.ts';
import { defaultParams } from '../src/params.ts';
import { analyze } from '../src/weave/routing/analyze.ts';
import { generateStrands } from '../src/weave/generateStrands.ts';
import { smoothStrands } from '../src/weave/smooth.ts';
import { joinSelvedges } from '../src/weave/selvedge.ts';
import { applyWidth } from '../src/weave/radius.ts';
import { buildWidthField } from '../src/weave/width.ts';
import { buildBorder } from '../src/output/border.ts';
import { makeStrandTubes } from '../src/output/tubes.ts';
import { MeshBasicMaterial } from 'three';

/** Source resolution sliders, clamped small so the matrix runs quickly. */
function coarseOptions(params: ReturnType<typeof defaultParams>): Record<string, number> {
  const out = { ...params };
  for (const key of Object.keys(out)) out[key] = Math.min(out[key], key === 'n' ? 6 : 10);
  return out;
}

for (const source of sources) {
  for (const pattern of patternsFor(source.cellType)) {
    test(`${source.id} × ${pattern.id}`, () => {
      const geometry = source.build(coarseOptions(defaultParams(source.params)));
      assert.ok(geometry.mesh.faces.length > 0, 'source builds a mesh');

      const width = buildWidthField(geometry, { baseRadius: 0.02, conformal: 0.5 });
      const analysis = analyze(geometry, pattern, { width, clearance: 0.15 });

      let result = generateStrands(analysis, pattern, defaultParams(pattern.params));
      result = smoothStrands(result, 2);
      result = joinSelvedges(result, analysis, { bulge: 0.6 });
      result = applyWidth(result, width);

      for (let i = 0; i < result.strands.length; i++) {
        for (const p of result.strands[i]) {
          assert.ok(Number.isFinite(p.x + p.y + p.z), `finite point in strand ${i}`);
        }
        for (const r of result.strandRadii[i] ?? []) {
          assert.ok(Number.isFinite(r) && r > 0, `positive radius in strand ${i}`);
        }
      }

      // And it must survive being turned into geometry, plies and all.
      const group = makeStrandTubes(result, { materials: new MeshBasicMaterial(), tubeRadius: 0.02, plies: 3 });
      for (const child of group.children) {
        const position = (child as { geometry?: { getAttribute(name: string): { count: number } | undefined } })
          .geometry?.getAttribute('position');
        assert.ok(position && position.count > 0, 'tubes have vertices');
      }

      buildBorder(geometry, { inset: 0.05 }); // must not throw for any source
    });
  }
}
