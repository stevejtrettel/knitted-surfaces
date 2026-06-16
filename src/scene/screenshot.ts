import type { App } from './App.ts';
import type { Tab, ButtonHandle } from './panel.ts';
import { downloadBlob } from '../io.ts';

/**
 * Save the current frame (raster or path-traced) as a PNG download.
 * Requires the renderer to preserve its drawing buffer — see
 * `AppOptions.preserveDrawingBuffer` (on by default).
 */
export function captureScreenshot(app: App, filename = 'knit.png'): void {
  app.renderer.domElement.toBlob((blob) => {
    if (blob) downloadBlob(blob, filename);
  }, 'image/png');
}

/** Add a "Screenshot" button to a ControlPanel tab. */
export function addScreenshotControl(
  app: App,
  tab: Tab,
  options: { label?: string; filename?: string } = {},
): ButtonHandle {
  return tab.button(options.label ?? 'Screenshot', () => captureScreenshot(app, options.filename));
}
