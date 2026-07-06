// TimelineView — a chronological ribbon of every engine in the catalogue, laid
// out left-to-right in the order they first appeared, each colour-coded by
// category. The selected engine is highlighted, and clicking any marker selects
// it. Mirrors the canvas lifecycle of the /toxic ScaleView.

import { CATEGORY_LABEL, ENGINES, engineById, type Engine, type EngineCategory } from "./engines";

const CATEGORY_COLOR: Record<EngineCategory, string> = {
  six: "#c9a84c",
  v8: "#e0663a",
  racing: "#e0c24a",
  aero: "#5aa9d6",
  stationary: "#5fae74",
  novel: "#c65cbe",
  v6: "#9aa0a8",
};

function startYear(e: Engine): number {
  const m = e.years.match(/\d{4}/);
  return m ? parseInt(m[0], 10) : 1900;
}

export class TimelineView {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private container: HTMLElement;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private engine: Engine;
  private ordered: Engine[];
  private ro: ResizeObserver;
  private raf = 0;
  private disposed = false;
  private t = 0;
  private insetLeft = 16;
  private onSelect?: (id: string) => void;
  // last-drawn marker hit boxes: [x, y, id]
  private hits: { x: number; y: number; id: string }[] = [];

  constructor(container: HTMLElement, id: string) {
    this.container = container;
    this.engine = engineById(id);
    this.ordered = [...ENGINES].sort((a, b) => startYear(a) - startYear(b));
    this.canvas = document.createElement("canvas");
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.display = "block";
    this.canvas.style.cursor = "pointer";
    container.appendChild(this.canvas);
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas unavailable");
    this.ctx = ctx;
    this.canvas.addEventListener("click", this.handleClick);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.loop();
  }

  setEngine(id: string) {
    this.engine = engineById(id);
  }

  setSelectHandler(fn: (id: string) => void) {
    this.onSelect = fn;
  }

  setInsetLeft(px: number) {
    this.insetLeft = Math.max(12, px);
  }

  private handleClick = (ev: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    const py = ev.clientY - rect.top;
    let best: { id: string; d: number } | null = null;
    for (const h of this.hits) {
      const d = Math.hypot(h.x - px, h.y - py);
      if (!best || d < best.d) best = { id: h.id, d };
    }
    if (best && best.d < 60 && this.onSelect) this.onSelect(best.id);
  };

  private resize() {
    const w = this.container.clientWidth || 600;
    const h = this.container.clientHeight || 600;
    if (w === 0 || h === 0) return;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  private loop = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth;
    if (w > 0 && this.canvas.width !== Math.round(w * this.dpr)) this.resize();
    this.t += 0.02;
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  private draw() {
    const ctx = this.ctx;
    const w = this.container.clientWidth || 600;
    const h = this.container.clientHeight || 600;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#070a10";
    ctx.fillRect(0, 0, w, h);

    const left = Math.min(this.insetLeft, w - 160) + 8;
    const right = w - 16;
    const region = Math.max(160, right - left);
    const n = this.ordered.length;
    const colW = region / n;
    const axisY = 200;

    // title
    ctx.fillStyle = "#e8ecf3";
    ctx.font = "600 15px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillText("A century of Australian engines", left, 108);
    ctx.fillStyle = "rgba(160,170,190,0.75)";
    ctx.font = "11px ui-monospace, monospace";
    ctx.fillText("In order of first appearance · tap any marker", left, 128);

    // axis line
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, axisY);
    ctx.lineTo(right, axisY);
    ctx.stroke();

    this.hits = [];
    ctx.textBaseline = "alphabetic";
    for (let i = 0; i < n; i++) {
      const e = this.ordered[i];
      const x = left + (i + 0.5) * colW;
      const selected = e.id === this.engine.id;
      const col = CATEGORY_COLOR[e.category];
      this.hits.push({ x, y: axisY, id: e.id });

      // stem
      ctx.strokeStyle = selected ? "#C9A84C" : "rgba(255,255,255,0.12)";
      ctx.lineWidth = selected ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, axisY);
      ctx.lineTo(x, axisY - 14);
      ctx.stroke();

      // year above
      ctx.fillStyle = selected ? "#E7C766" : "rgba(180,190,210,0.7)";
      ctx.font = selected ? "600 11px ui-monospace, monospace" : "10px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.save();
      ctx.translate(x, axisY - 20);
      ctx.rotate(-Math.PI / 4);
      ctx.fillText(String(startYear(e)), 0, 0);
      ctx.restore();

      // marker
      const r = selected ? 6 + Math.sin(this.t) * 1.2 : 4;
      ctx.beginPath();
      ctx.arc(x, axisY, r, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      if (selected) {
        ctx.strokeStyle = "#C9A84C";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // name below (rotated vertical)
      ctx.save();
      ctx.translate(x + 3, axisY + 14);
      ctx.rotate(Math.PI / 2);
      ctx.textAlign = "left";
      ctx.fillStyle = selected ? "#e8ecf3" : "rgba(200,208,222,0.7)";
      ctx.font = selected ? "600 11px ui-monospace, monospace" : "10px ui-monospace, monospace";
      ctx.fillText(e.name, 0, 0);
      ctx.restore();
    }

    // legend (bottom)
    let lx = left;
    const ly = h - 16;
    ctx.font = "10px ui-monospace, monospace";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    for (const cat of Object.keys(CATEGORY_COLOR) as EngineCategory[]) {
      const label = CATEGORY_LABEL[cat];
      ctx.fillStyle = CATEGORY_COLOR[cat];
      ctx.beginPath();
      ctx.arc(lx, ly, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(200,208,222,0.8)";
      ctx.fillText(label, lx + 9, ly);
      lx += 18 + ctx.measureText(label).width + 16;
      if (lx > right - 100) {
        lx = left;
      }
    }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.canvas.removeEventListener("click", this.handleClick);
    this.canvas.remove();
  }
}
