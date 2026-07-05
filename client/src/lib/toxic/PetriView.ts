// PetriView — a 2D canvas "what it looks like down the microscope / in a Petri
// dish" renderer. Each specimen kind gets its own stylised field: Gram-stained
// bacteria scattered in a smear, electron-micrograph viral particles, spongiform
// prion brain tissue, fungal spores, brightly stained pollen grains, and a
// histology view of human cells. Deterministic per specimen (seeded RNG) so it
// looks stable, with a slow living drift.

import { specimenById, type Specimen } from "./specimens";

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Particle {
  x: number; // 0..1
  y: number; // 0..1
  rot: number;
  scale: number;
  drift: number;
}

export class PetriView {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private container: HTMLElement;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private spec: Specimen;
  private particles: Particle[] = [];
  private raf = 0;
  private disposed = false;
  private t = 0;
  private ro: ResizeObserver;

  constructor(container: HTMLElement, id: string) {
    this.container = container;
    this.spec = specimenById(id);
    this.canvas = document.createElement("canvas");
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.display = "block";
    container.appendChild(this.canvas);
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas unavailable");
    this.ctx = ctx;
    this.buildParticles();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.loop();
  }

  setSpecimen(id: string) {
    this.spec = specimenById(id);
    this.buildParticles();
  }

