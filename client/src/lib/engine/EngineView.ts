// EngineView — a Three.js viewer that renders a single Australian engine and
// lets you orbit / zoom around its exterior. Reused by the /ausengine page and
// the homepage preview widget. Dark studio-lit scene, auto-rotate, optional
// slow colour drift, high-res PNG capture, and STL export for 3D printing.
// (Structurally mirrors the /toxic ToxicView.)

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildEngineModel } from "./buildEngines";
import { engineById } from "./engines";

export interface EngineViewOptions {
  autoRotate?: boolean;
  enableControls?: boolean;
}

export class EngineView {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private model: THREE.Group | null = null;
  private modelId = "";
  private dpr = Math.min(window.devicePixelRatio || 1, 2.5);

  private autoRotate: boolean;
  private colorDrift = false;
  private hueShift = 0;
  private baseColors: { mat: THREE.MeshStandardMaterial; h: number; s: number; l: number }[] = [];

  private raf = 0;
  private disposed = false;
  private ro: ResizeObserver;

  constructor(container: HTMLElement, opts: EngineViewOptions = {}) {
    this.container = container;
    this.autoRotate = opts.autoRotate ?? false;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = this.renderer.domElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.style.touchAction = "none";
    container.appendChild(canvas);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07070b);
    // image-based lighting so the metal actually reflects and reads as metal
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 100);
    this.camera.position.set(0.6, 0.7, 4.4);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.8;
    this.controls.maxDistance = 12;
    this.controls.enabled = opts.enableControls ?? true;
    this.controls.autoRotate = this.autoRotate;
    this.controls.autoRotateSpeed = 1.1;

    this.setupLights();

    // soft ground shadow catcher
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.ShadowMaterial({ opacity: 0.32 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.45;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.loop();
  }

  private setupLights() {
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(4, 6, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 30;
    key.shadow.camera.left = -4;
    key.shadow.camera.right = 4;
    key.shadow.camera.top = 4;
    key.shadow.camera.bottom = -4;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 4;
    const fill = new THREE.DirectionalLight(0x88aaff, 0.55);
    fill.position.set(-4, -1, 2);
    const rim = new THREE.DirectionalLight(0xffd38a, 0.7);
    rim.position.set(-2, 3, -5);
    const amb = new THREE.AmbientLight(0x404a5c, 0.5);
    const hemi = new THREE.HemisphereLight(0x9fb4d8, 0x14161c, 0.4);
    this.scene.add(key, fill, rim, amb, hemi);
  }

  setEngine(id: string) {
    if (id === this.modelId) return;
    this.modelId = id;
    if (this.model) {
      this.scene.remove(this.model);
      this.disposeModel(this.model);
    }
    this.model = buildEngineModel(engineById(id));
    this.model.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    this.scene.add(this.model);
    this.cacheBaseColors();
    this.applyHue();
  }

  private cacheBaseColors() {
    this.baseColors = [];
    this.model?.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      const m = mesh.material as THREE.MeshStandardMaterial | undefined;
      if (m && m.isMeshStandardMaterial) {
        const hsl = { h: 0, s: 0, l: 0 };
        m.color.getHSL(hsl);
        this.baseColors.push({ mat: m, h: hsl.h, s: hsl.s, l: hsl.l });
      }
    });
  }

  private applyHue() {
    for (const b of this.baseColors) {
      b.mat.color.setHSL((b.h + this.hueShift) % 1, b.s, b.l);
    }
  }

  setAutoRotate(on: boolean) {
    this.autoRotate = on;
    this.controls.autoRotate = on;
  }

  setColorDrift(on: boolean) {
    this.colorDrift = on;
    if (!on) {
      this.hueShift = 0;
      this.applyHue();
    }
  }

  resetView() {
    this.camera.position.set(0.6, 0.7, 4.4);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  private resize() {
    const w = this.container.clientWidth || 600;
    const h = this.container.clientHeight || 600;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    if (this.disposed) return;
    const cw = this.container.clientWidth;
    if (cw > 0 && this.renderer.domElement.width !== cw) this.resize();
    if (this.colorDrift) {
      this.hueShift = (this.hueShift + 0.0015) % 1;
      this.applyHue();
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  };

  exportPNG(longEdge = 2560): string {
    const w = this.container.clientWidth || 600;
    const h = this.container.clientHeight || 600;
    const aspect = w / h;
    let tw: number;
    let th: number;
    if (aspect >= 1) {
      tw = longEdge;
      th = Math.round(longEdge / aspect);
    } else {
      th = longEdge;
      tw = Math.round(longEdge * aspect);
    }
    this.renderer.setSize(tw, th, false);
    this.camera.aspect = tw / th;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL("image/png");
    this.resize();
    return url;
  }

  exportSTL(): ArrayBuffer | null {
    if (!this.model) return null;
    const exporter = new STLExporter();
    const result = exporter.parse(this.model, { binary: true });
    return (result as unknown as DataView).buffer as ArrayBuffer;
  }

  private disposeModel(group: THREE.Group) {
    group.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const m = mesh.material;
      if (Array.isArray(m)) m.forEach(x => x.dispose());
      else if (m) (m as THREE.Material).dispose();
    });
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    if (this.model) this.disposeModel(this.model);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
