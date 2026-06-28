// HorizonView — a first-person "stand on the beach and look up" planetarium.
//
// Unlike SkyView (a flat overhead dome), this renders the sky as a real 3D
// scene with Three.js: the ground / sea / horizon wrap around you and the stars
// sit on the celestial sphere above, wheeling across the sky as the time slider
// moves. Drag to look around, scroll to zoom.
//
// Stars and constellation lines live in WebGL (thousands of points); the Sun,
// Moon, planets, deep-sky objects, labels and compass are drawn on a 2D overlay
// projected through the same camera, reusing the look of SkyView.

import * as THREE from "three";
import * as Astronomy from "astronomy-engine";
import { ASTERISMS, CONSTELLATION_MYTH } from "./myth";
import type {
  Messier,
  SelectedInfo,
  SkyData,
  SkyOptions,
  Star,
} from "./SkyView";

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const STAR_R = 100; // radius of the star sphere
const SKY_R = 900; // radius of the sky/ground sphere (further than the stars)

const PLANETS: { body: Astronomy.Body; name: string; color: string }[] = [
  { body: Astronomy.Body.Mercury, name: "Mercury", color: "#b9a78c" },
  { body: Astronomy.Body.Venus, name: "Venus", color: "#fff2c4" },
  { body: Astronomy.Body.Mars, name: "Mars", color: "#ff6a4d" },
  { body: Astronomy.Body.Jupiter, name: "Jupiter", color: "#f3d8a7" },
  { body: Astronomy.Body.Saturn, name: "Saturn", color: "#f0e0b0" },
  { body: Astronomy.Body.Uranus, name: "Uranus", color: "#a9e6ff" },
  { body: Astronomy.Body.Neptune, name: "Neptune", color: "#6f8cff" },
];

