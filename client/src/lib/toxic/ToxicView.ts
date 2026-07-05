// ToxicView — a Three.js viewer that renders a single specimen model and lets
// you orbit / zoom around it. Reused by the /toxic page (full-size) and the
// homepage preview widget. Handles a dark studio-lit scene, auto-rotate, an
// optional slow colour drift, high-res PNG capture, and STL export for 3D
// printing (yes — you can print a virus).

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { buildSpecimenModel } from "./buildModels";
import { specimenById } from "./specimens";

export interface ToxicViewOptions {
  autoRotate?: boolean;
  enableControls?: boolean;
}

export class ToxicView {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private model: THREE.Group | null = null;
  private modelId = "";
  private dpr = Math.min(window.devicePixelRatio || 1, 2);

  private autoRotate: boolean;
  private colorDrift = false;
  private hueShift = 0;
  private baseColors: { mat: THREE.MeshStandardMaterial; h: number; s: number; l: number }[] = [];

  private raf = 0;
  private disposed = false;
  private ro: ResizeObserver;

  constructor(container: HTMLElement, opts: ToxicViewOptions = {}) {
    this.container = container;
    this.autoRotate = opts.autoRotate ?? false;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = this.renderer.domElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.style.touchAction = "none";
    container.appendChild(canvas);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07070b);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 100);
    this.camera.position.set(0, 0.4, 4.2);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.6;
    this.controls.maxDistance = 12;
    this.controls.enabled = opts.enableControls ?? true;
    this.controls.autoRotate = this.autoRotate;
    this.controls.autoRotateSpeed = 1.1;

    this.setupLights();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.loop();
  }

  private setupLights() {
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 4, 5);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.8);
    fill.position.set(-4, -1, 2);
    const rim = new THREE.DirectionalLight(0xff88bb, 0.7);
    rim.position.set(0, 3, -5);
    const amb = new THREE.AmbientLight(0x404a5c, 0.9);
    this.scene.add(key, fill, rim, amb);
  }

  setSpecimen(id: string) {
    if (id === this.modelId) return;
    this.modelId = id;
    if (this.model) {
      this.scene.remove(this.model);
      this.disposeModel(this.model);
    }
    const spec = specimenById(id);
    this.model = buildSpecimenModel(id, spec.color, spec.color2);
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
    this.camera.position.set(0, 0.4, 4.2);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  private resize() {
    const w = this.container.clientWidth || 600;
    const h = this.container.clientHeight || 600;
    if (w === 0 || h === 0) return; // hidden — keep last good size
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    if (this.disposed) return;
    // keep the drawing buffer in sync (ResizeObserver can miss display toggles)
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

  // Capture the current view as a PNG data URL at up to `longEdge` px.
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

  // Export the current specimen as binary STL for 3D printing.
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
