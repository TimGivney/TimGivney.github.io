import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  applyMove,
  cloneCube,
  createCube,
  isSolved,
  type Axis,
  type CubeState,
  type Move,
  type Sticker,
} from "./engine";

const FACE_COLOR: Record<number, number> = {
  0: 0xf7f7f7, // U white
  1: 0xfdd835, // D yellow
  2: 0x00a64f, // F green
  3: 0x1466b8, // B blue
  4: 0xc4222f, // R red
  5: 0xf07d1a, // L orange
};
const PLASTIC = 0x0b0d10;

const TWEEN = (t: number) => 1 - Math.pow(1 - t, 3); // easeOutCubic

interface Cubie {
  group: THREE.Group;
  tiles: THREE.Mesh[]; // index by face id 0..5
  cx: number;
  cy: number;
  cz: number;
}

export interface CubeViewOptions {
  onMove?: (move: Move) => void; // fired when a user drag completes a turn
  onSolvedChange?: (solved: boolean) => void;
  distanceScale?: number; // <1 zooms the camera in so the cube fills more of the view
}

export class CubeView {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private root: THREE.Group;
  private pivot: THREE.Group;
  private cubies: Cubie[] = [];
  private raycaster = new THREE.Raycaster();
  private spacing: number;
  private n: number;
  state: CubeState;

  private anim: {
    move: Move;
    elapsed: number;
    duration: number;
    target: number;
    cubies: Cubie[];
    resolve: () => void;
  } | null = null;

  private opts: CubeViewOptions;
  private disposed = false;
  private dragging: null | {
    cubie: Cubie;
    normalAxis: Axis;
    hitRel: THREE.Vector3;
    startX: number;
    startY: number;
    committed: boolean;
  } = null;
  private lastSolved = true;

