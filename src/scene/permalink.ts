/**
 * Put the control panel's state in the URL.
 *
 * These demos are instruments: a look worth keeping is a particular point in a
 * fifteen-slider space, found by fiddling, and until now it lived only for as
 * long as the tab did. Reloading, sending someone the render, coming back to
 * finish it tomorrow — all of it started from the defaults again. Every control
 * value now lives in `location.hash`, so the address bar IS the preset: copy the
 * URL, bookmark it, paste it next to a screenshot.
 *
 * It reads the panel's DOM rather than a registry of controls, which sounds
 * indirect but is the point: controls created dynamically — a pattern's own
 * parameter sliders, rebuilt whenever the knit type changes — are included
 * automatically, with no bookkeeping for a demo to forget. Each control is keyed
 * by tab and label, so keys stay readable and survive controls being added
 * around them.
 *
 * Restoring dispatches the same events a user's interaction would, so nothing
 * needs a separate "apply" path. Dropdowns go first and in isolation, because
 * choosing a source or a knit type REPLACES the sliders below it — the values
 * have to be applied to the controls that exist afterwards.
 */

import type { ControlPanel } from './panel.ts';

type Kind = 'select' | 'range' | 'color' | 'toggle';
interface Control { key: string; kind: Kind; el: HTMLElement; }

/** Every value-bearing control in the panel, in document order. */
function scan(panel: ControlPanel): Control[] {
  const controls: Control[] = [];
  const seen = new Map<string, number>();

  for (const page of panel.domElement.querySelectorAll<HTMLElement>('.cp-page')) {
    const tab = page.dataset.tab ?? 'tab';
    for (const row of page.querySelectorAll<HTMLElement>('.cp-row, .cp-toggle')) {
      let kind: Kind | null = null;
      let el: HTMLElement | null = null;
      const select = row.querySelector('select');
      const range = row.querySelector<HTMLInputElement>('input[type=range]');
      const color = row.querySelector<HTMLInputElement>('input[type=color]');
      if (select) { kind = 'select'; el = select; }
      else if (range) { kind = 'range'; el = range; }
      else if (color) { kind = 'color'; el = color; }
      else if (row.classList.contains('cp-toggle')) { kind = 'toggle'; el = row; }
      if (!kind || !el) continue;

      const label = (row.querySelector('label') ?? row.querySelector('span'))?.textContent ?? '';
      const base = `${tab}.${label}`.replace(/\s+/g, '');
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      controls.push({ key: n === 1 ? base : `${base}${n}`, kind, el });
    }
  }
  return controls;
}

function readValue(c: Control): string {
  switch (c.kind) {
    case 'select': return (c.el as HTMLSelectElement).value;
    case 'range': return (c.el as HTMLInputElement).value;
    case 'color': return (c.el as HTMLInputElement).value.replace('#', '');
    case 'toggle': return c.el.classList.contains('on') ? '1' : '0';
  }
}

function writeValue(c: Control, value: string): void {
  if (c.kind === 'toggle') {
    const want = value === '1';
    if (c.el.classList.contains('on') !== want) (c.el as HTMLElement).click();
    return;
  }
  const input = c.el as HTMLInputElement | HTMLSelectElement;
  const next = c.kind === 'color' ? `#${value}` : value;
  if (input.value === next) return;
  input.value = next;
  input.dispatchEvent(new Event(c.kind === 'select' ? 'change' : 'input', { bubbles: true }));
}

function encode(controls: Control[]): string {
  return controls
    .map((c) => `${encodeURIComponent(c.key)}=${encodeURIComponent(readValue(c))}`)
    .join('&');
}

function decode(hash: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of hash.replace(/^#/, '').split('&')) {
    if (!part) continue;
    const i = part.indexOf('=');
    if (i < 0) continue;
    out.set(decodeURIComponent(part.slice(0, i)), decodeURIComponent(part.slice(i + 1)));
  }
  return out;
}

/**
 * Restore the panel from `location.hash` (if it carries anything), then keep the
 * hash in step with every later change.
 */
export function attachPermalink(panel: ControlPanel): void {
  const saved = decode(location.hash);
  let restoring = saved.size > 0;

  if (restoring) {
    // Dropdowns first: they rebuild the controls beneath them, so the sliders we
    // want to set may not exist yet. Re-scan after each one.
    for (const c of scan(panel)) {
      if (c.kind !== 'select') continue;
      const v = saved.get(c.key);
      if (v !== undefined) writeValue(c, v);
    }
    for (const c of scan(panel)) {
      if (c.kind === 'select') continue;
      const v = saved.get(c.key);
      if (v !== undefined) writeValue(c, v);
    }
    restoring = false;
  }

  let pending = 0;
  const sync = () => {
    if (restoring) return;
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => {
      history.replaceState(null, '', `${location.pathname}${location.search}#${encode(scan(panel))}`);
    });
  };

  // Only from here on: an untouched demo keeps a clean URL, and the hash appears
  // the moment there is something worth linking to.
  for (const type of ['input', 'change', 'click']) {
    panel.domElement.addEventListener(type, sync, true);
  }
}
