import { App, type AppOptions } from './App.ts';
import type { SceneResult } from './scenes/types.ts';

export function createScene<R extends SceneResult>(
  setup: (app: App) => R,
  appOptions?: AppOptions,
): { app: App } & R {
  const app = new App(appOptions);
  const result = setup(app);
  return { app, ...result };
}
