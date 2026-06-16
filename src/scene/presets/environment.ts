import * as THREE from 'three';
import { GradientEquirectTexture } from 'three-gpu-pathtracer';

export interface EnvironmentOptions {
  topColor?: number;
  bottomColor?: number;
}

export function addGradientEnvironment(
  scene: THREE.Scene,
  opts: EnvironmentOptions = {},
): void {
  const tex = new GradientEquirectTexture();
  tex.topColor.set(opts.topColor ?? 0xddeeff);
  tex.bottomColor.set(opts.bottomColor ?? 0xffffff);
  tex.update();
  scene.environment = tex;
  scene.background = tex;
}
