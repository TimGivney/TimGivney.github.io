// Self-contained WebGL Mandelbrot / Julia renderer. No external deps.
//
// The whole fractal is drawn by a single fragment shader over a full-screen
// quad: each pixel maps to a complex number `c` and we iterate z -> z^2 + c
// (Mandelbrot) or z -> z^2 + juliaC (Julia) until it escapes, then colour by a
// smooth (fractional) iteration count through a cosine palette.
//
// 32-bit float in the shader is good to ~1e-5 zoom before pixelation; deeper
// zooms would need emulated double precision / perturbation (future work).

export interface FractalParams {
  maxIter: number;
  palette: number; // index into the palette set in the shader
  colorShift: number; // 0..1, rotates the palette
  colorScale: number; // density of colour banding
  julia: boolean;
  juliaC: [number, number];
  deep: boolean; // emulated double precision for extra-deep zooms (slower)
}

export interface FractalState {
  centerX: number;
  centerY: number;
  scale: number; // vertical extent of the view in complex units
}

export interface FractalViewOptions {
  onChange?: (state: FractalState) => void;
}

const DEFAULT_STATE: FractalState = { centerX: -0.5, centerY: 0, scale: 2.6 };

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_center;
uniform vec2 u_cx;         // df64 (hi, lo) of centre X for deep mode
uniform vec2 u_cy;         // df64 (hi, lo) of centre Y for deep mode
uniform float u_scale;     // vertical extent of the view in complex units
uniform int u_maxIter;
uniform int u_palette;
uniform float u_colorShift;
uniform float u_colorScale;
uniform bool u_julia;
uniform bool u_deep;       // emulated double precision
uniform vec2 u_juliaC;

const int ITER_CAP = 1500;

// ---- "double-single" (df64) arithmetic ------------------------------------
// Each value is a vec2 (hi, lo) carrying ~2x the mantissa bits of a 32-bit
// float, which pushes the usable zoom roughly from ~1e-5 to ~1e-13.
vec2 ds_set(float a) { return vec2(a, 0.0); }
vec2 ds_neg(vec2 a) { return vec2(-a.x, -a.y); }

vec2 ds_add(vec2 a, vec2 b) {
  float s = a.x + b.x;
  float v = s - a.x;
  float e = (a.x - (s - v)) + (b.x - v);
  float lo = a.y + b.y + e;
  float hi = s + lo;
  return vec2(hi, lo - (hi - s));
}

vec2 ds_mul(vec2 a, vec2 b) {
  float split = 8193.0; // 2^13 + 1
  float ca = split * a.x;
  float cb = split * b.x;
  float ahi = ca - (ca - a.x);
  float alo = a.x - ahi;
  float bhi = cb - (cb - b.x);
  float blo = b.x - bhi;
  float p = a.x * b.x;
  float e = ((ahi * bhi - p) + ahi * blo + alo * bhi) + alo * blo;
  float lo = a.x * b.y + a.y * b.x + e;
  float hi = p + lo;
  return vec2(hi, lo - (hi - p));
}

// Inigo Quilez cosine gradient palette.
vec3 cosPalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(6.28318530718 * (c * t + d));
}

// Glow palettes: each fades up from black (t=0) through its theme, so the
// low-iteration outer halo recedes and the detail near the set blooms.
vec3 glow(float t, vec3 freq) {
  return 0.5 + 0.5 * cos(6.28318530718 * (freq * t + 0.5));
}

vec3 palette(float t) {
  if (u_palette == 0) {
    // Ember: black -> red -> orange -> gold/white
    return glow(t, vec3(1.0, 0.7, 0.4));
  } else if (u_palette == 1) {
    // Ice: black -> cobalt -> cyan -> white
    return glow(t, vec3(0.4, 0.7, 1.0));
  } else if (u_palette == 2) {
    // Spectrum: full rolling rainbow
    return cosPalette(t, vec3(0.5), vec3(0.5),
                      vec3(1.0), vec3(0.0, 0.33, 0.67));
  } else {
    // Gold: black -> warm gold -> white (matches site accent)
    return glow(t, vec3(0.85, 0.70, 0.40));
  }
}

