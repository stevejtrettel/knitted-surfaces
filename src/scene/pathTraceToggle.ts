import type { App } from './App.ts';
import type { StudioLights } from './presets/lighting.ts';
import { Toolbar, Button } from './ui.ts';
import type { Tab, ToggleHandle } from './panel.ts';

/**
 * Apply the light changes that accompany entering/leaving path-trace mode.
 * Studio scenes use bright preview/ambient lights for the raster preview;
 * the path tracer reads the spot/area lights directly, so we dim the
 * preview helpers while it runs and restore them afterwards.
 */
function setPathTraceLights(lights: StudioLights | undefined, active: boolean): void {
  if (!lights) return;
  lights.preview.intensity = active ? 0 : 1.5;
  lights.ambient.intensity = active ? 0 : 0.3;
}

/** Start/stop the GPU path tracer, dimming preview lights while it runs. */
function togglePathTrace(app: App, lights: StudioLights | undefined, active: boolean): void {
  if (active) {
    setPathTraceLights(lights, true);
    app.notifyMaterialsChanged();
    app.enablePathTracing();
  } else {
    app.disablePathTracing();
    setPathTraceLights(lights, false);
  }
}

/**
 * Add a path-trace Start/Stop button to a classic Toolbar.
 * Kept for the minimal demos that use the top-left toolbar.
 */
export function addPathTraceToggle(
  app: App,
  toolbar: Toolbar,
  lights: StudioLights,
): Button {
  let active = false;
  const button = new Button('Start Path Trace', () => {
    active = !active;
    togglePathTrace(app, lights, active);
    button.setLabel(active ? 'Stop Path Trace' : 'Start Path Trace');
    button.domElement.style.backgroundColor = active ? '#c94444' : '#44aa44';
  });
  button.domElement.style.cssText = 'background:#44aa44;color:#fff;font-weight:bold';
  toolbar.add(button);
  return button;
}

/**
 * Add a path-trace toggle to a ControlPanel tab (e.g. the "Render" tab).
 * `lights` is optional — demos without studio lighting still get the toggle.
 */
export function addPathTraceControl(
  app: App,
  tab: Tab,
  options: { lights?: StudioLights; label?: string } = {},
): ToggleHandle {
  const label = options.label ?? 'Path Trace';
  return tab.toggle(label, false, (active) => {
    togglePathTrace(app, options.lights, active);
  });
}
