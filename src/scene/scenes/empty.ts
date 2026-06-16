import * as THREE from 'three';
import type { App } from '../App.ts';
import type { SceneResult } from './types.ts';

export interface EmptySceneOptions {
  background?: number;
}

export function emptyScene(opts: EmptySceneOptions = {}) {
  return (app: App): SceneResult => {
    app.scene.background = new THREE.Color(opts.background ?? 0xffffff);
    return {};
  };
}
