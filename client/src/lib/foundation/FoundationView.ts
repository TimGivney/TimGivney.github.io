// FoundationView — a Three.js viewer for the terrain-to-foundation result.
// Renders the ground surface (coloured by elevation), the automatically-placed
// piers (coloured by height, red if over the height limit), the bearer/girder
// beam grid, and the finished-floor deck. Studio-lit, orbitable, with high-res
// PNG capture. Structurally mirrors the site's EngineView / ToxicView.

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Dem, DesignResult } from "./foundation";

export interface FoundationViewOptions {
  autoRotate?: boolean;
  enableControls?: boolean;
}

export interface ViewToggles {
  terrain: boolean;
  piers: boolean;
  beams: boolean;
  deck: boolean;
  exaggeration: number;
}

const COBALT = new THREE.Color(0x1b3f6b);
const GOLD = new THREE.Color(0xc9a84c);
const LOW = new THREE.Color(0x14324f);
const HIGH = new THREE.Color(0xd8c98a);
const OVER = new THREE.Color(0xd6455a);

export class FoundationView {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private group: THREE.Group | null = null;
  private dpr = Math.min(window.devicePixelRatio || 1, 2.5);

  private autoRotate: boolean;
  private raf = 0;
  private disposed = false;
  private ro: ResizeObserver;

  private toggles: ViewToggles = {
    terrain: true,
    piers: true,
    beams: true,
    deck: true,
    exaggeration: 1,
  };

  // transform from site coords → scene units
  private s = 1;
  private cx = 0;
  private cy = 0;
  private baseZ = 0;
  private radius = 6;

  constructor(container: HTMLElement, opts: FoundationViewOptions = {}) {
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
    this.scene.background = new THREE.Color(0x05060a);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.5;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200);
    this.camera.position.set(6, 6, 8);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = true;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 40;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.enabled = opts.enableControls ?? true;
    this.controls.autoRotate = this.autoRotate;
    this.controls.autoRotateSpeed = 0.9;