  private buildParticles() {
    const rng = mulberry32(hashId(this.spec.id));
    const count = particleCount(this.spec);
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: rng(),
        y: rng(),
        rot: rng() * Math.PI * 2,
        scale: 0.7 + rng() * 0.6,
        drift: rng() * Math.PI * 2,
      });
    }
  }

  private resize() {
    const w = this.container.clientWidth || 600;
    const h = this.container.clientHeight || 600;
    if (w === 0 || h === 0) return; // hidden — keep last good size
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  private loop = () => {
    if (this.disposed) return;
    // keep the backing store in sync (ResizeObserver can miss display toggles)
    const w = this.container.clientWidth;
    if (w > 0 && this.canvas.width !== Math.round(w * this.dpr)) this.resize();
    this.t += 0.006;
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  private draw() {
    const ctx = this.ctx;
    const w = this.container.clientWidth || 600;
    const h = this.container.clientHeight || 600;
    const spec = this.spec;

    // microscope field background
    drawField(ctx, w, h, spec);

    // prion brain tissue is a whole-field spongiform texture, not particles
    if (spec.id === "prion") {
      drawSpongiform(ctx, w, h, this.t);
      drawVignette(ctx, w, h);
      return;
    }
    if (spec.id === "human") {
      drawHumanField(ctx, w, h);
      drawVignette(ctx, w, h);
      return;
    }

    const unit = Math.min(w, h);
    for (const p of this.particles) {
      const wobble = Math.sin(this.t + p.drift) * 0.004;
      const px = (p.x + wobble) * w;
      const py = (p.y + Math.cos(this.t + p.drift) * 0.004) * h;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(p.rot + Math.sin(this.t * 0.3 + p.drift) * 0.05);
      ctx.scale(p.scale, p.scale);
      drawOrganism(ctx, spec, unit);
      ctx.restore();
    }

    // round vignette so it reads as looking down an eyepiece
    drawVignette(ctx, w, h);
  }

  // Render a single static frame to a PNG data URL.
  snapshot(): string {
    this.draw();
    return this.canvas.toDataURL("image/png");
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.canvas.remove();
  }
}

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function particleCount(spec: Specimen): number {
  switch (spec.kind) {
    case "bacterium":
      return 26;
    case "virus":
      return 34;
    case "prion":
      return 1; // a single tissue field, drawn specially
    case "fungus":
      return 30;
    case "pollen":
      return 14;
    case "human":
      return spec.id === "human" ? 1 : spec.id === "dna" ? 10 : 16;
  }
}

function drawField(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  spec: Specimen
) {
  let bg = "#f3ecf6"; // gram smear default (pale violet)
  if (spec.kind === "virus" || spec.id === "prion") bg = "#0c0c0e"; // EM dark field
  else if (spec.kind === "pollen") bg = "#0a1418"; // dark-field, bright grains
  else if (spec.kind === "fungus") bg = "#101a12";
  else if (spec.id === "cell") bg = "#f6e4ec"; // H&E histology pink
  else if (spec.id === "dna") bg = "#0a0f18"; // gel / fluorescence
  else if (spec.id === "human") bg = "#0c1118";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // subtle texture / out-of-focus blobs
  const rng = mulberry32(hashId(spec.id) ^ 0x9e3779b9);
  const dark = spec.kind === "virus" || spec.id === "prion" || spec.kind === "pollen" || spec.kind === "fungus" || spec.id === "dna" || spec.id === "human";
  ctx.globalAlpha = dark ? 0.06 : 0.05;
  for (let i = 0; i < 40; i++) {
    const r = 20 + rng() * 90;
    ctx.fillStyle = dark ? "#ffffff" : "#7a5a7a";
    ctx.beginPath();
    ctx.arc(rng() * w, rng() * h, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.hypot(w, h) / 2;
  const grad = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

// Draw one organism at the canvas origin, sized relative to `unit`.
function drawOrganism(
  ctx: CanvasRenderingContext2D,
  spec: Specimen,
  unit: number
) {
  const c = spec.color;
  const c2 = spec.color2;
  const s = unit;
  switch (spec.id) {
    case "meningococcus": {
      // gram-negative diplococci (pink pairs)
      ctx.fillStyle = c2;
      for (const dx of [-0.022, 0.022]) {
        ellipse(ctx, dx * s, 0, 0.024 * s, 0.022 * s);
      }
      ctx.fillStyle = withAlpha(c, 0.5);
      for (const dx of [-0.022, 0.022]) {
        ellipse(ctx, dx * s, 0, 0.016 * s, 0.014 * s);
      }
      return;
    }
    case "anthrax": {
      // chains of blue rods (gram-positive)
      ctx.fillStyle = c2;
      for (let i = 0; i < 4; i++) capsule(ctx, 0, (i - 1.5) * 0.05 * s, 0.05 * s, 0.018 * s);
      return;
    }
    case "plague": {
      // safety-pin bipolar rods
      ctx.fillStyle = withAlpha(c, 0.7);
      capsule(ctx, 0, 0, 0.06 * s, 0.02 * s);
      ctx.fillStyle = c2;
      ellipse(ctx, 0, -0.03 * s, 0.02 * s, 0.016 * s);
      ellipse(ctx, 0, 0.03 * s, 0.02 * s, 0.016 * s);
      return;
    }
    case "cholera": {
      // comma vibrios
      ctx.strokeStyle = c2;
      ctx.lineWidth = 0.018 * s;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(0, 0, 0.045 * s, Math.PI * 0.15, Math.PI * 1.25);
      ctx.stroke();
      return;
    }
    case "botulinum": {
      // drumstick rods with terminal spore
      ctx.fillStyle = withAlpha(c, 0.8);
      capsule(ctx, 0, 0.01 * s, 0.07 * s, 0.02 * s);
      ctx.fillStyle = c2;
      ellipse(ctx, 0, -0.05 * s, 0.026 * s, 0.026 * s);
      return;
    }
    case "sarscov2": {
      virion(ctx, c, c2, 0.05 * s, 16, "club");
      return;
    }
    case "hiv": {
      virion(ctx, c, c2, 0.05 * s, 12, "knob");
      return;
    }
    case "smallpox": {
      // brick-shaped particles
      ctx.fillStyle = withAlpha(c, 0.85);
      roundRect(ctx, -0.05 * s, -0.035 * s, 0.1 * s, 0.07 * s, 0.015 * s);
      ctx.fill();
      ctx.strokeStyle = withAlpha(c2, 0.8);
      ctx.lineWidth = 0.006 * s;
      ctx.stroke();
      return;
    }
    case "rabies": {
      // bullet shapes
      ctx.fillStyle = withAlpha(c, 0.9);
      bullet(ctx, 0.09 * s, 0.04 * s);
      return;
    }
    case "ebola": {
      // long filaments with a hook
      ctx.strokeStyle = withAlpha(c, 0.9);
      ctx.lineWidth = 0.014 * s;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, 0.09 * s);
      ctx.lineTo(0, -0.05 * s);
      ctx.arc(0.03 * s, -0.05 * s, 0.03 * s, Math.PI, 0, false);
      ctx.stroke();
      return;
    }
    case "prion":
      return; // handled by spongiform field below
    case "deathcap": {
      // amyloid spores (ovoid, faint blue from Melzer's reagent)
      ctx.fillStyle = withAlpha(c, 0.85);
      ellipse(ctx, 0, 0, 0.03 * s, 0.022 * s);
      ctx.fillStyle = withAlpha(c2, 0.5);
      ellipse(ctx, 0.006 * s, 0, 0.012 * s, 0.01 * s);
      return;
    }
    case "ragweed": {
      pollenGrain(ctx, c, c2, 0.06 * s, "echinate");
      return;
    }
    case "grasspollen": {
      pollenGrain(ctx, c, c2, 0.07 * s, "smooth");
      return;
    }
    case "birchpollen": {
      pollenGrain(ctx, c, c2, 0.06 * s, "triporate");
      return;
    }
    case "dna": {
      dnaStrand(ctx, 0.16 * s);
      return;
    }
    case "cell": {
      // H&E cell: pink cytoplasm, purple nucleus
      ctx.fillStyle = withAlpha("#e7a6c4", 0.8);
      ellipse(ctx, 0, 0, 0.06 * s, 0.05 * s);
      ctx.fillStyle = withAlpha("#5a2f6b", 0.95);
      ellipse(ctx, 0.012 * s, 0, 0.022 * s, 0.02 * s);
      return;
    }
    default:
      return;
  }
}

// --- shape helpers ------------------------------------------------------

function ellipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number
) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function capsule(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  halfLen: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x - r, y - halfLen);
  ctx.lineTo(x + r, y - halfLen);
  ctx.arc(x, y - halfLen, r, 0, Math.PI, false);
  ctx.lineTo(x + r, y + halfLen);
  ctx.arc(x, y + halfLen, r, 0, Math.PI, true);
  ctx.closePath();
  // simpler: draw rounded rect
  ctx.beginPath();
  roundRect(ctx, x - r, y - halfLen - r, r * 2, (halfLen + r) * 2, r);
  ctx.fill();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function bullet(ctx: CanvasRenderingContext2D, len: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(-r, len / 2);
  ctx.lineTo(-r, -len / 2 + r);
  ctx.arc(0, -len / 2 + r, r, Math.PI, 0, false);
  ctx.lineTo(r, len / 2);
  ctx.closePath();
  ctx.fill();
}

function virion(
  ctx: CanvasRenderingContext2D,
  c: string,
  c2: string,
  r: number,
  spikes: number,
  kind: "club" | "knob"
) {
  // spikes
  ctx.strokeStyle = withAlpha(c2, 0.9);
  ctx.fillStyle = withAlpha(c2, 0.9);
  ctx.lineWidth = r * 0.12;
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2;
    const x1 = Math.cos(a) * r;
    const y1 = Math.sin(a) * r;
    const x2 = Math.cos(a) * r * 1.4;
    const y2 = Math.sin(a) * r * 1.4;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x2, y2, kind === "club" ? r * 0.18 : r * 0.14, 0, Math.PI * 2);
    ctx.fill();
  }
  // body
  const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  grad.addColorStop(0, withAlpha(c, 0.95));
  grad.addColorStop(1, withAlpha(c2, 0.5));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
}

