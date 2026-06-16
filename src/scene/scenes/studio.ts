import type { App } from '../App.ts';
import type { SceneResult } from './types.ts';
import type { StudioLights } from '../presets/lighting.ts';
import { addGradientEnvironment, type EnvironmentOptions } from '../presets/environment.ts';
import { addFloor, type FloorOptions } from '../presets/floor.ts';
import { addStudioLighting } from '../presets/lighting.ts';

export interface StudioSceneOptions {
  environment?: EnvironmentOptions;
  floor?: FloorOptions;
}

export function studioScene(opts: StudioSceneOptions = {}) {
  return (app: App): SceneResult & { lights: StudioLights } => {
    addGradientEnvironment(app.scene, opts.environment);
    addFloor(app.scene, opts.floor);
    const lights = addStudioLighting(app.scene);
    return { lights };
  };
}
