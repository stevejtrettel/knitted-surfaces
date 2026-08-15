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

/** Centre-crop the canvas to `width × height` and encode it as a JPEG. */
function thumbnailBlob(canvas: HTMLCanvasElement, width: number, height: number): Promise<Blob | null> {
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d');
  if (!ctx) return Promise.resolve(null);

  const scale = Math.max(width / canvas.width, height / canvas.height);
  const sw = width / scale;
  const sh = height / scale;
  ctx.drawImage(canvas, (canvas.width - sw) / 2, (canvas.height - sh) / 2, sw, sh, 0, 0, width, height);
  return new Promise((resolve) => out.toBlob(resolve, 'image/jpeg', 0.85));
}

/**
 * Add a "Save Thumbnail" button that writes `demos/<name>/thumb.jpg` — the image
 * the gallery shows on this demo's card.
 *
 * Dev only, and it posts to a dev-server endpoint rather than downloading,
 * because the point is to put the file exactly where the gallery looks for it
 * without a trip through the downloads folder. Composing the shot is a human
 * judgement — frame it, let the path tracer settle, then press the button.
 */
export function addThumbnailControl(app: App, tab: Tab): ButtonHandle | null {
  const dev = (import.meta as { env?: { DEV?: boolean } }).env?.DEV;
  const demo = /\/demos\/([^/]+)\//.exec(location.pathname)?.[1];
  if (!dev || !demo) return null;

  const button = tab.button('Save Thumbnail', () => {
    void (async () => {
      const blob = await thumbnailBlob(app.renderer.domElement, 640, 400);
      if (!blob) return;
      const res = await fetch(`/__save-thumb?demo=${encodeURIComponent(demo)}`, { method: 'POST', body: blob });
      button.setLabel(res.ok ? 'Thumbnail saved' : 'Save failed');
      setTimeout(() => button.setLabel('Save Thumbnail'), 1500);
    })();
  });
  return button;
}
