// ScaleView — a powers-of-ten logarithmic ruler that places every specimen on
// the same axis as familiar human references (you, a hair's width, a red blood
// cell, …) so you can *see* how absurdly tiny a virus is next to a person, and
// how a pollen grain compares to a bacterium. The currently selected specimen
// is highlighted.

import { SPECIMENS, specimenById, type Specimen } from "./specimens";

interface RefPoint {
  label: string;
  sizeM: number;
  color: string;
}

// Familiar yardsticks, smallest to largest.
const REFERENCES: RefPoint[] = [
  { label: "Carbon atom", sizeM: 0.34e-9, color: "#7f8aa0" },
  { label: "DNA width", sizeM: 2e-9, color: "#8fd3ff" },
  { label: "Antibody", sizeM: 10e-9, color: "#9aa7bf" },
  { label: "Virus", sizeM: 100e-9, color: "#9fb6e8" },
  { label: "Bacterium", sizeM: 1e-6, color: "#e7b3c2" },
  { label: "Red blood cell", sizeM: 7e-6, color: "#d8483f" },
  { label: "Human cell", sizeM: 10e-6, color: "#bfe0ff" },
  { label: "Pollen grain", sizeM: 25e-6, color: "#f2d98a" },
  { label: "Dust mite", sizeM: 300e-6, color: "#b59a6b" },
  { label: "Hair width", sizeM: 80e-6, color: "#caa46a" },
  { label: "Grain of salt", sizeM: 0.5e-3, color: "#dfe4ea" },
  { label: "Ant", sizeM: 4e-3, color: "#6b4a2a" },
  { label: "Your hand", sizeM: 0.18, color: "#d8c2a8" },
  { label: "You", sizeM: 1.7, color: "#1B3F6B" },
];

const MIN_M = 1e-10; // 0.1 nm
const MAX_M = 3; // 3 m

export class ScaleView {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private container: HTMLElement;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private spec: Specimen;
  private ro: ResizeObserver;
  private raf = 0;
  private disposed = false;
  private t = 0;
  // Left inset so the ruler + label card clear the floating specimen sidebar.
  private insetLeft = 16;

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
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.loop();
  }

  setSpecimen(id: string) {
    this.spec = specimenById(id);
  }

  /** Reserve space on the left for the floating specimen sidebar (px). */
  setInsetLeft(px: number) {
    this.insetLeft = Math.max(12, px);
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
    this.t += 0.02;
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  // map a size in metres to a y position (top = big, bottom = small)
  private yFor(sizeM: number, top: number, bottom: number): number {
    const f =
      (Math.log10(sizeM) - Math.log10(MIN_M)) /
      (Math.log10(MAX_M) - Math.log10(MIN_M));
    return bottom - f * (bottom - top);
  }

  private draw() {
    const ctx = this.ctx;
    const w = this.container.clientWidth || 600;
    const h = this.container.clientHeight || 600;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#070a10";
    ctx.fillRect(0, 0, w, h);

    const top = 48;
    const bottom = h - 40;
    // Lay the whole ruler out in the region to the right of the sidebar.
    const left = Math.min(this.insetLeft, w - 150);
    const right = w - 12;
    const region = Math.max(120, right - left);
    // Axis ~42% across the region — leaves room for the label card + decade
    // labels on its left and the reference labels on its right.
    const axisX = left + Math.max(88, Math.min(region * 0.42, region - 180));

    // axis line
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(axisX, top);
    ctx.lineTo(axisX, bottom);
    ctx.stroke();

    // decade ticks (10^-10 .. 10^0 m)
    ctx.font = "11px ui-monospace, monospace";
    ctx.textBaseline = "middle";
    for (let e = -10; e <= 0; e++) {
      const y = this.yFor(Math.pow(10, e), top, bottom);
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.beginPath();
      ctx.moveTo(axisX - 6, y);
      ctx.lineTo(right, y);
      ctx.stroke();
      ctx.fillStyle = "rgba(160,170,190,0.7)";
      ctx.textAlign = "right";
      ctx.fillText(decadeLabel(e), axisX - 10, y);
    }

    // reference points on the right
    ctx.textAlign = "left";
    for (const r of REFERENCES) {
      const y = this.yFor(r.sizeM, top, bottom);
      ctx.fillStyle = r.color;
      ctx.beginPath();
      ctx.arc(axisX, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(200,208,222,0.85)";
      ctx.fillText(r.label, axisX + 12, y);
    }

    // all specimens as faint dots on the left of the axis
    for (const s of SPECIMENS) {
      if (s.id === this.spec.id) continue;
      const y = this.yFor(s.sizeM, top, bottom);
      ctx.fillStyle = "rgba(201,168,76,0.35)";
      ctx.beginPath();
      ctx.arc(axisX - 16, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // the selected specimen: bright marker + leader + label card
    const sy = this.yFor(this.spec.sizeM, top, bottom);
    const pulse = 6 + Math.sin(this.t) * 1.5;
    ctx.fillStyle = this.spec.color;
    ctx.strokeStyle = "#C9A84C";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(axisX - 16, sy, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // label card in the left gutter, clear of the sidebar and the top bar
    const cardX = left;
    const cardY = 104;
    const cardW = Math.max(120, Math.min(240, axisX - left - 26));
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    roundRect(ctx, cardX, cardY, cardW, 56, 8);
    ctx.fill();
    ctx.fillStyle = "#e8ecf3";
    ctx.font = "600 14px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillText(this.spec.name, cardX + 12, cardY + 20);
    ctx.fillStyle = "#C9A84C";
    ctx.font = "13px ui-monospace, monospace";
    ctx.fillText(this.spec.sizeLabel, cardX + 12, cardY + 40);

    // leader from card to marker
    ctx.strokeStyle = "rgba(201,168,76,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cardX + Math.min(130, cardW - 8), cardY + 56);
    ctx.lineTo(axisX - 16, sy);
    ctx.stroke();

    // "how many fit in you" factoid, under the label card
    const ratio = 1.7 / this.spec.sizeM;
    if (this.spec.id !== "human" && ratio > 5) {
      ctx.fillStyle = "rgba(180,190,210,0.85)";
      ctx.font = "11px ui-monospace, monospace";
      ctx.textAlign = "left";
      wrapText(
        ctx,
        `≈ ${formatBig(ratio)} of these would span your height`,
        cardX + 2,
        cardY + 78,
        Math.max(120, axisX - left - 20),
        15
      );
    }
    ctx.textAlign = "left";
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.canvas.remove();
  }
}

function decadeLabel(e: number): string {
  const map: Record<number, string> = {
    [-10]: "1 Å",
    [-9]: "1 nm",
    [-6]: "1 µm",
    [-3]: "1 mm",
    [0]: "1 m",
  };
  if (map[e]) return map[e];
  return `10^${e} m`;
}

function formatBig(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(0) + " billion";
  if (n >= 1e6) return (n / 1e6).toFixed(0) + " million";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + " thousand";
  return n.toFixed(0);
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

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(" ");
  let line = "";
  let yy = y;
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}