void main() {
  vec2 uv = gl_FragCoord.xy - 0.5 * u_resolution;
  float pixel = u_scale / u_resolution.y;

  float n = 0.0;
  bool escaped = false;

  if (u_deep) {
    // Emulated double precision: build c and iterate entirely in df64.
    vec2 px = ds_set(pixel);
    vec2 cx = ds_add(u_cx, ds_mul(ds_set(uv.x), px));
    vec2 cy = ds_add(u_cy, ds_mul(ds_set(uv.y), px));

    vec2 zx, zy, kx, ky;
    if (u_julia) {
      zx = cx; zy = cy;
      kx = ds_set(u_juliaC.x); ky = ds_set(u_juliaC.y);
    } else {
      zx = ds_set(0.0); zy = ds_set(0.0);
      kx = cx; ky = cy;
    }

    for (int i = 0; i < ITER_CAP; i++) {
      if (i >= u_maxIter) break;
      vec2 zx2 = ds_mul(zx, zx);
      vec2 zy2 = ds_mul(zy, zy);
      float m2 = zx2.x + zy2.x;
      if (m2 > 256.0) {
        n = float(i) + 1.0 - log(log(sqrt(m2)) / log(2.0)) / log(2.0);
        escaped = true;
        break;
      }
      vec2 xy = ds_mul(zx, zy);
      zx = ds_add(ds_add(zx2, ds_neg(zy2)), kx);
      zy = ds_add(ds_add(xy, xy), ky);
    }
  } else {
    vec2 c = u_center + uv * pixel;
    vec2 z;
    vec2 k;
    if (u_julia) { z = c; k = u_juliaC; }
    else { z = vec2(0.0); k = c; }

    for (int i = 0; i < ITER_CAP; i++) {
      if (i >= u_maxIter) break;
      // z = z^2 + k
      z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + k;
      float m2 = dot(z, z);
      if (m2 > 256.0) {
        // smooth iteration count
        n = float(i) + 1.0 - log(log(sqrt(m2)) / log(2.0)) / log(2.0);
        escaped = true;
        break;
      }
    }
  }

  if (!escaped) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); // inside the set
    return;
  }

  float t = n * 0.01 * u_colorScale + u_colorShift;
  gl_FragColor = vec4(palette(t), 1.0);
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

