// SkyView — a "look straight up" planetarium rendered on a 2D canvas.
//
// Real star catalogue (to mag 6), constellation stick-figures and Messier
// deep-sky objects are projected from equatorial coordinates to the local
// horizon (alt/az) for a given latitude, longitude and instant, then drawn on
// an azimuthal dome with the zenith at the centre and the horizon at the rim.
// Sun, Moon and planets are computed live with astronomy-engine.

import * as Astronomy from "astronomy-engine";
import { ASTERISMS, CONSTELLATION_MYTH } from "./myth";

export interface Star {
  r: number; // RA, degrees (-180..180)
  d: number; // Dec, degrees
  m: number; // visual magnitude
  n?: string; // proper name
  b?: string; // Bayer (greek letter)
  c?: string; // constellation abbr.
}

export interface Constellation {
  id: string;
  name: string;
  lines: number[][][]; // MultiLineString of [ra, dec]
}

export interface Messier {
  id: string;
  ngc: string;
  name: string;
  type: string;
  m: number | null;
  r: number; // RA degrees (0..360)
  d: number; // Dec degrees
  con: string;
}

export interface SkyData {
  stars: Star[];
  constellations: Constellation[];
  messier: Messier[];
}

export interface SkyOptions {
  lat: number;
  lon: number;
  locationName: string;
  showConstellations: boolean;
  showLabels: boolean;
  showPlanets: boolean;
  showDSO: boolean;
  onSelect?: (info: SelectedInfo | null) => void;
}

export interface SelectedInfo {
  kind: "star" | "planet" | "moon" | "sun" | "dso" | "constellation";
  title: string;
  subtitle?: string;
  facts: string[];
  myth?: string;
}

interface HitTarget {
  x: number;
  y: number;
  hitR: number;
  info: SelectedInfo;
}

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

const PLANETS: { body: Astronomy.Body; name: string; color: string }[] = [
  { body: Astronomy.Body.Mercury, name: "Mercury", color: "#b9a78c" },
  { body: Astronomy.Body.Venus, name: "Venus", color: "#fff2c4" },
  { body: Astronomy.Body.Mars, name: "Mars", color: "#ff6a4d" },
  { body: Astronomy.Body.Jupiter, name: "Jupiter", color: "#f3d8a7" },
  { body: Astronomy.Body.Saturn, name: "Saturn", color: "#f0e0b0" },
  { body: Astronomy.Body.Uranus, name: "Uranus", color: "#a9e6ff" },
  { body: Astronomy.Body.Neptune, name: "Neptune", color: "#6f8cff" },
];

