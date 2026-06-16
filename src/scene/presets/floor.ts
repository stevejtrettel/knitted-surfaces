import * as THREE from 'three';

export interface FloorOptions {
  y?: number;
  size?: number;
  color?: number;
}

export function addFloor(scene: THREE.Scene, opts: FloorOptions = {}): THREE.Mesh {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(opts.size ?? 30, opts.size ?? 30),
    new THREE.MeshPhysicalMaterial({
      color: opts.color ?? 0xffffff,
      roughness: 0.3,
      metalness: 0.0,
      clearcoat: 0.1,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = opts.y ?? -1.5;
  scene.add(floor);
  return floor;
}