export class FractalView {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private opts: FractalViewOptions;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);

  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private state: FractalState = { ...DEFAULT_STATE };
  private params: FractalParams = {
    maxIter: 300,
    palette: 0,
    colorShift: 0,
    colorScale: 1,
    julia: false,
    juliaC: [-0.8, 0.156],
    deep: false,
  };

  private dirty = true;
  private raf = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver;

  // pointer interaction
  private pointers = new Map<number, { x: number; y: number }>();
  private dragStart: {
    px: number;
    py: number;
    cx: number;
    cy: number;
  } | null = null;
  private pinchStartDist = 0;
  private pinchStartScale = 0;

  constructor(container: HTMLElement, opts: FractalViewOptions = {}) {
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
      throw new Error(
        "Program link error: " + gl.getProgramInfoLog(program)
      );
    }
    this.program = program;
    gl.useProgram(program);

    // Full-screen quad
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

    for (const name of [
      "u_resolution",
      "u_center",
      "u_cx",
      "u_cy",
      "u_scale",
      "u_maxIter",
      "u_palette",
      "u_colorShift",
      "u_colorScale",
      "u_julia",
      "u_deep",
      "u_juliaC",
    ]) {
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

    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
    this.resizeObserver.observe(container);
    this.resize();
    this.loop();
  }

  private resize() {
    const w = Math.max(1, Math.floor(this.container.clientWidth * this.dpr));
    const h = Math.max(1, Math.floor(this.container.clientHeight * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.gl.viewport(0, 0, w, h);
      this.dirty = true;
    }
  }

  // Convert a CSS-pixel pointer position to a complex coordinate.
  private toComplex(clientX: number, clientY: number): [number, number] {
    const rect = this.canvas.getBoundingClientRect();
    const px = (clientX - rect.left) * this.dpr;
    // device coords are bottom-up like gl_FragCoord
    const py = (rect.height - (clientY - rect.top)) * this.dpr;
    const pixel = this.state.scale / this.canvas.height;
    const cx = this.state.centerX + (px - this.canvas.width / 2) * pixel;
    const cy = this.state.centerY + (py - this.canvas.height / 2) * pixel;
    return [cx, cy];
  }

  private onPointerDown(e: PointerEvent) {
    this.canvas.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) {
      this.dragStart = {
        px: e.clientX,
        py: e.clientY,
        cx: this.state.centerX,
        cy: this.state.centerY,
      };
    } else if (this.pointers.size === 2) {
      const pts = Array.from(this.pointers.values());
      this.pinchStartDist = Math.hypot(
        pts[0].x - pts[1].x,
        pts[0].y - pts[1].y
      );
      this.pinchStartScale = this.state.scale;
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
        this.state.scale =
          this.pinchStartScale * (this.pinchStartDist / Math.max(dist, 1));
        this.markChanged();
      }
      return;
    }

    if (this.dragStart) {
      const pixel = this.state.scale / this.canvas.height;
      const dx = (e.clientX - this.dragStart.px) * this.dpr;
      const dy = (e.clientY - this.dragStart.py) * this.dpr;
      this.state.centerX = this.dragStart.cx - dx * pixel;
      this.state.centerY = this.dragStart.cy + dy * pixel;
      this.markChanged();
    }
  }

  private onPointerUp(e: PointerEvent) {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinchStartDist = 0;
    if (this.pointers.size === 0) this.dragStart = null;
    else {
      const first = Array.from(this.pointers.values())[0];
      this.dragStart = {
        px: first.x,
        py: first.y,
        cx: this.state.centerX,
        cy: this.state.centerY,
      };
    }
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    const [cx, cy] = this.toComplex(e.clientX, e.clientY);
    const factor = Math.exp(e.deltaY * 0.0015);
    this.state.scale *= factor;
    this.state.scale = Math.min(this.state.scale, 6);
    // keep the complex point under the cursor fixed
    const rect = this.canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * this.dpr;
    const py = (rect.height - (e.clientY - rect.top)) * this.dpr;
    const pixel = this.state.scale / this.canvas.height;
    this.state.centerX = cx - (px - this.canvas.width / 2) * pixel;
    this.state.centerY = cy - (py - this.canvas.height / 2) * pixel;
    this.markChanged();
  }

  private markChanged() {
    this.dirty = true;
    this.opts.onChange?.({ ...this.state });
  }

  setParams(p: Partial<FractalParams>) {
    this.params = { ...this.params, ...p };
    this.dirty = true;
  }

  setState(s: Partial<FractalState>) {
    this.state = { ...this.state, ...s };
    this.markChanged();
  }

  getState(): FractalState {
    return { ...this.state };
  }

  reset() {
    this.state = { ...DEFAULT_STATE };
    this.markChanged();
  }

  /** Zoom by a multiplicative factor about the view centre. */
  zoomBy(factor: number) {
    this.state.scale = Math.min(this.state.scale * factor, 6);
    this.markChanged();
  }

  screenshot(): string {
    this.render(); // ensure the current frame is drawn
    return this.canvas.toDataURL("image/png");
  }

  private render() {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniform2f(
      this.uniforms.u_resolution,
      this.canvas.width,
      this.canvas.height
    );
    gl.uniform2f(this.uniforms.u_center, this.state.centerX, this.state.centerY);
    // df64 split of the centre for the deep-precision path
    const hx = Math.fround(this.state.centerX);
    const hy = Math.fround(this.state.centerY);
    gl.uniform2f(this.uniforms.u_cx, hx, this.state.centerX - hx);
    gl.uniform2f(this.uniforms.u_cy, hy, this.state.centerY - hy);
    gl.uniform1f(this.uniforms.u_scale, this.state.scale);
    gl.uniform1i(this.uniforms.u_maxIter, Math.round(this.params.maxIter));
    gl.uniform1i(this.uniforms.u_palette, this.params.palette);
    gl.uniform1f(this.uniforms.u_colorShift, this.params.colorShift);
    gl.uniform1f(this.uniforms.u_colorScale, this.params.colorScale);
    gl.uniform1i(this.uniforms.u_julia, this.params.julia ? 1 : 0);
    gl.uniform1i(this.uniforms.u_deep, this.params.deep ? 1 : 0);
    gl.uniform2f(
      this.uniforms.u_juliaC,
      this.params.juliaC[0],
      this.params.juliaC[1]
    );
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private loop = () => {
    if (this.disposed) return;
    if (this.dirty) {
      this.dirty = false;
      this.render();
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
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
