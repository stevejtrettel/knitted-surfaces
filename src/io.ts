/**
 * Browser IO utilities — file picking and downloads.
 *
 * Kept separate from the mesh/output layers so those remain
 * usable in non-browser contexts (Node, workers, etc.).
 */

import type { ParsedMesh } from './mesh/types.ts';
import { parseOBJ } from './mesh/parseOBJ.ts';

/**
 * Open a file picker and load an OBJ file.
 */
export function loadOBJFile(): Promise<ParsedMesh | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.obj';
    input.style.display = 'none';

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); input.remove(); return; }
      try {
        const text = await file.text();
        resolve(parseOBJ(text));
      } catch (error) {
        console.error('Failed to load OBJ file:', error);
        resolve(null);
      }
      input.remove();
    });

    input.addEventListener('cancel', () => { resolve(null); input.remove(); });

    document.body.appendChild(input);
    input.click();
  });
}

/**
 * Trigger a browser download of a Blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Trigger a browser download of a text file.
 */
export function downloadOBJ(content: string, filename = 'weave.obj'): void {
  downloadBlob(new Blob([content], { type: 'text/plain' }), filename);
}
