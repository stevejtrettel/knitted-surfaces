import * as THREE from 'three';
import { PhysicalSpotLight } from 'three-gpu-pathtracer';

export interface StudioLights {
  key: PhysicalSpotLight;
  fill: PhysicalSpotLight;
  rim: PhysicalSpotLight;
  preview: THREE.DirectionalLight;
  ambient: THREE.AmbientLight;
}

export function addStudioLighting(scene: THREE.Scene): StudioLights {
  function createSpot(color: number, intensity: number, pos: THREE.Vector3): PhysicalSpotLight {
    const light = new PhysicalSpotLight(color);
    light.position.copy(pos);
    light.angle = Math.PI / 4;
    light.decay = 0;
    light.penumbra = 0.8;
    light.intensity = intensity;
    light.radius = 0.25;
    light.castShadow = true;
    light.target.position.set(0, 0, 0);
    return light;
  }

  const key = createSpot(0xffeedd, 5, new THREE.Vector3(-4, 6, 4));
  scene.add(key);
  scene.add(key.target);

  const fill = createSpot(0xddeeff, 2.5, new THREE.Vector3(5, 4, 2));
  scene.add(fill);
  scene.add(fill.target);

  const rim = createSpot(0xffffff, 3, new THREE.Vector3(0, 5, -4));
  scene.add(rim);
  scene.add(rim.target);

  const preview = new THREE.DirectionalLight(0xffffff, 0.8);
  preview.position.set(3, 6, 4);
  scene.add(preview);

  const ambient = new THREE.AmbientLight(0xffffff, 0.15);
  scene.add(ambient);

  return { key, fill, rim, preview, ambient };
}