  constructor(container: HTMLElement, n: number, opts: CubeViewOptions = {}) {
    this.container = container;
    this.opts = opts;
    this.n = n;
    this.spacing = 1.0;
    this.state = createCube(n);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = false;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = "none";
    this.renderer.domElement.style.display = "block";

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    const dist = (n * 2.0 + 3) * (opts.distanceScale ?? 1);
    this.camera.position.set(dist * 0.85, dist * 0.7, dist * 0.95);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.9;
    this.controls.minDistance = n * 1.2;
    this.controls.maxDistance = n * 5;
    this.controls.target.set(0, 0, 0);

    // Lighting
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(6, 10, 8);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xbcd0ff, 0.45);
    fill.position.set(-8, -4, -6);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffe9c2, 0.4);
    rim.position.set(-6, 6, -8);
    this.scene.add(rim);

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.pivot = new THREE.Group();
    this.root.add(this.pivot);

    this.buildCubies();
    this.syncFromState();

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    const el = this.renderer.domElement;
    // Capture phase so we can decide orbit-vs-turn before OrbitControls reacts.
    el.addEventListener("pointerdown", this.onPointerDown, true);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    this.clock = new THREE.Clock();
    this.renderLoop();
  }

  private clock: THREE.Clock;
  private resizeObserver: ResizeObserver;

  private offset(i: number): number {
    return (i - (this.n - 1) / 2) * this.spacing;
  }

  private buildCubies() {
    const n = this.n;
    const size = 0.94;
    const tileSize = 0.84;
    const tileGeo = new THREE.BoxGeometry(tileSize, tileSize, 0.06);
    const bodyGeo = new THREE.BoxGeometry(size, size, size);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: PLASTIC,
      roughness: 0.55,
      metalness: 0.1,
    });

    // Normal direction per face id and the rotation to orient a +Z plane to it.
    const faceDef: { id: number; dir: THREE.Vector3; rot: THREE.Euler }[] = [
      {
        id: 4,
        dir: new THREE.Vector3(1, 0, 0),
        rot: new THREE.Euler(0, Math.PI / 2, 0),
      }, // R +X
      {
        id: 5,
        dir: new THREE.Vector3(-1, 0, 0),
        rot: new THREE.Euler(0, -Math.PI / 2, 0),
      }, // L -X
      {
        id: 0,
        dir: new THREE.Vector3(0, 1, 0),
        rot: new THREE.Euler(-Math.PI / 2, 0, 0),
      }, // U +Y
      {
        id: 1,
        dir: new THREE.Vector3(0, -1, 0),
        rot: new THREE.Euler(Math.PI / 2, 0, 0),
      }, // D -Y
      { id: 2, dir: new THREE.Vector3(0, 0, 1), rot: new THREE.Euler(0, 0, 0) }, // F +Z
      {
        id: 3,
        dir: new THREE.Vector3(0, 0, -1),
        rot: new THREE.Euler(0, Math.PI, 0),
      }, // B -Z
    ];

    const surfaceCount = (x: number, y: number, z: number) =>
      x === 0 ||
      x === n - 1 ||
      y === 0 ||
      y === n - 1 ||
      z === 0 ||
      z === n - 1;

    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        for (let z = 0; z < n; z++) {
          if (!surfaceCount(x, y, z)) continue;
          const group = new THREE.Group();
          const body = new THREE.Mesh(bodyGeo, bodyMat);
          group.add(body);
          const tiles: THREE.Mesh[] = new Array(6);
          for (const f of faceDef) {
            const mat = new THREE.MeshStandardMaterial({
              color: FACE_COLOR[f.id],
              roughness: 0.35,
              metalness: 0.05,
            });
            const tile = new THREE.Mesh(tileGeo, mat);
            tile.position.copy(f.dir).multiplyScalar(size / 2 + 0.01);
            tile.rotation.copy(f.rot);
            tile.visible = false;
            tiles[f.id] = tile;
            group.add(tile);
          }
          const cubie: Cubie = { group, tiles, cx: x, cy: y, cz: z };
          this.cubies.push(cubie);
          this.root.add(group);
        }
      }
    }
  }

  /** Re-position every cubie and recolour every tile from the sticker model. */
  syncFromState() {
    const byCoord = new Map<string, Sticker[]>();
    for (const s of this.state.stickers) {
      const key = `${s.x},${s.y},${s.z}`;
      const arr = byCoord.get(key);
      if (arr) arr.push(s);
      else byCoord.set(key, [s]);
    }

    const coords = Array.from(byCoord.keys());
    for (let i = 0; i < this.cubies.length; i++) {
      const cubie = this.cubies[i];
      const key = coords[i];
      const stickers = byCoord.get(key)!;
      const [x, y, z] = key.split(",").map(Number);
      cubie.cx = x;
      cubie.cy = y;
      cubie.cz = z;
      cubie.group.position.set(this.offset(x), this.offset(y), this.offset(z));
      cubie.group.rotation.set(0, 0, 0);
      for (let f = 0; f < 6; f++) cubie.tiles[f].visible = false;
      for (const s of stickers) {
        const id = this.faceIdFromNormal(s.nx, s.ny, s.nz);
        const tile = cubie.tiles[id];
        tile.visible = true;
        (tile.material as THREE.MeshStandardMaterial).color.setHex(
          FACE_COLOR[s.color]
        );
      }
    }

    const solved = isSolved(this.state);
    if (solved !== this.lastSolved) {
      this.lastSolved = solved;
      this.opts.onSolvedChange?.(solved);
    }
  }

  private faceIdFromNormal(nx: number, ny: number, nz: number): number {
    if (nx === 1) return 4;
    if (nx === -1) return 5;
    if (ny === 1) return 0;
    if (ny === -1) return 1;
    if (nz === 1) return 2;
    return 3;
  }

  private coordOnAxis(c: Cubie, axis: Axis): number {
    return axis === 0 ? c.cx : axis === 1 ? c.cy : c.cz;
  }

  /** Animate one quarter turn. Resolves when finished. */
  animateMove(move: Move, duration = 280): Promise<void> {
    if (this.anim) return Promise.resolve();
    const layerCubies = this.cubies.filter(
      c => this.coordOnAxis(c, move.axis) === move.layer
    );
    for (const c of layerCubies) this.pivot.add(c.group); // reparent (same frame at origin)
    this.pivot.rotation.set(0, 0, 0);
    const target = (Math.PI / 2) * move.dir;
    return new Promise<void>(resolve => {
      this.anim = {
        move,
        elapsed: 0,
        duration,
        target,
        cubies: layerCubies,
        resolve,
      };
    });
  }

  /** Apply a move instantly (no animation). */
  applyInstant(move: Move) {
    applyMove(this.state, move);
    this.syncFromState();
  }

  setState(state: CubeState) {
    this.state = cloneCube(state);
    this.n = state.n;
    this.syncFromState();
  }

  private finishAnim() {
    if (!this.anim) return;
    const { move, cubies, resolve } = this.anim;
    for (const c of cubies) this.root.add(c.group);
    this.pivot.rotation.set(0, 0, 0);
    applyMove(this.state, move);
    this.syncFromState();
    this.anim = null;
    resolve();
  }

  private setAxisRotation(obj: THREE.Object3D, axis: Axis, value: number) {
    if (axis === 0) obj.rotation.x = value;
    else if (axis === 1) obj.rotation.y = value;
    else obj.rotation.z = value;
  }

  private renderLoop = () => {
    if (this.disposed) return;
    requestAnimationFrame(this.renderLoop);
    const dt = this.clock.getDelta() * 1000;
    if (this.anim) {
      this.anim.elapsed += dt;
      const t = Math.min(1, this.anim.elapsed / this.anim.duration);
      this.setAxisRotation(
        this.pivot,
        this.anim.move.axis,
        this.anim.target * TWEEN(t)
      );
      if (t >= 1) this.finishAnim();
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private handleResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // ---- Drag-to-turn -------------------------------------------------------

  private pointerToNDC(e: PointerEvent): THREE.Vector2 {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -(((e.clientY - rect.top) / rect.height) * 2 - 1)
    );
  }

  private onPointerDown(e: PointerEvent) {
    if (this.anim || e.button !== 0) return;
    const ndc = this.pointerToNDC(e);
    this.raycaster.setFromCamera(ndc, this.camera);
    const meshes: THREE.Mesh[] = [];
    for (const c of this.cubies)
      for (const t of c.tiles) if (t.visible) meshes.push(t);
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return; // let OrbitControls orbit

    const hit = hits[0];
    const tile = hit.object as THREE.Mesh;
    let owner: Cubie | undefined;
    let faceId = -1;
    for (const c of this.cubies) {
      const idx = c.tiles.indexOf(tile);
      if (idx >= 0) {
        owner = c;
        faceId = idx;
        break;
      }
    }
    if (!owner) return;

    const normalAxis: Axis =
      faceId === 4 || faceId === 5 ? 0 : faceId === 0 || faceId === 1 ? 1 : 2;
    const center = new THREE.Vector3();
    this.root.getWorldPosition(center);
    this.controls.enabled = false;
    this.dragging = {
      cubie: owner,
      normalAxis,
      hitRel: hit.point.clone().sub(center),
      startX: e.clientX,
      startY: e.clientY,
      committed: false,
    };
  }

  private onPointerMove(e: PointerEvent) {
    const d = this.dragging;
    if (!d || d.committed || this.anim) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.hypot(dx, dy) < 10) return;

    // Drag vector in screen pixels (y down).
    const drag = new THREE.Vector2(dx, dy);
    const center = new THREE.Vector3();
    this.root.getWorldPosition(center);

    // Candidate rotation axes = the two cube axes perpendicular to the face normal.
    const candidates: Axis[] = ([0, 1, 2] as Axis[]).filter(
      a => a !== d.normalAxis
    );
    const rotMat = new THREE.Matrix4().extractRotation(this.root.matrixWorld);

    let best: { axis: Axis; dir: 1 | -1; score: number } | null = null;
    for (const axis of candidates) {
      const worldAxis = new THREE.Vector3()
        .setFromMatrixColumn(rotMat, axis)
        .normalize();
      for (const dir of [1, -1] as const) {
        const q = new THREE.Quaternion().setFromAxisAngle(
          worldAxis,
          dir * 0.05
        );
        const moved = d.hitRel.clone().applyQuaternion(q).sub(d.hitRel);
        const screen = this.worldDeltaToScreen(center, moved);
        const score = screen.dot(drag);
        if (!best || score > best.score) best = { axis, dir, score };
      }
    }
    if (!best || best.score <= 0) return;

    const layer = this.coordOnAxis(d.cubie, best.axis);
    const move: Move = { axis: best.axis, layer, dir: best.dir };
    d.committed = true;
    this.controls.enabled = true;
    this.dragging = null;
    this.animateMove(move).then(() => this.opts.onMove?.(move));
  }

  private onPointerUp() {
    if (this.dragging) {
      this.controls.enabled = true;
      this.dragging = null;
    }
  }

  /** Convert a small world-space delta near `center` into a screen-pixel vector (y down). */
  private worldDeltaToScreen(
    center: THREE.Vector3,
    delta: THREE.Vector3
  ): THREE.Vector2 {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const a = center.clone().project(this.camera);
    const b = center.clone().add(delta).project(this.camera);
    return new THREE.Vector2(
      ((b.x - a.x) * rect.width) / 2,
      (-(b.y - a.y) * rect.height) / 2
    );
  }

  resetView() {
    const n = this.n;
    const dist = (n * 2.0 + 3) * (this.opts.distanceScale ?? 1);
    this.camera.position.set(dist * 0.85, dist * 0.7, dist * 0.95);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  dispose() {
    this.disposed = true;
    this.resizeObserver.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.onPointerDown, true);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    this.controls.dispose();
    this.renderer.dispose();
    if (el.parentElement) el.parentElement.removeChild(el);
  }
}
