/**
 * Generic "pick one of N things, then tweak its params" control.
 *
 * Both the geometry-source picker and the pattern picker are this: a dropdown
 * over items that each carry `{ id, label, params }`, plus a rebuildable block
 * of sliders for the selected item's parameters. The selected item and its
 * live options object are exposed for the caller to read on each change.
 */

import { Tab } from './panel.ts';
import { type ParamSpec, defaultParams } from '../params.ts';

export interface PickableItem {
  id: string;
  label: string;
  params?: ParamSpec[];
}

export interface ParamPickerHandle<T extends PickableItem> {
  readonly item: T;
  readonly options: Record<string, number>;
}

export function buildParamPicker<T extends PickableItem>(
  tab: Tab,
  config: { label: string; items: T[]; value?: string; onChange: () => void },
): ParamPickerHandle<T> {
  const pick = (id: string) => config.items.find((it) => it.id === id) ?? config.items[0];

  let current = pick(config.value ?? config.items[0].id);
  let options = defaultParams(current.params);

  const paramBox = document.createElement('div');
  paramBox.style.cssText = 'display:flex;flex-direction:column;gap:9px;';

  function buildParams(): void {
    paramBox.innerHTML = '';
    const paramTab = new Tab(paramBox);
    for (const p of current.params ?? []) {
      paramTab.slider(
        p.label,
        { min: p.min, max: p.max, step: p.step, value: options[p.key] },
        (v) => { options[p.key] = v; config.onChange(); },
      );
    }
  }

  tab.dropdown(
    config.label,
    { options: config.items.map((it) => ({ label: it.label, value: it.id })), value: current.id },
    (id) => {
      current = pick(id);
      options = defaultParams(current.params);
      buildParams();
      config.onChange();
    },
  );

  tab.page.appendChild(paramBox);
  buildParams();

  return {
    get item() { return current; },
    get options() { return options; },
  };
}
