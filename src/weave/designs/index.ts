/**
 * Design registry.
 *
 * Collects the available strand designs and provides `buildDesignControls`,
 * which wires a knit-type picker plus auto-generated parameter sliders into
 * a ControlPanel tab. Slider ranges come from each design's own `params`
 * metadata (see `StrandDesign` in ../types.ts), so adding a design or a
 * parameter needs no UI changes here.
 */

import type { StrandDesign, ParamSpec } from '../types.ts';
import { Tab } from '../../scene/panel.ts';
import { weaveDesign } from './weaveDesign.ts';
import { loopDesign } from './loopDesign.ts';
import { omegaDesign } from './omegaDesign.ts';

export { weaveDesign, loopDesign, omegaDesign };

/** All designs offered by the pickers, in display order. */
export const designs: StrandDesign<any>[] = [loopDesign, weaveDesign, omegaDesign];

/** Stable id for a design (falls back to its `name`). */
export function designId(design: StrandDesign<any>): string {
  return design.id ?? design.name;
}

/** Build an options object from a design's parameter defaults. */
export function defaultOptions(design: StrandDesign<any>): Record<string, number> {
  const opts: Record<string, number> = {};
  for (const p of design.params ?? []) opts[p.key] = p.default;
  return opts;
}

export interface DesignControls {
  /** Currently selected design. */
  readonly design: StrandDesign<any>;
  /** Live options object (mutated as sliders move). */
  readonly options: Record<string, number>;
}

/**
 * Add a knit-type dropdown and its parameter sliders to a tab.
 *
 * The sliders rebuild whenever the design changes. `onChange` fires on any
 * design switch or parameter move; read `controls.design` / `controls.options`
 * to regenerate strands.
 */
export function buildDesignControls(
  tab: Tab,
  config: { value?: string; label?: string; onChange: () => void },
): DesignControls {
  const pick = (id: string) => designs.find((d) => designId(d) === id) ?? designs[0];

  let current = pick(config.value ?? designId(designs[0]));
  let options = defaultOptions(current);

  // Container for the (rebuildable) parameter sliders.
  const paramBox = document.createElement('div');
  paramBox.style.cssText = 'display:flex;flex-direction:column;gap:9px;';

  function buildParams(): void {
    paramBox.innerHTML = '';
    const paramTab = new Tab(paramBox);
    for (const p of (current.params ?? []) as ParamSpec[]) {
      paramTab.slider(
        p.label,
        { min: p.min, max: p.max, step: p.step, value: options[p.key] },
        (v) => { options[p.key] = v; config.onChange(); },
      );
    }
  }

  tab.dropdown(
    config.label ?? 'Knit Type',
    {
      options: designs.map((d) => ({ label: d.label ?? d.name, value: designId(d) })),
      value: designId(current),
    },
    (id) => {
      current = pick(id);
      options = defaultOptions(current);
      buildParams();
      config.onChange();
    },
  );

  tab.page.appendChild(paramBox);
  buildParams();

  return {
    get design() { return current; },
    get options() { return options; },
  };
}
