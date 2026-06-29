// Self-contained WebGL 3D-fractal renderer. No external deps.
//
// Each pixel shoots a ray from an orbiting camera and ray-marches (sphere
// traces) a signed distance field defined by a distance estimator (DE):
//   - Mandelbulb     : escape-time, White & Nylander power-n formula
//   - Mandelbox      : box-fold + sphere-fold with a scalar running derivative
//   - Quaternion Julia: q -> q^2 + c with the Hubbard-Douady DE
// The surface is shaded with DE-gradient normals, cheap ambient occlusion from
// the march, a soft shadow ray, glow and fog. Colour comes from an orbit-trap
// fed through the same palette family as the 2D Fractal Lab.
//
// Performance: it renders at a reduced internal resolution while the camera is
// moving and progressively refines to full resolution when it stops, and caps
// iteration/step counts via a quality setting so it stays smooth on phones.

export type Fractal3DType = "mandelbulb" | "mandelbox" | "julia";

export interface Fractal3DParams {
  type: Fractal3DType;
  power: number; // mandelbulb power
  iterations: number; // fractal iteration count
  boxScale: number; // mandelbox scale
  juliaC: [number, number, number, number]; // quaternion constant
  palette: number;
  colorShift: number;
  glow: number; // 0..1 background/edge glow strength
  quality: number; // 0..1 (perf <-> quality)
}

export interface Fractal3DCamera {
  yaw: number;
  pitch: number;
  dist: number;
}

export interface Fractal3DViewOptions {
  onChange?: (cam: Fractal3DCamera) => void;
}

const DEFAULT_CAM: Fractal3DCamera = { yaw: 0.7, pitch: -0.35, dist: 2.8 };

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;

uniform vec2 u_resolution;
uniform vec3 u_camPos;
uniform vec3 u_camTarget;
uniform float u_time;

uniform int u_type;          // 0 bulb, 1 box, 2 julia
uniform float u_power;
uniform int u_iterations;
uniform float u_boxScale;
uniform vec4 u_juliaC;
uniform int u_palette;
uniform float u_colorShift;
uniform float u_glow;
uniform int u_maxSteps;
uniform float u_detail;      // min surface distance (smaller = crisper, slower)
uniform float u_far;         // ray far plane (depends on fractal size)

const int ITER_CAP = 24;
const int STEP_CAP = 160;

// ---------------- distance estimators -------------------------------------

// Mandelbulb (White & Nylander). Returns distance; writes orbit trap to trap.
float deBulb(vec3 pos, out float trap) {
  vec3 z = pos;
  float dr = 1.0;
  float r = 0.0;
  trap = 1e10;
  for (int i = 0; i < ITER_CAP; i++) {
    if (i >= u_iterations) break;
    r = length(z);
    if (r > 2.0) break;
    trap = min(trap, r);
    float theta = acos(clamp(z.z / r, -1.0, 1.0));
    float phi = atan(z.y, z.x);
    float zr = pow(r, u_power);
    dr = pow(r, u_power - 1.0) * u_power * dr + 1.0;
    theta *= u_power;
    phi *= u_power;
    z = zr * vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta)) + pos;
  }
  return 0.5 * log(r) * r / dr;
}

// Mandelbox (box fold + sphere fold) with scalar running derivative.
float deBox(vec3 pos, out float trap) {
  vec3 z = pos;
  float dr = 1.0;
  float s = u_boxScale;
  trap = 1e10;
  for (int i = 0; i < ITER_CAP; i++) {
    if (i >= u_iterations) break;
    z = clamp(z, -1.0, 1.0) * 2.0 - z;          // box fold
    float m2 = dot(z, z);
    if (m2 < 0.25) { z *= 4.0; dr *= 4.0; }      // sphere fold (inner)
    else if (m2 < 1.0) { float t = 1.0 / m2; z *= t; dr *= t; }
    z = z * s + pos;
    dr = dr * abs(s) + 1.0;
    trap = min(trap, length(z));
    if (dot(z, z) > 4096.0) break;
  }
  return length(z) / abs(dr);
}