    this.setupLights();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.loop();
  }

  private setupLights() {
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(6, 10, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 60;
    key.shadow.camera.left = -12;
    key.shadow.camera.right = 12;
    key.shadow.camera.top = 12;
    key.shadow.camera.bottom = -12;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 4;
    const fill = new THREE.DirectionalLight(0x88aaff, 0.5);
    fill.position.set(-6, -1, 3);
    const rim = new THREE.DirectionalLight(0xffd38a, 0.6);
    rim.position.set(-3, 4, -7);
    const amb = new THREE.AmbientLight(0x404a5c, 0.5);
    const hemi = new THREE.HemisphereLight(0x9fb4d8, 0x0d0f14, 0.45);
    this.scene.add(key, fill, rim, amb, hemi);
  }

  // ---- coordinate transform -------------------------------------------------

  private computeTransform(dem: Dem) {
    const extentX = dem.maxX - dem.minX;
    const extentY = dem.maxY - dem.minY;
    this.cx = (dem.minX + dem.maxX) / 2;
    this.cy = (dem.minY + dem.maxY) / 2;
    this.baseZ = dem.minZ;
    this.s = 6 / Math.max(extentX, extentY, 1e-3);
    this.radius = (Math.max(extentX, extentY) / 2) * this.s;
  }

  private tx(x: number) {
    return (x - this.cx) * this.s;
  }
  private tz(y: number) {
    return -(y - this.cy) * this.s;
  }
  private ty(z: number) {
    return (z - this.baseZ) * this.s * this.toggles.exaggeration;
  }

  // ---- build -----------------------------------------------------------------

  update(dem: Dem, result: DesignResult) {
    this.computeTransform(dem);
    if (this.group) {
      this.scene.remove(this.group);
      this.disposeGroup(this.group);
    }
    const g = new THREE.Group();
    g.add(this.buildTerrain(dem));
    g.add(this.buildPiers(result));
    g.add(this.buildBeams(result));
    g.add(this.buildDeck(result));
    this.group = g;
    this.scene.add(g);
    this.applyToggles();
  }

  private buildTerrain(dem: Dem): THREE.Object3D {
    const { cols, rows } = dem;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(cols * rows * 3);
    const col = new Float32Array(cols * rows * 3);
    const span = dem.maxZ - dem.minZ || 1;
    const c = new THREE.Color();
    for (let r = 0; r < rows; r++) {
      for (let cc = 0; cc < cols; cc++) {
        const i = r * cols + cc;
        const x = dem.minX + cc * dem.cellX;
        const y = dem.minY + r * dem.cellY;
        const z = dem.z[i];
        pos[i * 3] = this.tx(x);
        pos[i * 3 + 1] = this.ty(z);
        pos[i * 3 + 2] = this.tz(y);
        const t = (z - dem.minZ) / span;
        c.copy(LOW).lerp(HIGH, t);
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
      }
    }
    const idx: number[] = [];
    for (let r = 0; r < rows - 1; r++) {
      for (let cc = 0; cc < cols - 1; cc++) {
        const a = r * cols + cc;
        const b = r * cols + cc + 1;
        const d = (r + 1) * cols + cc;
        const e = (r + 1) * cols + cc + 1;
        // note winding for upward-facing normals in our mapping
        idx.push(a, d, b, b, d, e);
      }
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0.0,
      flatShading: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.name = "terrain";

    // subtle wireframe overlay to read the survey grid
    const wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0x2b3f57, transparent: true, opacity: 0.14 })
    );
    wire.name = "terrain-wire";

    const wrap = new THREE.Group();
    wrap.name = "terrain-group";
    wrap.add(mesh, wire);
    return wrap;
  }

  private buildPiers(result: DesignResult): THREE.Object3D {
    const grp = new THREE.Group();
    grp.name = "piers";
    const maxH = Math.max(0.001, ...result.piers.map(p => p.height));
    const c = new THREE.Color();
    for (const p of result.piers) {
      const hWorld = Math.max(0.02, (p.topZ - p.groundZ) * this.s * this.toggles.exaggeration);
      const rad = (p.diameter / 2000) * this.s;
      const geo = new THREE.CylinderGeometry(rad, rad * 1.08, hWorld, 20);
      if (p.aboveMax) c.copy(OVER);
      else c.copy(COBALT).lerp(GOLD, Math.min(1, p.height / maxH));
      const mat = new THREE.MeshStandardMaterial({
        color: c.clone(),
        roughness: 0.55,
        metalness: 0.35,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(this.tx(p.x), this.ty(p.groundZ) + hWorld / 2, this.tz(p.y));
      grp.add(mesh);

      // small footing pad
      const padGeo = new THREE.CylinderGeometry(rad * 1.6, rad * 1.8, hWorld * 0.05 + 0.01, 20);
      const padMat = new THREE.MeshStandardMaterial({ color: 0x9aa4b0, roughness: 0.9 });
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.set(this.tx(p.x), this.ty(p.groundZ) + 0.005, this.tz(p.y));
      pad.receiveShadow = true;
      grp.add(pad);
    }
    return grp;
  }

  private buildBeams(result: DesignResult): THREE.Object3D {
    const grp = new THREE.Group();
    grp.name = "beams";
    const yTop = this.ty(result.datumZ);
    const sec = 0.06 * this.s * 2; // beam cross-section in world units
    const mat = new THREE.MeshStandardMaterial({ color: 0xb08d3c, roughness: 0.5, metalness: 0.4 });

    const byGrid = new Map<string, (typeof result.piers)[number]>();
    for (const p of result.piers) byGrid.set(`${p.ix},${p.iy}`, p);

    const beam = (
      x1: number,
      y1: number,
      x2: number,
      y2: number
    ) => {
      const ax = this.tx(x1);
      const az = this.tz(y1);
      const bx = this.tx(x2);
      const bz = this.tz(y2);
      const len = Math.hypot(bx - ax, bz - az);
      const geo = new THREE.BoxGeometry(len, sec, sec);
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.position.set((ax + bx) / 2, yTop - sec / 2, (az + bz) / 2);
      m.rotation.y = -Math.atan2(bz - az, bx - ax);
      grp.add(m);
    };

    // bearers along rows
    for (let iy = 0; iy < result.ny; iy++) {
      for (let ix = 0; ix < result.nx - 1; ix++) {
        const a = byGrid.get(`${ix},${iy}`);
        const b = byGrid.get(`${ix + 1},${iy}`);
        if (a && b) beam(a.x, a.y, b.x, b.y);
      }
    }
    // girders along columns
    for (let ix = 0; ix < result.nx; ix++) {
      for (let iy = 0; iy < result.ny - 1; iy++) {
        const a = byGrid.get(`${ix},${iy}`);
        const b = byGrid.get(`${ix},${iy + 1}`);
        if (a && b) beam(a.x, a.y, b.x, b.y);
      }
    }
    return grp;
  }

  private buildDeck(result: DesignResult): THREE.Object3D {
    const fp = result.footprint;
    const w = (fp.x1 - fp.x0) * this.s;
    const l = (fp.y1 - fp.y0) * this.s;
    const geo = new THREE.BoxGeometry(w, 0.02 * this.s * 2 + 0.01, l);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2a6df4,
      transparent: true,
      opacity: 0.16,
      roughness: 0.6,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = "deck";
    const midX = (fp.x0 + fp.x1) / 2;
    const midY = (fp.y0 + fp.y1) / 2;
    mesh.position.set(this.tx(midX), this.ty(result.datumZ) + 0.02, this.tz(midY));

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0x69a0ff, transparent: true, opacity: 0.6 })
    );
    edges.position.copy(mesh.position);

    const wrap = new THREE.Group();
    wrap.name = "deck-group";
    wrap.add(mesh, edges);
    return wrap;
  }

  // ---- toggles ---------------------------------------------------------------

  setToggles(t: Partial<ViewToggles>) {
    const exaggerationChanged =
      t.exaggeration !== undefined && t.exaggeration !== this.toggles.exaggeration;
    this.toggles = { ...this.toggles, ...t };
    this.applyToggles();
    return exaggerationChanged;
  }

  private applyToggles() {
    if (!this.group) return;
    const set = (name: string, on: boolean) => {
      const o = this.group?.getObjectByName(name);
      if (o) o.visible = on;
    };
    set("terrain-group", this.toggles.terrain);
    set("piers", this.toggles.piers);
    set("beams", this.toggles.beams);
    set("deck-group", this.toggles.deck);
  }

  frame() {
    const dist = this.radius * 3.4 + 4;
    this.camera.position.set(dist * 0.72, dist * 0.62, dist * 0.9);
    this.controls.target.set(0, this.radius * 0.25, 0);
    this.controls.update();
  }

  resetView() {
    this.frame();
  }

  setAutoRotate(on: boolean) {
    this.autoRotate = on;
    this.controls.autoRotate = on;
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
    if (cw > 0 && this.renderer.domElement.width !== cw * this.dpr) this.resize();
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

  private disposeGroup(group: THREE.Group) {
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
    if (this.group) this.disposeGroup(this.group);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