// Map asterism member star-names so we can look them up in the catalogue.
const ASTERISM_BY_STAR = new Map<string, string>();
for (const a of ASTERISMS) {
  for (const s of a.stars) if (!ASTERISM_BY_STAR.has(s)) ASTERISM_BY_STAR.set(s, a.name);
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

export class SkyView {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private data: SkyData;
  private opts: SkyOptions;
  private time: Date = new Date();

  private cx = 0;
  private cy = 0;
  private R = 0;
  private hits: HitTarget[] = [];
  private selectedTitle: string | null = null;
  private ro: ResizeObserver;
  private disposed = false;

  constructor(container: HTMLElement, data: SkyData, opts: SkyOptions) {
    this.container = container;
    this.data = data;
    this.opts = opts;

    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.style.touchAction = "none";
    container.appendChild(canvas);
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas not supported");
    this.ctx = ctx;

    this.onClick = this.onClick.bind(this);
    canvas.addEventListener("click", this.onClick);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
  }

  setTime(t: Date) {
    this.time = t;
    this.draw();
  }

  setOptions(p: Partial<SkyOptions>) {
    this.opts = { ...this.opts, ...p };
    this.draw();
  }

  clearSelection() {
    this.selectedTitle = null;
    this.draw();
  }

  private resize() {
    const w = this.container.clientWidth || 600;
    const h = this.container.clientHeight || 600;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.cx = this.canvas.width / 2;
    this.cy = this.canvas.height / 2;
    this.R = (Math.min(this.canvas.width, this.canvas.height) / 2) * 0.94;
    this.draw();
  }

  // Equatorial (deg) -> horizontal alt/az (deg) for the given sidereal time.
  private altaz(
    raDeg: number,
    decDeg: number,
    gastDeg: number,
    sinLat: number,
    cosLat: number
  ): { alt: number; az: number } {
    const H = (gastDeg + this.opts.lon - raDeg) * DEG;
    const dec = decDeg * DEG;
    const sinDec = Math.sin(dec);
    const cosDec = Math.cos(dec);
    const sinAlt = sinDec * sinLat + cosDec * cosLat * Math.cos(H);
    const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
    const cosAlt = Math.cos(alt);
    const sinA = (-cosDec * Math.sin(H)) / cosAlt;
    const cosA = (sinDec - sinLat * sinAlt) / (cosLat * cosAlt);
    let az = Math.atan2(sinA, cosA);
    if (az < 0) az += 2 * Math.PI;
    return { alt: alt * RAD, az: az * RAD };
  }

  // alt/az (deg) -> screen pixel. Looking up: N at top, E to the left.
  private project(alt: number, az: number): { x: number; y: number } {
    const r = ((90 - alt) / 90) * this.R;
    const a = az * DEG;
    return { x: this.cx - r * Math.sin(a), y: this.cy - r * Math.cos(a) };
  }

  private draw() {
    if (this.disposed) return;
    const ctx = this.ctx;
    const W = this.canvas.width;
    const Hh = this.canvas.height;
    this.hits = [];

    const observer = new Astronomy.Observer(this.opts.lat, this.opts.lon, 0);
    const gastDeg = Astronomy.SiderealTime(this.time) * 15;
    const latRad = this.opts.lat * DEG;
    const sinLat = Math.sin(latRad);
    const cosLat = Math.cos(latRad);

    // Sun altitude drives day / twilight / night shading.
    const sunEq = Astronomy.Equator(
      Astronomy.Body.Sun,
      this.time,
      observer,
      true,
      true
    );
    const sun = this.altaz(sunEq.ra * 15, sunEq.dec, gastDeg, sinLat, cosLat);
    const sunAlt = sun.alt;
    // 0 in deep night, 1 in full day.
    const dayness = clamp01((sunAlt + 6) / 12);
    const starAlpha = clamp01((-sunAlt - 4) / 8);

    ctx.clearRect(0, 0, W, Hh);
    this.drawSkyBackground(dayness, sunAlt);

    // Clip everything to the dome.
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.R, 0, 2 * Math.PI);
    ctx.clip();

    if (this.opts.showConstellations && starAlpha > 0.02)
      this.drawConstellations(gastDeg, sinLat, cosLat, starAlpha);
    if (starAlpha > 0.01) this.drawStars(gastDeg, sinLat, cosLat, starAlpha);
    if (this.opts.showDSO && starAlpha > 0.05)
      this.drawMessier(gastDeg, sinLat, cosLat, starAlpha);
    if (this.opts.showPlanets)
      this.drawSolarSystem(observer, gastDeg, sinLat, cosLat);

    ctx.restore();

    this.drawHorizon();
  }

  private drawSkyBackground(dayness: number, sunAlt: number) {
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(
      this.cx,
      this.cy,
      0,
      this.cx,
      this.cy,
      this.R
    );
    // night -> day zenith colours
    const lerp = (a: number, b: number) => Math.round(a + (b - a) * dayness);
    const zen = `rgb(${lerp(5, 64)},${lerp(7, 132)},${lerp(16, 205)})`;
    const hor = `rgb(${lerp(14, 142)},${lerp(20, 186)},${lerp(38, 232)})`;
    // warm glow near the horizon around sunrise/sunset
    const twilight = clamp01(1 - Math.abs(sunAlt) / 8);
    g.addColorStop(0, zen);
    g.addColorStop(0.78, hor);
    if (twilight > 0.05 && dayness < 0.7) {
      g.addColorStop(
        1,
        `rgba(${200},${120},${70},${0.5 * twilight})`
      );
    } else {
      g.addColorStop(1, hor);
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.R, 0, 2 * Math.PI);
    ctx.fill();
  }

  private drawStars(
    gastDeg: number,
    sinLat: number,
    cosLat: number,
    alpha: number
  ) {
    const ctx = this.ctx;
    const showLabels = this.opts.showLabels;
    for (const s of this.data.stars) {
      const { alt, az } = this.altaz(s.r, s.d, gastDeg, sinLat, cosLat);
      if (alt <= 0) continue;
      const { x, y } = this.project(alt, az);
      const size = Math.max(0.6, (6.6 - s.m) * 0.42) * this.dpr;
      const a = alpha * clamp01(1.1 - s.m / 7);
      ctx.beginPath();
      ctx.fillStyle = `rgba(228,236,255,${a})`;
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      ctx.fill();
      if (s.m < 2.2) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(228,236,255,${a * 0.18})`;
        ctx.arc(x, y, size * 2.4, 0, 2 * Math.PI);
        ctx.fill();
      }

      if (s.n || s.m < 4) {
        this.hits.push({
          x,
          y,
          hitR: Math.max(10 * this.dpr, size + 6 * this.dpr),
          info: this.starInfo(s),
        });
      }

      if (showLabels && s.n && s.m < 2.0 && alpha > 0.5) {
        ctx.fillStyle = `rgba(200,168,76,${alpha})`;
        ctx.font = `${11 * this.dpr}px ui-monospace, monospace`;
        ctx.fillText(s.n, x + size + 3 * this.dpr, y - 3 * this.dpr);
      }

      if (this.selectedTitle === this.starTitle(s))
        this.drawSelectionRing(x, y, size + 5 * this.dpr);
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

  private drawConstellations(
    gastDeg: number,
    sinLat: number,
    cosLat: number,
    alpha: number
  ) {
    const ctx = this.ctx;
    ctx.lineWidth = Math.max(1, this.dpr * 0.8);
    ctx.strokeStyle = `rgba(120,150,210,${0.32 * alpha})`;
    for (const con of this.data.constellations) {
      for (const seg of con.lines) {
        ctx.beginPath();
        let pen = false;
        for (const [ra, dec] of seg) {
          const { alt, az } = this.altaz(ra, dec, gastDeg, sinLat, cosLat);
          if (alt <= 0) {
            pen = false;
            continue;
          }
          const { x, y } = this.project(alt, az);
          if (!pen) {
            ctx.moveTo(x, y);
            pen = true;
          } else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
  }

  private drawMessier(
    gastDeg: number,
    sinLat: number,
    cosLat: number,
    alpha: number
  ) {
    const ctx = this.ctx;
    for (const o of this.data.messier) {
      const { alt, az } = this.altaz(o.r, o.d, gastDeg, sinLat, cosLat);
      if (alt <= 0) continue;
      const { x, y } = this.project(alt, az);
      const rr = 3.2 * this.dpr;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(150,230,180,${0.8 * alpha})`;
      ctx.lineWidth = 1.2 * this.dpr;
      ctx.arc(x, y, rr, 0, 2 * Math.PI);
      ctx.stroke();
      this.hits.push({
        x,
        y,
        hitR: 11 * this.dpr,
        info: this.messierInfo(o),
      });
      if (this.selectedTitle === (o.name || o.id))
        this.drawSelectionRing(x, y, rr + 5 * this.dpr);
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
    observer: Astronomy.Observer,
    gastDeg: number,
    sinLat: number,
    cosLat: number
  ) {
    const ctx = this.ctx;

    // Sun
    const sunEq = Astronomy.Equator(
      Astronomy.Body.Sun,
      this.time,
      observer,
      true,
      true
    );
    const sun = this.altaz(sunEq.ra * 15, sunEq.dec, gastDeg, sinLat, cosLat);
    if (sun.alt > -1) {
      const { x, y } = this.project(sun.alt, sun.az);
      const rr = 7 * this.dpr;
      const grd = ctx.createRadialGradient(x, y, 0, x, y, rr * 3);
      grd.addColorStop(0, "rgba(255,236,150,1)");
      grd.addColorStop(0.3, "rgba(255,214,90,0.9)");
      grd.addColorStop(1, "rgba(255,214,90,0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x, y, rr * 3, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = "#fff0b0";
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, 2 * Math.PI);
      ctx.fill();
      this.hits.push({
        x,
        y,
        hitR: 14 * this.dpr,
        info: {
          kind: "sun",
          title: "The Sun",
          subtitle: "Our star",
          facts: [`Altitude ${sun.alt.toFixed(0)}°`, "G-type main-sequence star"],
        },
      });
      if (this.selectedTitle === "The Sun")
        this.drawSelectionRing(x, y, rr + 6 * this.dpr);
    }

    // Moon
    const moonEq = Astronomy.Equator(
      Astronomy.Body.Moon,
      this.time,
      observer,
      true,
      true
    );
    const moon = this.altaz(moonEq.ra * 15, moonEq.dec, gastDeg, sinLat, cosLat);
    if (moon.alt > -1) {
      const { x, y } = this.project(moon.alt, moon.az);
      const illum = Astronomy.Illumination(Astronomy.Body.Moon, this.time);
      const phase = Astronomy.MoonPhase(this.time); // 0..360 elongation
      const waxing = phase < 180;
      this.drawMoon(x, y, 6 * this.dpr, illum.phase_fraction, waxing);
      this.hits.push({
        x,
        y,
        hitR: 14 * this.dpr,
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
      if (this.selectedTitle === "The Moon")
        this.drawSelectionRing(x, y, 6 * this.dpr + 6 * this.dpr);
    }

    if (!this.opts.showPlanets) return;
    for (const p of PLANETS) {
      const eq = Astronomy.Equator(p.body, this.time, observer, true, true);
      const pa = this.altaz(eq.ra * 15, eq.dec, gastDeg, sinLat, cosLat);
      if (pa.alt <= 0) continue;
      const { x, y } = this.project(pa.alt, pa.az);
      let mag = 0;
      try {
        mag = Astronomy.Illumination(p.body, this.time).mag;
      } catch {
        mag = 2;
      }
      const rr = Math.max(2.2, 4.2 - mag * 0.5) * this.dpr;
      ctx.beginPath();
      ctx.fillStyle = p.color;
      ctx.arc(x, y, rr, 0, 2 * Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = p.color
        .replace("rgb", "rgba")
        .replace(")", ",0.2)");
      // soft halo (color is hex, so just draw faint white)
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.arc(x, y, rr * 2, 0, 2 * Math.PI);
      ctx.fill();

      if (this.opts.showLabels) {
        ctx.fillStyle = "rgba(220,200,150,0.9)";
        ctx.font = `${11 * this.dpr}px ui-monospace, monospace`;
        ctx.fillText(p.name, x + rr + 3 * this.dpr, y - 3 * this.dpr);
      }
      this.hits.push({
        x,
        y,
        hitR: 13 * this.dpr,
        info: {
          kind: "planet",
          title: p.name,
          subtitle: "Planet",
          facts: [`Magnitude ${mag.toFixed(1)}`, `Altitude ${pa.alt.toFixed(0)}°`],
        },
      });
      if (this.selectedTitle === p.name)
        this.drawSelectionRing(x, y, rr + 5 * this.dpr);
    }
  }

  private drawMoon(
    x: number,
    y: number,
    rad: number,
    frac: number,
    waxing: boolean
  ) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    if (!waxing) ctx.scale(-1, 1);
    // dark disk
    ctx.beginPath();
    ctx.fillStyle = "#3b3b44";
    ctx.arc(0, 0, rad, 0, 2 * Math.PI);
    ctx.fill();
    // lit portion (right limb when waxing)
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

  private drawSelectionRing(x: number, y: number, r: number) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.strokeStyle = "#C9A84C";
    ctx.lineWidth = 1.6 * this.dpr;
    ctx.arc(x, y, r + 2 * this.dpr, 0, 2 * Math.PI);
    ctx.stroke();
  }

  private drawHorizon() {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.strokeStyle = "rgba(200,168,76,0.55)";
    ctx.lineWidth = 1.5 * this.dpr;
    ctx.arc(this.cx, this.cy, this.R, 0, 2 * Math.PI);
    ctx.stroke();

    const dirs: { label: string; az: number }[] = [
      { label: "N", az: 0 },
      { label: "E", az: 90 },
      { label: "S", az: 180 },
      { label: "W", az: 270 },
    ];
    ctx.fillStyle = "rgba(220,205,160,0.95)";
    ctx.font = `${13 * this.dpr}px ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const d of dirs) {
      const a = d.az * DEG;
      const rx = this.cx - (this.R + 12 * this.dpr) * Math.sin(a);
      const ry = this.cy - (this.R + 12 * this.dpr) * Math.cos(a);
      ctx.fillText(d.label, rx, ry);
    }
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  private onClick(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * this.dpr;
    const y = (e.clientY - rect.top) * this.dpr;
    let best: HitTarget | null = null;
    let bestD = Infinity;
    for (const h of this.hits) {
      const d = Math.hypot(h.x - x, h.y - y);
      if (d < h.hitR && d < bestD) {
        bestD = d;
        best = h;
      }
    }
    if (best) {
      this.selectedTitle = best.info.title;
      this.opts.onSelect?.(best.info);
    } else {
      this.selectedTitle = null;
      this.opts.onSelect?.(null);
    }
    this.draw();
  }

  dispose() {
    this.disposed = true;
    this.ro.disconnect();
    this.canvas.removeEventListener("click", this.onClick);
    if (this.canvas.parentElement)
      this.canvas.parentElement.removeChild(this.canvas);
  }
}