// Quaternion Julia: q -> q^2 + c, Hubbard-Douady DE.
float deJulia(vec3 pos, out float trap) {
  vec4 z = vec4(pos, 0.0);
  vec4 c = u_juliaC;
  float dz = 1.0;
  float md = 1e10;
  trap = 1e10;
  for (int i = 0; i < ITER_CAP; i++) {
    if (i >= u_iterations) break;
    dz = 2.0 * length(z) * dz;
    // quaternion square
    z = vec4(
      z.x * z.x - z.y * z.y - z.z * z.z - z.w * z.w,
      2.0 * z.x * z.y,
      2.0 * z.x * z.z,
      2.0 * z.x * z.w
    ) + c;
    md = dot(z, z);
    trap = min(trap, md);
    if (md > 16.0) break;
  }
  float r = sqrt(md);
  return 0.25 * log(r) * r / dz;
}

float map(vec3 p, out float trap) {
  if (u_type == 0) return deBulb(p, trap);
  if (u_type == 1) return deBox(p, trap);
  return deJulia(p, trap);
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.0005, 0.0);
  float t;
  return normalize(vec3(
    map(p + e.xyy, t) - map(p - e.xyy, t),
    map(p + e.yxy, t) - map(p - e.yxy, t),
    map(p + e.yyx, t) - map(p - e.yyx, t)
  ));
}

// Soft shadow along a ray (Inigo Quilez).
float softShadow(vec3 ro, vec3 rd) {
  float res = 1.0;
  float t = 0.02;
  float trap;
  for (int i = 0; i < 40; i++) {
    float h = map(ro + rd * t, trap);
    res = min(res, 8.0 * h / t);
    t += clamp(h, 0.01, 0.2);
    if (res < 0.02 || t > 4.0) break;
  }
  return clamp(res, 0.0, 1.0);
}

// Inigo Quilez cosine gradient palette (matches the 2D Fractal Lab themes).
vec3 cosPalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(6.28318530718 * (c * t + d));
}
vec3 glowPal(float t, vec3 freq) {
  return 0.5 + 0.5 * cos(6.28318530718 * (freq * t + 0.5));
}
vec3 palette(float t) {
  if (u_palette == 0) return glowPal(t, vec3(1.0, 0.7, 0.4));       // Ember
  else if (u_palette == 1) return glowPal(t, vec3(0.4, 0.7, 1.0));  // Ice
  else if (u_palette == 2) return cosPalette(t, vec3(0.5), vec3(0.5),
                              vec3(1.0), vec3(0.0, 0.33, 0.67));     // Spectrum
  else if (u_palette == 3) return glowPal(t, vec3(0.85, 0.70, 0.40)); // Gold
  else return vec3(0.62, 0.78, 0.95)
            + vec3(0.34, 0.20, 0.05)
              * cos(6.28318530718 * (t + vec3(0.0, 0.10, 0.22)));   // Azure
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;

  // Camera basis looking at the target.
  vec3 ro = u_camPos;
  vec3 fwd = normalize(u_camTarget - ro);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
  vec3 up = cross(fwd, right);
  vec3 rd = normalize(uv.x * right + uv.y * up + 1.4 * fwd);

  vec3 bg = mix(vec3(0.02, 0.025, 0.045), vec3(0.0), length(uv) * 0.7);

  float t = 0.0;
  float trap = 1e10;
  bool hit = false;
  float steps = 0.0;
  for (int i = 0; i < STEP_CAP; i++) {
    if (i >= u_maxSteps) break;
    vec3 p = ro + rd * t;
    float d = map(p, trap);
    if (d < u_detail * t) { hit = true; break; }
    t += d;
    steps += 1.0;
    if (t > u_far) break;
  }

  vec3 col;
  if (hit) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    vec3 lightDir = normalize(vec3(0.6, 0.8, -0.4));
    float diff = clamp(dot(n, lightDir), 0.0, 1.0);
    float ao = 1.0 - steps / float(u_maxSteps);    // cheap occlusion
    ao = clamp(ao * ao + 0.15, 0.0, 1.0);
    float sh = softShadow(p + n * 0.002, lightDir);
    float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 3.0);

    vec3 base = palette(trap * 1.5 + u_colorShift);
    col = base * (0.25 + 0.85 * diff * sh) * ao;
    col += fres * 0.4 * base;
    col = mix(col, bg, clamp(t / u_far, 0.0, 1.0)); // distance fog
  } else {
    // glow toward the centre where the fractal sits
    float g = u_glow * pow(max(0.0, 1.0 - length(uv) * 0.9), 3.0);
    col = bg + g * palette(u_colorShift + 0.3) * 0.5;
  }

  col = pow(col, vec3(0.4545)); // gamma
  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("Failed to create shader");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error("Shader compile error: " + log);
  }
  return sh;
}

