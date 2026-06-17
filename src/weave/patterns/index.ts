/**
 * Pattern registry, grouped by cell type.
 *
 * Quad and triangle patterns are separate sets; `patternsFor(cellType)` returns
 * the matching one and `buildPatternControls` renders its picker + parameter
 * sliders into a panel tab (rebuilds when the cell type changes).
 */

import type { Pattern } from '../types.ts';
import type { CellType } from '../../geometry/types.ts';
import { Tab } from '../../scene/panel.ts';
import { buildParamPicker } from '../../scene/paramPicker.ts';
import { weavePattern } from './weave.ts';
import { loopPattern } from './loop.ts';
import { omegaPattern } from './omega.ts';
import { triaxialWeavePattern } from './triaxialWeave.ts';
import { chainMailPattern } from './chainMail.ts';
import { centralLinkPattern, triquetraPattern } from './cornerWeaves.ts';

export { weavePattern, loopPattern, omegaPattern, triaxialWeavePattern, chainMailPattern, centralLinkPattern, triquetraPattern };

export const quadPatterns: Pattern<any>[] = [loopPattern, weavePattern, omegaPattern];
export const triPatterns: Pattern<any>[] = [triaxialWeavePattern, chainMailPattern, centralLinkPattern, triquetraPattern];

export function patternsFor(cellType: CellType): Pattern<any>[] {
  return cellType === 'tri' ? triPatterns : quadPatterns;
}

export interface PatternControls {
  readonly pattern: Pattern<any>;
  readonly options: Record<string, number>;
}

/**
 * Add a knit-type dropdown + its parameter sliders to a tab, restricted to one
 * cell type. Read `controls.pattern` / `controls.options` to regenerate strands.
 */
export function buildPatternControls(
  tab: Tab,
  cellType: CellType,
  config: { value?: string; label?: string; onChange: () => void },
): PatternControls {
  const items = patternsFor(cellType);
  const picker = buildParamPicker(tab, {
    label: config.label ?? 'Knit Type',
    items,
    value: config.value,
    onChange: config.onChange,
  });
  return {
    get pattern() { return picker.item; },
    get options() { return picker.options; },
  };
}