const ASTERISM_BY_STAR = new Map<string, string>();
for (const a of ASTERISMS) {
  for (const s of a.stars)
    if (!ASTERISM_BY_STAR.has(s)) ASTERISM_BY_STAR.set(s, a.name);
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

interface HitTarget {
  pos: THREE.Vector3;
  hitR: number;
  info: SelectedInfo;
}

export interface HorizonOptions extends SkyOptions {
  // Optional equirectangular panorama (ground + horizon). When absent a clean
  // procedural night-beach horizon is drawn instead. North-alignment offset of
  // the panorama, in degrees, can be tuned with panoNorthDeg.
  panoramaUrl?: string;
  panoNorthDeg?: number;
}

export class HorizonView {
  private container: HTMLElement;
  private data: SkyData;
  private opts: HorizonOptions;
  private time = new Date();

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private overlay: HTMLCanvasElement;
  private octx: CanvasRenderingContext2D;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);

  private skyMat: THREE.ShaderMaterial;
  private stars: THREE.Points;
  private starMat: THREE.ShaderMaterial;
  private lines: THREE.LineSegments;
  private lineMat: THREE.LineBasicMaterial;

  private viewAz = 180; // looking south by default (good southern sky)
  private viewAlt = 22;
  private fov = 72;

  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private moved = 0;

  private hits: HitTarget[] = [];
  private selectedTitle: string | null = null;
  private needsRender = true;
  private raf = 0;
  private ro: ResizeObserver;
  private disposed = false;

  // Per-frame astronomy context.
  private gastDeg = 0;
  private sinLat = 0;
  private cosLat = 0;
  private sunAlt = 0;
  private dayness = 0;
  private starAlpha = 1;

  constructor(container: HTMLElement, data: SkyData, opts: HorizonOptions) {
    this.container = container;
    this.data = data;
    this.opts = opts;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(this.dpr);
    const canvas = this.renderer.domElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.style.touchAction = "none";
    container.appendChild(canvas);

    this.overlay = document.createElement("canvas");
    this.overlay.style.position = "absolute";
    this.overlay.style.inset = "0";
    this.overlay.style.width = "100%";
    this.overlay.style.height = "100%";
    this.overlay.style.pointerEvents = "none";
    container.appendChild(this.overlay);
    const octx = this.overlay.getContext("2d");
    if (!octx) throw new Error("2D overlay not supported");
    this.octx = octx;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.fov, 1, 0.1, 2000);

    this.skyMat = this.buildSkyMaterial();
    const skyGeo = new THREE.SphereGeometry(SKY_R, 64, 48);
    const sky = new THREE.Mesh(skyGeo, this.skyMat);
    this.scene.add(sky);

    this.starMat = this.buildStarMaterial();
    this.stars = new THREE.Points(new THREE.BufferGeometry(), this.starMat);
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);

    this.lineMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(0x6a86d6),
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    this.lines = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      this.lineMat
    );
    this.lines.frustumCulled = false;
    this.scene.add(this.lines);

    if (opts.panoramaUrl) this.loadPanorama(opts.panoramaUrl);

    this.bindEvents();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.updateCamera();
    this.rebuild();
    this.loop();
  }

  // ---- public API -------------------------------------------------------

  setTime(t: Date) {
    this.time = t;
    this.rebuild();
  }

  setOptions(p: Partial<HorizonOptions>) {
    const prevUrl = this.opts.panoramaUrl;
    this.opts = { ...this.opts, ...p };
    if (this.opts.panoramaUrl && this.opts.panoramaUrl !== prevUrl)
      this.loadPanorama(this.opts.panoramaUrl);
    this.rebuild();
  }

  clearSelection() {
    this.selectedTitle = null;
    this.needsRender = true;
  }

  resetView() {
    this.viewAz = 180;
    this.viewAlt = 22;
    this.fov = 72;
    this.updateCamera();
  }

  // ---- materials --------------------------------------------------------

  private buildSkyMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        uSunAlt: { value: 0 },
        uDayness: { value: 0 },
        uHasTex: { value: false },
        uTex: { value: null },
        uPanoYaw: { value: (this.opts.panoNorthDeg || 0) / 360 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main(){
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec3 vDir;
        uniform float uSunAlt;
        uniform float uDayness;
        uniform bool uHasTex;
        uniform sampler2D uTex;
        uniform float uPanoYaw;
        const float PI = 3.141592653589793;
        void main(){
          vec3 dir = normalize(vDir);
          float alt = asin(clamp(dir.y, -1.0, 1.0));
          float altDeg = degrees(alt);

          vec3 nightZen = vec3(0.012,0.020,0.045);
          vec3 nightHor = vec3(0.030,0.050,0.100);
          vec3 dayZen   = vec3(0.160,0.400,0.820);
          vec3 dayHor   = vec3(0.550,0.740,0.950);
          float h = clamp(altDeg/90.0, 0.0, 1.0);
          vec3 sky = mix(mix(nightHor,nightZen,h), mix(dayHor,dayZen,h), uDayness);

          float tw = clamp(1.0 - abs(uSunAlt)/9.0, 0.0, 1.0) * (1.0 - uDayness*0.4);
          float hBand = clamp(1.0 - altDeg/14.0, 0.0, 1.0);
          sky += vec3(0.45,0.22,0.10) * tw * hBand * 0.7;

          vec3 ground;
          if(uHasTex){
            float u = atan(dir.x, -dir.z)/(2.0*PI) + 0.5 + uPanoYaw;
            float v = alt/PI + 0.5;
            ground = texture2D(uTex, vec2(u, v)).rgb;
            ground *= mix(0.16, 1.0, uDayness);
          } else {
            float t = clamp(-altDeg/90.0, 0.0, 1.0);
            // dark sea, deepening toward the nadir
            ground = mix(vec3(0.030,0.050,0.085), vec3(0.006,0.009,0.018), t);
            // the water reflects a dimmed version of the sky just above it
            float sheen = pow(clamp(1.0 + altDeg/9.0, 0.0, 1.0), 2.5);
            ground += sky * 0.28 * sheen;
            ground = mix(ground, ground + vec3(0.30,0.15,0.07), hBand*tw*0.8);
            ground *= mix(0.6, 1.0, uDayness);
          }

          float blend = smoothstep(-1.5, 2.0, altDeg);
          gl_FragColor = vec4(mix(ground, sky, blend), 1.0);
        }
      `,
    });
  }

  private buildStarMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uSizeScale: { value: 1 },
        uStarAlpha: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aAlpha;
        attribute vec3 aColor;
        varying float vAlpha;
        varying vec3 vColor;
        uniform float uSizeScale;
        void main(){
          vAlpha = aAlpha;
          vColor = aColor;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
          gl_PointSize = aSize * uSizeScale;
        }
      `,
      fragmentShader: /* glsl */ `
        precision mediump float;
        varying float vAlpha;
        varying vec3 vColor;
        uniform float uStarAlpha;
        void main(){
          float d = length(gl_PointCoord - vec2(0.5));
          float a = smoothstep(0.5, 0.06, d) * vAlpha * uStarAlpha;
          if(a <= 0.01) discard;
          gl_FragColor = vec4(vColor, a);
        }
      `,
    });
  }

  private loadPanorama(url: string) {
    new THREE.TextureLoader().load(url, tex => {
      if (this.disposed) return;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      this.skyMat.uniforms.uTex.value = tex;
      this.skyMat.uniforms.uHasTex.value = true;
      this.needsRender = true;
    });
  }

  // ---- geometry / astronomy --------------------------------------------

  private altaz(raDeg: number, decDeg: number) {
    const H = (this.gastDeg + this.opts.lon - raDeg) * DEG;
    const dec = decDeg * DEG;
    const sinDec = Math.sin(dec);
    const cosDec = Math.cos(dec);
    const sinAlt = sinDec * this.sinLat + cosDec * this.cosLat * Math.cos(H);
    const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
    const cosAlt = Math.cos(alt);
    const sinA = (-cosDec * Math.sin(H)) / cosAlt;
    const cosA = (sinDec - this.sinLat * sinAlt) / (this.cosLat * cosAlt);
    let az = Math.atan2(sinA, cosA);
    if (az < 0) az += 2 * Math.PI;
    return { alt: alt * RAD, az: az * RAD };
  }

  private vec(altDeg: number, azDeg: number, r: number, out?: THREE.Vector3) {
    const alt = altDeg * DEG;
    const az = azDeg * DEG;
    const ca = Math.cos(alt);
    const v = out || new THREE.Vector3();
    return v.set(r * ca * Math.sin(az), r * Math.sin(alt), -r * ca * Math.cos(az));
  }

  private rebuild() {
    const observer = new Astronomy.Observer(this.opts.lat, this.opts.lon, 0);
    this.gastDeg = Astronomy.SiderealTime(this.time) * 15;
    const latRad = this.opts.lat * DEG;
    this.sinLat = Math.sin(latRad);
    this.cosLat = Math.cos(latRad);

    const sunEq = Astronomy.Equator(
      Astronomy.Body.Sun,
      this.time,
      observer,
      true,
      true
    );
    const sun = this.altaz(sunEq.ra * 15, sunEq.dec);
    this.sunAlt = sun.alt;
    this.dayness = clamp01((this.sunAlt + 6) / 12);
    this.starAlpha = clamp01((-this.sunAlt - 4) / 8);

    this.skyMat.uniforms.uSunAlt.value = this.sunAlt;
    this.skyMat.uniforms.uDayness.value = this.dayness;
    this.starMat.uniforms.uStarAlpha.value = this.starAlpha;
    this.lineMat.opacity = 0.32 * this.starAlpha;
    this.lineMat.visible = this.opts.showConstellations && this.starAlpha > 0.02;

    this.buildStars();
    this.buildLines();
    this.needsRender = true;
  }

  private buildStars() {
    const pos: number[] = [];
    const size: number[] = [];
    const alpha: number[] = [];
    const color: number[] = [];
    const v = new THREE.Vector3();
    for (const s of this.data.stars) {
      const { alt, az } = this.altaz(s.r, s.d);
      if (alt <= -1) continue;
      this.vec(alt, az, STAR_R, v);
      pos.push(v.x, v.y, v.z);
      size.push(Math.max(1.1, (6.6 - s.m) * 0.9));
      alpha.push(clamp01(1.15 - s.m / 7));
      // faint blue-white; brighter stars a touch warmer
      const warm = clamp01((2.5 - s.m) / 5);
      color.push(0.78 + 0.18 * warm, 0.83 + 0.1 * warm, 1.0);
    }
    const g = this.stars.geometry;
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aSize", new THREE.Float32BufferAttribute(size, 1));
    g.setAttribute("aAlpha", new THREE.Float32BufferAttribute(alpha, 1));
    g.setAttribute("aColor", new THREE.Float32BufferAttribute(color, 3));
  }

  private buildLines() {
    const pos: number[] = [];
    if (this.opts.showConstellations) {
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      for (const con of this.data.constellations) {
        for (const seg of con.lines) {
          for (let i = 0; i + 1 < seg.length; i++) {
            const p0 = this.altaz(seg[i][0], seg[i][1]);
            const p1 = this.altaz(seg[i + 1][0], seg[i + 1][1]);
            if (p0.alt <= 0 || p1.alt <= 0) continue;
            this.vec(p0.alt, p0.az, STAR_R, a);
            this.vec(p1.alt, p1.az, STAR_R, b);
            pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
          }
        }
      }
    }
    this.lines.geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(pos, 3)
    );
  }

  // ---- camera / interaction --------------------------------------------

  private updateCamera() {
    this.viewAlt = Math.max(-85, Math.min(85, this.viewAlt));
    this.fov = Math.max(28, Math.min(95, this.fov));
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
    const target = this.vec(this.viewAlt, this.viewAz, 1);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(target);
    this.updateSizeScale();
    this.needsRender = true;
  }

  private updateSizeScale() {
    const h = this.container.clientHeight || 600;
    this.starMat.uniforms.uSizeScale.value =
      (h / 760) * (72 / this.fov) * this.dpr * 1.5;
  }

  private bindEvents() {
    const el = this.renderer.domElement;
    const onDown = (e: PointerEvent) => {
      this.dragging = true;
      this.moved = 0;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.moved += Math.abs(dx) + Math.abs(dy);
      const k = this.fov / (this.container.clientHeight || 600);
      this.viewAz -= dx * k;
      this.viewAlt += dy * k;
      if (this.viewAz < 0) this.viewAz += 360;
      if (this.viewAz >= 360) this.viewAz -= 360;
      this.updateCamera();
    };
    const onUp = (e: PointerEvent) => {
      this.dragging = false;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (this.moved < 5) this.handleClick(e);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      this.fov *= e.deltaY > 0 ? 1.08 : 1 / 1.08;
      this.updateCamera();
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    this.unbind = () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("wheel", onWheel);
    };
  }
  private unbind: () => void = () => {};

  private project(p: THREE.Vector3) {
    const v = p.clone().project(this.camera);
    const w = this.container.clientWidth || 600;
    const h = this.container.clientHeight || 600;
    return {
      x: (v.x * 0.5 + 0.5) * w,
      y: (1 - (v.y * 0.5 + 0.5)) * h,
      inFront: v.z < 1,
    };
  }

  private handleClick(e: PointerEvent) {
    const rect = this.overlay.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let best: HitTarget | null = null;
    let bestD = Infinity;
    for (const hgt of this.hits) {
      const s = this.project(hgt.pos);
      if (!s.inFront) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < hgt.hitR && d < bestD) {
        bestD = d;
        best = hgt;
      }
    }
    if (best) {
      this.selectedTitle = best.info.title;
      this.opts.onSelect?.(best.info);
    } else {
      this.selectedTitle = null;
      this.opts.onSelect?.(null);
    }
    this.needsRender = true;
  }

  // ---- render loop ------------------------------------------------------

  private loop = () => {
    if (this.disposed) return;
    if (this.needsRender) {
      this.needsRender = false;
      this.renderer.render(this.scene, this.camera);
      this.drawOverlay();
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private resize() {
    const w = this.container.clientWidth || 600;
    const h = this.container.clientHeight || 600;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.overlay.width = Math.round(w * this.dpr);
    this.overlay.height = Math.round(h * this.dpr);
    this.octx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.updateSizeScale();
    this.needsRender = true;
  }

  private drawOverlay() {
    const ctx = this.octx;
    const w = this.container.clientWidth || 600;
    const h = this.container.clientHeight || 600;
    ctx.clearRect(0, 0, w, h);
    this.hits = [];

    const observer = new Astronomy.Observer(this.opts.lat, this.opts.lon, 0);

    this.drawCompass(ctx);
    if (this.opts.showDSO && this.starAlpha > 0.05) this.drawMessier(ctx);
    if (this.starAlpha > 0.4) this.drawStarLabels(ctx);
    this.drawSolarSystem(ctx, observer);
  }

  private drawCompass(ctx: CanvasRenderingContext2D) {
    const dirs = [
      { label: "N", az: 0 },
      { label: "NE", az: 45 },
      { label: "E", az: 90 },
      { label: "SE", az: 135 },
      { label: "S", az: 180 },
      { label: "SW", az: 225 },
      { label: "W", az: 270 },
      { label: "NW", az: 315 },
    ];
    ctx.font = "12px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const v = new THREE.Vector3();
    for (const d of dirs) {
      this.vec(0, d.az, STAR_R, v);
      const s = this.project(v);
      if (!s.inFront) continue;
      const major = d.label.length === 1;
      ctx.fillStyle = major
        ? "rgba(220,205,160,0.95)"
        : "rgba(200,190,160,0.55)";
      ctx.font = `${major ? 14 : 11}px ui-monospace, monospace`;
      ctx.fillText(d.label, s.x, s.y);
    }
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  private drawStarLabels(ctx: CanvasRenderingContext2D) {
    ctx.font = "11px ui-monospace, monospace";
    const v = new THREE.Vector3();
    for (const s of this.data.stars) {
      if (!s.n && s.m >= 4) continue;
      const { alt, az } = this.altaz(s.r, s.d);
      if (alt <= 0) continue;
      this.vec(alt, az, STAR_R, v);
      const sc = this.project(v);
      if (!sc.inFront) continue;
      this.hits.push({ pos: v.clone(), hitR: 14, info: this.starInfo(s) });
      if (this.selectedTitle === this.starTitle(s))
        this.drawRing(ctx, sc.x, sc.y, 9);
      if (this.opts.showLabels && s.n && s.m < 2.0) {
        ctx.fillStyle = `rgba(200,168,76,${this.starAlpha})`;
        ctx.fillText(s.n, sc.x + 7, sc.y - 5);
      }
    }
  }

  private starTitle(s: Star): string {
    if (s.n) return s.n;
    if (s.b && s.c) return `${s.b} ${s.c}`;
    return `Star (mag ${s.m.toFixed(1)})`;
  }

  private starInfo(s: Star): SelectedInfo {
    const facts: string[] = [`Magnitude ${s.m.toFixed(2)}`];
    const conId = s.c || "";
    const myth = CONSTELLATION_MYTH[conId];
    if (myth) facts.push(`In ${myth.name}`);
    if (s.b) facts.push(`Bayer ${s.b}${conId ? " " + conId : ""}`);
    const aster = s.n ? ASTERISM_BY_STAR.get(s.n) : undefined;
    if (aster) facts.push(`Part of ${aster}`);
    return {
      kind: "star",
      title: this.starTitle(s),
      subtitle: "Star",
      facts,
      myth: myth?.story,
    };
  }

  private drawMessier(ctx: CanvasRenderingContext2D) {
    const v = new THREE.Vector3();
    for (const o of this.data.messier) {
      const { alt, az } = this.altaz(o.r, o.d);
      if (alt <= 0) continue;
      this.vec(alt, az, STAR_R, v);
      const s = this.project(v);
      if (!s.inFront) continue;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(150,230,180,${0.8 * this.starAlpha})`;
      ctx.lineWidth = 1.2;
      ctx.arc(s.x, s.y, 3.4, 0, 2 * Math.PI);
      ctx.stroke();
      this.hits.push({ pos: v.clone(), hitR: 12, info: this.messierInfo(o) });
      if (this.selectedTitle === (o.name || o.id))
        this.drawRing(ctx, s.x, s.y, 8);
    }
  }

  private messierInfo(o: Messier): SelectedInfo {
    const facts: string[] = [];
    facts.push(`${o.id}${o.ngc ? " · NGC " + o.ngc : ""}`);
    facts.push(o.type);
    if (o.m != null) facts.push(`Magnitude ${o.m.toFixed(1)}`);
    const myth = CONSTELLATION_MYTH[o.con];
    if (myth) facts.push(`In ${myth.name}`);
    return {
      kind: "dso",
      title: o.name || o.id,
      subtitle: "Deep-sky object",
      facts,
      myth: myth?.story,
    };
  }

  private drawSolarSystem(
    ctx: CanvasRenderingContext2D,
    observer: Astronomy.Observer
  ) {
    const v = new THREE.Vector3();

    // Sun
    const sunEq = Astronomy.Equator(
      Astronomy.Body.Sun,
      this.time,
      observer,
      true,
      true
    );
    const sun = this.altaz(sunEq.ra * 15, sunEq.dec);
    if (sun.alt > -1) {
      this.vec(sun.alt, sun.az, STAR_R, v);
      const s = this.project(v);
      if (s.inFront) {
        const grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 26);
        grd.addColorStop(0, "rgba(255,236,150,1)");
        grd.addColorStop(0.3, "rgba(255,214,90,0.85)");
        grd.addColorStop(1, "rgba(255,214,90,0)");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 26, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = "#fff0b0";
        ctx.beginPath();
        ctx.arc(s.x, s.y, 8, 0, 2 * Math.PI);
        ctx.fill();
        this.hits.push({
          pos: v.clone(),
          hitR: 16,
          info: {
            kind: "sun",
            title: "The Sun",
            subtitle: "Our star",
            facts: [`Altitude ${sun.alt.toFixed(0)}°`, "G-type main-sequence star"],
          },
        });
        if (this.selectedTitle === "The Sun") this.drawRing(ctx, s.x, s.y, 12);
      }
    }

    // Moon
    const moonEq = Astronomy.Equator(
      Astronomy.Body.Moon,
      this.time,
      observer,
      true,
      true
    );
    const moon = this.altaz(moonEq.ra * 15, moonEq.dec);
    if (moon.alt > -1) {
      this.vec(moon.alt, moon.az, STAR_R, v);
      const s = this.project(v);
      if (s.inFront) {
        const illum = Astronomy.Illumination(Astronomy.Body.Moon, this.time);
        const phase = Astronomy.MoonPhase(this.time);
        this.drawMoon(ctx, s.x, s.y, 8, illum.phase_fraction, phase < 180);
        this.hits.push({
          pos: v.clone(),
          hitR: 16,
          info: {
            kind: "moon",
            title: "The Moon",
            subtitle: this.moonPhaseName(phase),
            facts: [
              `${Math.round(illum.phase_fraction * 100)}% illuminated`,
              `Altitude ${moon.alt.toFixed(0)}°`,
            ],
          },
        });
        if (this.selectedTitle === "The Moon") this.drawRing(ctx, s.x, s.y, 13);
      }
    }

    if (!this.opts.showPlanets) return;
    for (const p of PLANETS) {
      const eq = Astronomy.Equator(p.body, this.time, observer, true, true);
      const pa = this.altaz(eq.ra * 15, eq.dec);
      if (pa.alt <= 0) continue;
      this.vec(pa.alt, pa.az, STAR_R, v);
      const s = this.project(v);
      if (!s.inFront) continue;
      let mag = 0;
      try {
        mag = Astronomy.Illumination(p.body, this.time).mag;
      } catch {
        mag = 2;
      }
      const rr = Math.max(2.4, 4.6 - mag * 0.5);
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      ctx.beginPath();
      ctx.arc(s.x, s.y, rr * 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, rr, 0, 2 * Math.PI);
      ctx.fill();
      if (this.opts.showLabels) {
        ctx.fillStyle = "rgba(220,200,150,0.9)";
        ctx.font = "11px ui-monospace, monospace";
        ctx.fillText(p.name, s.x + rr + 4, s.y - 4);
      }
      this.hits.push({
        pos: v.clone(),
        hitR: 13,
        info: {
          kind: "planet",
          title: p.name,
          subtitle: "Planet",
          facts: [`Magnitude ${mag.toFixed(1)}`, `Altitude ${pa.alt.toFixed(0)}°`],
        },
      });
      if (this.selectedTitle === p.name) this.drawRing(ctx, s.x, s.y, rr + 5);
    }
  }

  private drawMoon(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    rad: number,
    frac: number,
    waxing: boolean
  ) {
    ctx.save();
    ctx.translate(x, y);
    if (!waxing) ctx.scale(-1, 1);
    ctx.beginPath();
    ctx.fillStyle = "#3b3b44";
    ctx.arc(0, 0, rad, 0, 2 * Math.PI);
    ctx.fill();
    const tx = rad * (1 - 2 * clamp01(frac));
    ctx.beginPath();
    ctx.fillStyle = "#e9e9ee";
    ctx.arc(0, 0, rad, -Math.PI / 2, Math.PI / 2, false);
    ctx.ellipse(0, 0, Math.abs(tx), rad, 0, Math.PI / 2, -Math.PI / 2, tx > 0);
    ctx.fill();
    ctx.restore();
  }

  private moonPhaseName(phase: number): string {
    if (phase < 22.5 || phase >= 337.5) return "New Moon";
    if (phase < 67.5) return "Waxing crescent";
    if (phase < 112.5) return "First quarter";
    if (phase < 157.5) return "Waxing gibbous";
    if (phase < 202.5) return "Full Moon";
    if (phase < 247.5) return "Waning gibbous";
    if (phase < 292.5) return "Last quarter";
    return "Waning crescent";
  }

  private drawRing(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number
  ) {
    ctx.beginPath();
    ctx.strokeStyle = "#C9A84C";
    ctx.lineWidth = 1.6;
    ctx.arc(x, y, r + 2, 0, 2 * Math.PI);
    ctx.stroke();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.unbind();
    this.stars.geometry.dispose();
    this.lines.geometry.dispose();
    this.starMat.dispose();
    this.lineMat.dispose();
    this.skyMat.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement)
      this.renderer.domElement.parentElement.removeChild(
        this.renderer.domElement
      );
    if (this.overlay.parentElement)
      this.overlay.parentElement.removeChild(this.overlay);
  }
}