const UNIFORMS = [
  "u_resolution",
  "u_camPos",
  "u_camTarget",
  "u_time",
  "u_type",
  "u_power",
  "u_iterations",
  "u_boxScale",
  "u_juliaC",
  "u_palette",
  "u_colorShift",
  "u_glow",
  "u_maxSteps",
  "u_detail",
  "u_far",
] as const;

// The Mandelbox bulk is much larger than the unit-ish Mandelbulb / Julia, so it
// needs a farther camera and a longer ray far-plane to frame it.
const DEFAULT_DIST: Record<Fractal3DType, number> = {
  mandelbulb: 2.8,
  mandelbox: 7,
  julia: 2.6,
};
const FAR: Record<Fractal3DType, number> = {
  mandelbulb: 8,
  mandelbox: 16,
  julia: 8,
};

export function defaultDistanceFor(type: Fractal3DType): number {
  return DEFAULT_DIST[type];
}

export class Fractal3DView {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private opts: Fractal3DViewOptions;

  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private uniforms: Record<string, WebGLUniformLocation | null> = {};

  private cam: Fractal3DCamera = { ...DEFAULT_CAM };
  private params: Fractal3DParams = {
    type: "mandelbulb",
    power: 8,
    iterations: 8,
    boxScale: -1.8,
    juliaC: [-0.45, 0.6, 0.2, 0.0],
    palette: 0,
    colorShift: 0,
    glow: 0.6,
    quality: 0.6,
  };

  private autoRotate = false;
  private animate = false;
  private colorCycle = false;

  private moving = false;
  private moveTimer = 0;
  private dirty = true;
  private raf = 0;
  private disposed = false;
  private startTime = performance.now();
  private resizeObserver: ResizeObserver;

  private pointers = new Map<number, { x: number; y: number }>();
  private dragStart: { x: number; y: number; yaw: number; pitch: number } | null =
    null;
  private pinchStartDist = 0;
  private pinchStartZoom = 0;

  constructor(container: HTMLElement, opts: Fractal3DViewOptions = {}) {
    this.container = container;
    this.opts = opts;

    this.canvas = document.createElement("canvas");
    this.canvas.style.display = "block";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.touchAction = "none";
    container.appendChild(this.canvas);

    const gl = this.canvas.getContext("webgl", {
      antialias: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error("WebGL is not available in this browser");
    this.gl = gl;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const program = gl.createProgram();
    if (!program) throw new Error("Failed to create program");
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error("Program link error: " + gl.getProgramInfoLog(program));
    }
    this.program = program;
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    const loc = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    for (const name of UNIFORMS) {
      this.uniforms[name] = gl.getUniformLocation(program, name);
    }

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.loop();
  }

  // Internal-resolution factor: lower while moving, higher (full) at rest.
  private resFactor(): number {
    const q = 0.4 + this.params.quality * 0.6; // 0.4..1.0 at rest
    return this.moving ? Math.min(q, 0.55) : q;
  }

  private resize() {
    const f = this.resFactor();
    const w = Math.max(1, Math.floor(this.container.clientWidth * this.dpr * f));
    const h = Math.max(1, Math.floor(this.container.clientHeight * this.dpr * f));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.gl.viewport(0, 0, w, h);
      this.dirty = true;
    }
  }

