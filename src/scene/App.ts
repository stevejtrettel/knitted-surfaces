import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { WebGLPathTracer } from 'three-gpu-pathtracer';

export interface AppOptions {
  container?: HTMLElement;
  antialias?: boolean;
  /** Keep the drawing buffer so screenshots can read the canvas. Default true. */
  preserveDrawingBuffer?: boolean;
  fov?: number;
  near?: number;
  far?: number;
  pathTracerDefaults?: { bounces?: number; samples?: number };
}

export class App {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;

  private pathTracer?: WebGLPathTracer;
  private ptMode = false;
  private ptDefaults: { bounces: number; samples: number };
  private materialsNeedUpdate = false;
  private lastEnvironment?: THREE.Texture | null;

  private callbacks: ((time: number, delta: number) => void)[] = [];
  private lastTime = 0;

  constructor(options: AppOptions = {}) {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      options.fov ?? 50,
      window.innerWidth / window.innerHeight,
      options.near ?? 0.1,
      options.far ?? 1000,
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: options.antialias ?? true,
      preserveDrawingBuffer: options.preserveDrawingBuffer ?? true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    (options.container ?? document.body).appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    this.ptDefaults = {
      bounces: options.pathTracerDefaults?.bounces ?? 10,
      samples: options.pathTracerDefaults?.samples ?? 1,
    };

    window.addEventListener('resize', this.onResize);
  }

  enablePathTracing(): void {
    if (!this.pathTracer) {
      this.pathTracer = new WebGLPathTracer(this.renderer);
      this.pathTracer.bounces = this.ptDefaults.bounces;
      this.pathTracer.tiles.set(2, 2);
    }

    this.ptMode = true;
    this.materialsNeedUpdate = false;
    this.pathTracer.setScene(this.scene, this.camera);
    this.pathTracer.updateMaterials();
    this.pathTracer.updateEnvironment();
    this.lastEnvironment = this.scene.environment;
  }

  disablePathTracing(): void {
    this.ptMode = false;
  }

  notifyMaterialsChanged(): void {
    this.materialsNeedUpdate = true;
  }

  addAnimateCallback(fn: (time: number, delta: number) => void): void {
    this.callbacks.push(fn);
  }

  start(): void {
    requestAnimationFrame(this.animate);
  }

  private animate = (timestamp: number) => {
    requestAnimationFrame(this.animate);
    const time = timestamp / 1000;
    const delta = time - this.lastTime;
    this.lastTime = time;

    this.controls.update();
    this.callbacks.forEach(fn => fn(time, delta));

    if (this.ptMode && this.pathTracer) {
      if (this.lastEnvironment !== this.scene.environment) {
        this.pathTracer.updateEnvironment();
        this.lastEnvironment = this.scene.environment;
        this.pathTracer.reset();
      }
      if (this.materialsNeedUpdate) {
        this.pathTracer.updateMaterials();
        this.materialsNeedUpdate = false;
        this.pathTracer.reset();
      }
      this.pathTracer.renderSample();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  };

  private onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };
}