function pollenGrain(
  ctx: CanvasRenderingContext2D,
  c: string,
  c2: string,
  r: number,
  kind: "echinate" | "smooth" | "triporate"
) {
  if (kind === "echinate") {
    ctx.fillStyle = c2;
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      const x = Math.cos(a) * r * 1.18;
      const y = Math.sin(a) * r * 1.18;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.15, 0, 0, r);
  grad.addColorStop(0, lighten(c));
  grad.addColorStop(1, c);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  if (kind === "triporate") {
    ctx.fillStyle = c2;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r, Math.sin(a) * r, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === "smooth") {
    ctx.fillStyle = c2;
    ctx.beginPath();
    ctx.arc(r * 0.7, 0, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
}

function dnaStrand(ctx: CanvasRenderingContext2D, h: number) {
  const turns = 2;
  const amp = h * 0.18;
  ctx.lineWidth = h * 0.04;
  ctx.lineCap = "round";
  for (const off of [0, Math.PI]) {
    ctx.strokeStyle = off === 0 ? "#5ad1ff" : "#ff7aa8";
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const y = -h / 2 + t * h;
      const x = Math.sin(t * turns * Math.PI * 2 + off) * amp;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = withAlpha("#ffd166", 0.8);
  ctx.lineWidth = h * 0.02;
  for (let i = 2; i < 40; i += 4) {
    const t = i / 40;
    const y = -h / 2 + t * h;
    const x1 = Math.sin(t * turns * Math.PI * 2) * amp;
    const x2 = Math.sin(t * turns * Math.PI * 2 + Math.PI) * amp;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
  }
}

// Spongiform encephalopathy: brain tissue riddled with vacuolar holes.
function drawSpongiform(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number
) {
  ctx.fillStyle = "#e9c9d6"; // H&E neuropil pink
  ctx.fillRect(0, 0, w, h);
  const rng = mulberry32(0xb5e0);
  // neurons (small dark nuclei)
  ctx.fillStyle = "rgba(90,40,80,0.7)";
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    ctx.arc(rng() * w, rng() * h, 3 + rng() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // the vacuoles — the "holes" that give it the sponge look
  for (let i = 0; i < 70; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const r = 6 + rng() * 26 + Math.sin(t + i) * 1.5;
    const grad = ctx.createRadialGradient(x, y, 1, x, y, r);
    grad.addColorStop(0, "rgba(255,250,252,0.95)");
    grad.addColorStop(0.7, "rgba(240,215,225,0.6)");
    grad.addColorStop(1, "rgba(233,201,214,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// "You" under the lens: a body silhouette made of the same organic matter.
function drawHumanField(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
) {
  const cx = w / 2;
  const cy = h / 2;
  const s = Math.min(w, h) * 0.42;
  ctx.save();
  ctx.translate(cx, cy);
  const grad = ctx.createLinearGradient(0, -s, 0, s);
  grad.addColorStop(0, "#9ec3ef");
  grad.addColorStop(1, "#1B3F6B");
  ctx.fillStyle = grad;
  // head
  ctx.beginPath();
  ctx.arc(0, -s * 0.72, s * 0.16, 0, Math.PI * 2);
  ctx.fill();
  // body
  roundRect(ctx, -s * 0.18, -s * 0.5, s * 0.36, s * 0.62, s * 0.12);
  ctx.fill();
  // arms
  roundRect(ctx, -s * 0.46, -s * 0.46, s * 0.16, s * 0.5, s * 0.08);
  ctx.fill();
  roundRect(ctx, s * 0.3, -s * 0.46, s * 0.16, s * 0.5, s * 0.08);
  ctx.fill();
  // legs
  roundRect(ctx, -s * 0.16, s * 0.06, s * 0.14, s * 0.6, s * 0.07);
  ctx.fill();
  roundRect(ctx, s * 0.02, s * 0.06, s * 0.14, s * 0.6, s * 0.07);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "rgba(220,225,235,0.7)";
  ctx.font = `${Math.round(Math.min(w, h) * 0.03)}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.fillText("~37 trillion cells of organic matter", cx, h - 24);
  ctx.textAlign = "start";
}

function withAlpha(hex: string, a: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function lighten(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${Math.min(255, r + 50)},${Math.min(255, g + 50)},${Math.min(
    255,
    b + 50
  )})`;
}
function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}