  private markMoving() {
    this.dirty = true;
    if (!this.moving) {
      this.moving = true;
      this.resize();
    }
    window.clearTimeout(this.moveTimer);
    this.moveTimer = window.setTimeout(() => {
      this.moving = false;
      this.resize(); // refine to full resolution
      this.dirty = true;
    }, 180);
    this.opts.onChange?.({ ...this.cam });
  }

  private onPointerDown(e: PointerEvent) {
    this.canvas.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) {
      this.dragStart = {
        x: e.clientX,
        y: e.clientY,
        yaw: this.cam.yaw,
        pitch: this.cam.pitch,
      };
    } else if (this.pointers.size === 2) {
      const pts = Array.from(this.pointers.values());
      this.pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      this.pinchStartZoom = this.cam.dist;
      this.dragStart = null;
    }
  }

  private onPointerMove(e: PointerEvent) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.pointers.size >= 2) {
      const pts = Array.from(this.pointers.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (this.pinchStartDist > 0) {
        this.cam.dist = Math.max(
          1.2,
          Math.min(14, this.pinchStartZoom * (this.pinchStartDist / Math.max(dist, 1)))
        );
        this.markMoving();
      }
      return;
    }

    if (this.dragStart) {
      const dx = (e.clientX - this.dragStart.x) / this.container.clientWidth;
      const dy = (e.clientY - this.dragStart.y) / this.container.clientHeight;
      this.cam.yaw = this.dragStart.yaw + dx * 3.0;
      this.cam.pitch = Math.max(
        -1.5,
        Math.min(1.5, this.dragStart.pitch + dy * 3.0)
      );
      this.markMoving();
    }
  }

  private onPointerUp(e: PointerEvent) {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinchStartDist = 0;
    if (this.pointers.size === 0) this.dragStart = null;
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    this.cam.dist = Math.max(
      1.2,
      Math.min(14, this.cam.dist * Math.exp(e.deltaY * 0.0015))
    );
    this.markMoving();
  }

  setParams(p: Partial<Fractal3DParams>) {
    const qChanged = p.quality !== undefined && p.quality !== this.params.quality;
    this.params = { ...this.params, ...p };
    if (qChanged) this.resize();
    this.dirty = true;
  }

  setCamera(c: Partial<Fractal3DCamera>) {
    this.cam = { ...this.cam, ...c };
    this.markMoving();
  }

  getCamera(): Fractal3DCamera {
    return { ...this.cam };
  }

  resetCamera() {
    this.cam = { ...DEFAULT_CAM, dist: DEFAULT_DIST[this.params.type] };
    this.markMoving();
  }

  setAutoRotate(on: boolean) {
    this.autoRotate = on;
    this.dirty = true;
  }

  setAnimate(on: boolean) {
    this.animate = on;
    this.dirty = true;
  }

  // Slowly drift the palette (and glow) so colours flow while you explore.
  setColorCycle(on: boolean) {
    this.colorCycle = on;
    this.dirty = true;
  }

  private camPos(): [number, number, number] {
    const { yaw, pitch, dist } = this.cam;
    const cp = Math.cos(pitch);
    return [
      dist * cp * Math.sin(yaw),
      dist * Math.sin(pitch),
      dist * cp * Math.cos(yaw),
    ];
  }

  private maxSteps(): number {
    return Math.round(70 + this.params.quality * 90); // 70..160
  }

  private detail(): number {
    // smaller = crisper but slower; ease with quality
    return 0.0016 - this.params.quality * 0.0011; // ~0.0016..0.0005
  }

  private render(animTime: number) {
    const gl = this.gl;
    gl.useProgram(this.program);
    const [px, py, pz] = this.camPos();
    gl.uniform2f(this.uniforms.u_resolution, this.canvas.width, this.canvas.height);
    gl.uniform3f(this.uniforms.u_camPos, px, py, pz);
    gl.uniform3f(this.uniforms.u_camTarget, 0, 0, 0);
    gl.uniform1f(this.uniforms.u_time, animTime);

    const typeIdx =
      this.params.type === "mandelbulb" ? 0 : this.params.type === "mandelbox" ? 1 : 2;
    gl.uniform1i(this.uniforms.u_type, typeIdx);

    // Optional animation: morph the defining parameter over time.
    let power = this.params.power;
    let boxScale = this.params.boxScale;
    const juliaC = this.params.juliaC.slice() as [number, number, number, number];
    if (this.animate) {
      if (typeIdx === 0) power = this.params.power + Math.sin(animTime * 0.3) * 1.5;
      else if (typeIdx === 1)
        boxScale = this.params.boxScale + Math.sin(animTime * 0.3) * 0.25;
      else {
        juliaC[0] += Math.sin(animTime * 0.25) * 0.12;
        juliaC[1] += Math.cos(animTime * 0.2) * 0.12;
      }
    }

    gl.uniform1f(this.uniforms.u_power, power);
    gl.uniform1i(this.uniforms.u_iterations, Math.round(this.params.iterations));
    gl.uniform1f(this.uniforms.u_boxScale, boxScale);
    gl.uniform4f(this.uniforms.u_juliaC, juliaC[0], juliaC[1], juliaC[2], juliaC[3]);
    gl.uniform1i(this.uniforms.u_palette, this.params.palette);
    gl.uniform1f(this.uniforms.u_colorShift, this.params.colorShift);
    gl.uniform1f(this.uniforms.u_glow, this.params.glow);
    gl.uniform1i(this.uniforms.u_maxSteps, this.maxSteps());
    gl.uniform1f(this.uniforms.u_detail, this.detail());
    gl.uniform1f(this.uniforms.u_far, FAR[this.params.type]);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private loop = () => {
    if (this.disposed) return;
    const animTime = (performance.now() - this.startTime) / 1000;
    if (this.autoRotate) {
      this.cam.yaw += 0.004;
      this.dirty = true;
    }
    if (this.animate) this.dirty = true;
    if (this.colorCycle) {
      this.params.colorShift = (this.params.colorShift + 0.0022) % 1;
      this.dirty = true;
    }
    if (this.dirty) {
      this.dirty = false;
      this.render(animTime);
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  screenshot(): string {
    this.render((performance.now() - this.startTime) / 1000);
    return this.canvas.toDataURL("image/png");
  }

  /**
   * Re-render the current view into a larger buffer for a true high-resolution
   * PNG (no upscaling). `longEdge` is the target length of the longer side.
   * Step count and detail are boosted so the surface stays crisp, then the live
   * view is restored.
   */
  exportPNG(longEdge = 3840): { url: string; width: number; height: number } {
    const gl = this.gl;
    const prevW = this.canvas.width;
    const prevH = this.canvas.height;
    const prevQuality = this.params.quality;

    const maxDims = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
    const hardCap = Math.min(maxDims[0] || 4096, maxDims[1] || 4096, 8192);

    const aspect = prevW / prevH;
    let w: number;
    let h: number;
    if (aspect >= 1) {
      w = Math.min(longEdge, hardCap);
      h = Math.round(w / aspect);
    } else {
      h = Math.min(longEdge, hardCap);
      w = Math.round(h * aspect);
    }
    w = Math.max(1, Math.min(w, hardCap));
    h = Math.max(1, Math.min(h, hardCap));

    this.params.quality = 1; // max steps + finest detail for the export
    this.canvas.width = w;
    this.canvas.height = h;
    gl.viewport(0, 0, w, h);

    this.render((performance.now() - this.startTime) / 1000);
    const url = this.canvas.toDataURL("image/png");

    this.params.quality = prevQuality;
    this.canvas.width = prevW;
    this.canvas.height = prevH;
    gl.viewport(0, 0, prevW, prevH);
    this.dirty = true;

    return { url, width: w, height: h };
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.clearTimeout(this.moveTimer);
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("wheel", this.onWheel);
    const ext = this.gl.getExtension("WEBGL_lose_context");
    ext?.loseContext();
    if (this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
  }
}
