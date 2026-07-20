// foundation.ts — the terrain-to-foundation design engine.
//
// Pure TypeScript (no Three.js): it turns a set of survey points — synthetic,
// or parsed from a CSV / XYZ / OBJ / PLY point cloud or mesh — into a gridded
// ground model (DEM), analyses the terrain, then automatically places and
// sizes a grid of piers/stumps/pedestals under a building footprint, checks
// spans, and produces a foundation schedule + bill of materials that can be
// exported as CSV or a 2D DXF plan.
//
// Conventions: survey axes are x = east, y = north, z = elevation (up), all in
// metres. The 3D viewer (FoundationView) maps these into Three.js space.

/** A single survey point in metres (z is elevation). */
export interface Point3 {
  x: number;
  y: number;
  z: number;
}

/** A gridded digital elevation model (regular raster over the site bounds). */
export interface Dem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cols: number;
  rows: number;
  /** cell size in metres */
  cellX: number;
  cellY: number;
  /** elevations, row-major: z[r * cols + c] */
  z: Float32Array;
  minZ: number;
  maxZ: number;
}

export interface TerrainStats {
  /** span of the site in metres */
  extentX: number;
  extentY: number;
  reliefZ: number;
  minZ: number;
  maxZ: number;
  /** slope in degrees */
  maxSlopeDeg: number;
  meanSlopeDeg: number;
  /** dominant downhill direction, degrees clockwise from north */
  aspectDeg: number;
  highPoint: Point3;
  lowPoint: Point3;
}

export type DatumMode = "auto" | "manual";

export interface DesignParams {
  /** building footprint (metres), placed over the site */
  footprintW: number; // along x
  footprintL: number; // along y
  /** footprint origin (SW corner) in site coords; if null, centred on site */
  originX: number | null;
  originY: number | null;
  /** maximum allowable beam span between piers (metres) */
  maxSpan: number;
  /** minimum & maximum support height (metres) */
  minHeight: number;
  maxHeight: number;
  /** structural datum (finished-floor underside level) */
  datumMode: DatumMode;
  manualDatumZ: number;
  /** clearance added above the highest ground under the footprint (auto mode) */
  clearance: number;
  /** design load carried by the structure (kPa) — drives pier sizing */
  imposedLoad: number;
  /** available pier diameters (mm), ascending */
  diameters: number[];
  /** concrete pier assumption vs. adjustable pedestal */
  system: FoundationSystem;
}

export type FoundationSystem = "pier" | "stump" | "pedestal";

export interface Pier {
  /** schedule label, e.g. "P4" */
  label: string;
  /** grid reference, e.g. "B3" */
  grid: string;
  /** column / row indices in the pier grid */
  ix: number;
  iy: number;
  /** site coordinates (m) */
  x: number;
  y: number;
  /** ground elevation at the pier (m) */
  groundZ: number;
  /** top-of-pier elevation = structural datum (m) */
  topZ: number;
  /** support height (m) */
  height: number;
  /** chosen diameter (mm) */
  diameter: number;
  /** tributary area (m²) and axial load (kN) */
  tributary: number;
  loadKn: number;
  /** flags */
  belowMin: boolean;
  aboveMax: boolean;
}

export interface Bom {
  pierCount: number;
  totalSupportLength: number; // m
  concreteVolume: number; // m³ (piers only)
  minHeight: number;
  maxHeight: number;
  meanHeight: number;
  beamLength: number; // m (total girder/bearer length)
  baySpacingX: number;
  baySpacingY: number;
  spanOk: boolean;
  overHeightCount: number;
  belowMinCount: number;
  estimatedCost: number; // rough $ estimate
}

export interface DesignResult {
  params: DesignParams;
  datumZ: number;
  piers: Pier[];
  nx: number;
  ny: number;
  footprint: { x0: number; y0: number; x1: number; y1: number };
  bom: Bom;
}

// ---------------------------------------------------------------------------
// Small deterministic value-noise helper (for synthetic terrain).
// ---------------------------------------------------------------------------

function hash2(ix: number, iy: number, seed: number): number {
  let h = ix * 374761393 + iy * 668265263 + seed * 362437;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (h >>> 0) / 4294967295;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  const u = smooth(fx);
  const v = smooth(fy);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

function fbm(x: number, y: number, seed: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + o * 17);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

// ---------------------------------------------------------------------------
// Synthetic terrain presets.
// ---------------------------------------------------------------------------

export type TerrainPreset =
  | "sloped"
  | "rolling"
  | "ridge"
  | "gully"
  | "gentle";

export interface PresetSpec {
  id: TerrainPreset;
  label: string;
  description: string;
}

export const TERRAIN_PRESETS: PresetSpec[] = [
  { id: "sloped", label: "Sloping block", description: "A steady cross-fall — the classic sloping site." },
  { id: "rolling", label: "Rolling terrain", description: "Undulating ground with soft high and low points." },
  { id: "ridge", label: "Ridge", description: "A raised spine falling away on both sides." },
  { id: "gully", label: "Gully", description: "A drainage low running through the site." },
  { id: "gentle", label: "Gentle fall", description: "An almost-flat site with a slight fall." },
];

/**
 * Build a synthetic DEM for a preset. `slope` scales the dominant fall (m of
 * drop across the site); `roughness` scales the undulation amplitude (m).
 */
export function synthTerrain(
  preset: TerrainPreset,
  extent = 12,
  slope = 2.4,
  roughness = 0.6,
  seed = 7,
  res = 80
): Dem {
  const cols = res;
  const rows = res;
  const z = new Float32Array(cols * rows);
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const u = c / (cols - 1); // 0..1 east
      const v = r / (rows - 1); // 0..1 north
      const x = u * extent;
      const y = v * extent;
      let h = 0;

      switch (preset) {
        case "sloped":
          h = slope * (1 - v) + roughness * (fbm(u * 3, v * 3, seed) - 0.5);
          break;
        case "gentle":
          h = 0.35 * slope * (1 - v) + 0.4 * roughness * (fbm(u * 2, v * 2, seed) - 0.5);
          break;
        case "rolling":
          h =
            0.5 * slope * (1 - v) +
            roughness * 2.2 * (fbm(u * 2.4, v * 2.4, seed) - 0.5);
          break;
        case "ridge": {
          const d = Math.abs(u - 0.5) * 2; // 0 centre → 1 edge
          h = slope * (1 - d) + roughness * (fbm(u * 3, v * 3, seed) - 0.5);
          break;
        }
        case "gully": {
          const d = Math.abs(u - 0.5) * 2;
          h =
            0.5 * slope * (1 - v) +
            slope * 0.8 * (d - 0.5) +
            roughness * (fbm(u * 3, v * 3, seed) - 0.5);
          break;
        }
      }
      z[r * cols + c] = h;
      if (h < minZ) minZ = h;
      if (h > maxZ) maxZ = h;
    }
  }

  return {
    minX: 0,
    minY: 0,
    maxX: extent,
    maxY: extent,
    cols,
    rows,
    cellX: extent / (cols - 1),
    cellY: extent / (rows - 1),
    z,
    minZ,
    maxZ,
  };
}

/** Sample the DEM at (x, y) with bilinear interpolation (clamped to bounds). */
export function sampleDem(dem: Dem, x: number, y: number): number {
  const fx = clamp((x - dem.minX) / dem.cellX, 0, dem.cols - 1);
  const fy = clamp((y - dem.minY) / dem.cellY, 0, dem.rows - 1);
  const c0 = Math.floor(fx);
  const r0 = Math.floor(fy);
  const c1 = Math.min(c0 + 1, dem.cols - 1);
  const r1 = Math.min(r0 + 1, dem.rows - 1);
  const tx = fx - c0;
  const ty = fy - r0;
  const z = dem.z;
  const z00 = z[r0 * dem.cols + c0];
  const z10 = z[r0 * dem.cols + c1];
  const z01 = z[r1 * dem.cols + c0];
  const z11 = z[r1 * dem.cols + c1];
  return (
    z00 * (1 - tx) * (1 - ty) +
    z10 * tx * (1 - ty) +
    z01 * (1 - tx) * ty +
    z11 * tx * ty
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// ---------------------------------------------------------------------------
// Point cloud / mesh parsing → DEM.
// ---------------------------------------------------------------------------

export interface ParseResult {
  points: Point3[];
  format: string;
}

/**
 * Parse a survey file into points. Supports CSV / XYZ / TXT (x,y,z per line),
 * Wavefront OBJ (v lines) and ASCII PLY. Returns the raw points; call
 * `demFromPoints` to grid them.
 */
export function parsePointCloud(text: string, filename: string): ParseResult {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".obj")) return { points: parseObj(text), format: "OBJ" };
  if (lower.endsWith(".ply")) return { points: parsePly(text), format: "PLY" };
  return { points: parseXyz(text), format: lower.endsWith(".csv") ? "CSV" : "XYZ" };
}

function parseXyz(text: string): Point3[] {
  const pts: Point3[] = [];
  const lines = text.split(/\r?\n/);
  let started = false;
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#") || t.startsWith("//")) continue;
    const parts = t.split(/[\s,;]+/);
    if (parts.length < 3) continue;
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    const z = Number(parts[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      // tolerate a single header row
      if (!started) continue;
      continue;
    }
    started = true;
    pts.push({ x, y, z });
  }
  return pts;
}

function parseObj(text: string): Point3[] {
  const pts: Point3[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line[0] !== "v" || line[1] !== " ") continue;
    const parts = line.trim().split(/\s+/);
    const x = Number(parts[1]);
    const y = Number(parts[2]);
    const z = Number(parts[3]);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      pts.push({ x, y, z });
    }
  }
  return pts;
}

function parsePly(text: string): Point3[] {
  // ASCII PLY only. Read the header to find the vertex count and property
  // order, then read that many vertices.
  const lines = text.split(/\r?\n/);
  let i = 0;
  let vertexCount = 0;
  const props: string[] = [];
  let inVertex = false;
  for (; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith("element vertex")) {
      vertexCount = parseInt(t.split(/\s+/)[2], 10);
      inVertex = true;
    } else if (t.startsWith("element")) {
      inVertex = false;
    } else if (t.startsWith("property") && inVertex) {
      props.push(t.split(/\s+/).pop() as string);
    } else if (t === "end_header") {
      i++;
      break;
    }
  }
  const xi = props.indexOf("x");
  const yi = props.indexOf("y");
  const zi = props.indexOf("z");
  const pts: Point3[] = [];
  for (let n = 0; n < vertexCount && i < lines.length; n++, i++) {
    const parts = lines[i].trim().split(/\s+/);
    const x = Number(parts[xi >= 0 ? xi : 0]);
    const y = Number(parts[yi >= 0 ? yi : 1]);
    const z = Number(parts[zi >= 0 ? zi : 2]);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      pts.push({ x, y, z });
    }
  }
  return pts;
}

/**
 * Grid scattered points into a DEM. Points are bucketed into cells (averaged),
 * then empty cells are filled by iterative neighbour diffusion and the whole
 * grid is lightly smoothed. Robust to noisy, non-uniform clouds.
 */
export function demFromPoints(points: Point3[], res = 80): Dem {
  if (points.length === 0) throw new Error("No points to grid");

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  // Guard against degenerate extents.
  if (maxX - minX < 1e-6) maxX = minX + 1;
  if (maxY - minY < 1e-6) maxY = minY + 1;

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const aspect = spanX / spanY;
  let cols = res;
  let rows = res;
  if (aspect > 1) rows = Math.max(8, Math.round(res / aspect));
  else cols = Math.max(8, Math.round(res * aspect));

  const cellX = spanX / (cols - 1);
  const cellY = spanY / (rows - 1);
  const sum = new Float64Array(cols * rows);
  const cnt = new Uint32Array(cols * rows);

  for (const p of points) {
    const c = clamp(Math.round((p.x - minX) / cellX), 0, cols - 1);
    const r = clamp(Math.round((p.y - minY) / cellY), 0, rows - 1);
    const idx = r * cols + c;
    sum[idx] += p.z;
    cnt[idx]++;
  }

  const z = new Float32Array(cols * rows);
  const filled = new Uint8Array(cols * rows);
  for (let i = 0; i < z.length; i++) {
    if (cnt[i] > 0) {
      z[i] = sum[i] / cnt[i];
      filled[i] = 1;
    }
  }

  // Fill gaps by repeated neighbour averaging.
  let remaining = z.length - filled.reduce((a, b) => a + b, 0);
  let guard = 0;
  while (remaining > 0 && guard++ < 200) {
    const next = filled.slice();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (filled[idx]) continue;
        let acc = 0;
        let k = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr;
            const cc = c + dc;
            if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
            const j = rr * cols + cc;
            if (filled[j]) {
              acc += z[j];
              k++;
            }
          }
        }
        if (k > 0) {
          z[idx] = acc / k;
          next[idx] = 1;
          remaining--;
        }
      }
    }
    filled.set(next);
  }

  // One light smoothing pass.
  const smoothed = z.slice();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let acc = 0;
      let k = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
          acc += z[rr * cols + cc];
          k++;
        }
      }
      smoothed[r * cols + c] = acc / k;
    }
  }

  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < smoothed.length; i++) {
    const v = smoothed[i];
    if (v < minZ) minZ = v;
    if (v > maxZ) maxZ = v;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    cols,
    rows,
    cellX,
    cellY,
    z: smoothed,
    minZ,
    maxZ,
  };
}

// ---------------------------------------------------------------------------
// Terrain analysis.
// ---------------------------------------------------------------------------

export function analyseTerrain(dem: Dem): TerrainStats {
  let maxSlope = 0;
  let slopeSum = 0;
  let slopeN = 0;
  let dzdxSum = 0;
  let dzdySum = 0;
  let highPoint: Point3 = { x: 0, y: 0, z: -Infinity };
  let lowPoint: Point3 = { x: 0, y: 0, z: Infinity };

  for (let r = 0; r < dem.rows; r++) {
    for (let c = 0; c < dem.cols; c++) {
      const idx = r * dem.cols + c;
      const zc = dem.z[idx];
      const x = dem.minX + c * dem.cellX;
      const y = dem.minY + r * dem.cellY;
      if (zc > highPoint.z) highPoint = { x, y, z: zc };
      if (zc < lowPoint.z) lowPoint = { x, y, z: zc };

      const cl = Math.max(0, c - 1);
      const cr = Math.min(dem.cols - 1, c + 1);
      const rd = Math.max(0, r - 1);
      const ru = Math.min(dem.rows - 1, r + 1);
      const dzdx = (dem.z[r * dem.cols + cr] - dem.z[r * dem.cols + cl]) / ((cr - cl) * dem.cellX || 1);
      const dzdy = (dem.z[ru * dem.cols + c] - dem.z[rd * dem.cols + c]) / ((ru - rd) * dem.cellY || 1);
      const g = Math.hypot(dzdx, dzdy);
      const slopeDeg = Math.atan(g) * (180 / Math.PI);
      if (slopeDeg > maxSlope) maxSlope = slopeDeg;
      slopeSum += slopeDeg;
      slopeN++;
      dzdxSum += dzdx;
      dzdySum += dzdy;
    }
  }

  // Aspect: downhill direction (negative gradient), clockwise from north.
  const meanDx = dzdxSum / slopeN;
  const meanDy = dzdySum / slopeN;
  let aspect = (Math.atan2(-meanDx, -meanDy) * 180) / Math.PI;
  if (aspect < 0) aspect += 360;

  return {
    extentX: dem.maxX - dem.minX,
    extentY: dem.maxY - dem.minY,
    reliefZ: dem.maxZ - dem.minZ,
    minZ: dem.minZ,
    maxZ: dem.maxZ,
    maxSlopeDeg: maxSlope,
    meanSlopeDeg: slopeSum / slopeN,
    aspectDeg: aspect,
    highPoint,
    lowPoint,
  };
}

// ---------------------------------------------------------------------------
// Foundation design.
// ---------------------------------------------------------------------------

export const DEFAULT_PARAMS: DesignParams = {
  footprintW: 8,
  footprintL: 6,
  originX: null,
  originY: null,
  maxSpan: 2.4,
  minHeight: 0.15,
  maxHeight: 3.0,
  datumMode: "auto",
  manualDatumZ: 0,
  clearance: 0.3,
  imposedLoad: 3.0,
  diameters: [200, 250, 300, 350, 400, 450],
  system: "pier",
};

function gridLabel(iy: number): string {
  // A, B, ... Z, AA, AB ...
  let n = iy;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function chooseDiameter(loadKn: number, diameters: number[]): number {
  // Very rough allowable-axial-load model for a short concrete pier:
  // capacity ∝ area, using a nominal 6 MPa working stress on the section.
  const working = 6000; // kPa (≈ conservative allowable bearing on the section)
  for (const d of diameters) {
    const area = Math.PI * (d / 2000) ** 2; // m²
    if (area * working >= loadKn) return d;
  }
  return diameters[diameters.length - 1];
}

export function designFoundation(dem: Dem, params: DesignParams): DesignResult {
  const siteW = dem.maxX - dem.minX;
  const siteL = dem.maxY - dem.minY;
  const w = Math.min(params.footprintW, siteW);
  const l = Math.min(params.footprintL, siteL);

  const x0 =
    params.originX ?? dem.minX + (siteW - w) / 2;
  const y0 =
    params.originY ?? dem.minY + (siteL - l) / 2;
  const x1 = x0 + w;
  const y1 = y0 + l;

  // Pier grid: enough bays so every span ≤ maxSpan, evenly spaced.
  const nx = Math.max(2, Math.ceil(w / params.maxSpan) + 1);
  const ny = Math.max(2, Math.ceil(l / params.maxSpan) + 1);
  const bayX = w / (nx - 1);
  const bayY = l / (ny - 1);

  // Determine structural datum.
  let datumZ: number;
  if (params.datumMode === "manual") {
    datumZ = params.manualDatumZ;
  } else {
    // Highest ground under the footprint + clearance → keeps all piers ≥ min.
    let maxGround = -Infinity;
    for (let iy = 0; iy < ny; iy++) {
      for (let ix = 0; ix < nx; ix++) {
        const gx = x0 + ix * bayX;
        const gy = y0 + iy * bayY;
        const gz = sampleDem(dem, gx, gy);
        if (gz > maxGround) maxGround = gz;
      }
    }
    datumZ = maxGround + params.clearance + params.minHeight;
    // round up to a tidy 5 mm
    datumZ = Math.ceil(datumZ * 200) / 200;
  }

  const tributaryFull = bayX * bayY;
  const piers: Pier[] = [];
  let count = 0;
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      count++;
      const x = x0 + ix * bayX;
      const y = y0 + iy * bayY;
      const groundZ = sampleDem(dem, x, y);
      let height = datumZ - groundZ;

      // Edge/corner piers carry a smaller tributary area.
      const fx = ix === 0 || ix === nx - 1 ? 0.5 : 1;
      const fy = iy === 0 || iy === ny - 1 ? 0.5 : 1;
      const tributary = tributaryFull * fx * fy;
      const loadKn = tributary * params.imposedLoad; // kPa·m² = kN
      const diameter = chooseDiameter(loadKn, params.diameters);

      const belowMin = height < params.minHeight - 1e-6;
      const aboveMax = height > params.maxHeight + 1e-6;
      // snap to 5 mm for the schedule
      height = Math.round(height * 200) / 200;

      piers.push({
        label: `P${count}`,
        grid: `${gridLabel(iy)}${ix + 1}`,
        ix,
        iy,
        x,
        y,
        groundZ,
        topZ: datumZ,
        height,
        diameter,
        tributary,
        loadKn,
        belowMin,
        aboveMax,
      });
    }
  }

  const bom = buildBom(piers, bayX, bayY, params, nx, ny);
  return { params, datumZ, piers, nx, ny, footprint: { x0, y0, x1, y1 }, bom };
}

function buildBom(
  piers: Pier[],
  bayX: number,
  bayY: number,
  params: DesignParams,
  nx: number,
  ny: number
): Bom {
  let total = 0;
  let concrete = 0;
  let minH = Infinity;
  let maxH = -Infinity;
  let over = 0;
  let below = 0;
  for (const p of piers) {
    const h = Math.max(0, p.height);
    total += h;
    concrete += Math.PI * (p.diameter / 2000) ** 2 * h;
    if (h < minH) minH = h;
    if (h > maxH) maxH = h;
    if (p.aboveMax) over++;
    if (p.belowMin) below++;
  }
  const mean = total / piers.length;
  // Bearers run in x along each row, girders/rows spacing in y.
  const rowLen = bayX * (nx - 1);
  const colLen = bayY * (ny - 1);
  const beamLength = rowLen * ny + colLen * nx;

  // Rough cost model (indicative only): concrete + steel + labour per pier.
  const concreteCost = concrete * 350; // $/m³ supplied & placed
  const pierLabour = piers.length * 120; // $/pier set & align
  const beamCost = beamLength * 45; // $/m bearer/girder
  const estimatedCost = concreteCost + pierLabour + beamCost;

  return {
    pierCount: piers.length,
    totalSupportLength: total,
    concreteVolume: concrete,
    minHeight: minH,
    maxHeight: maxH,
    meanHeight: mean,
    beamLength,
    baySpacingX: bayX,
    baySpacingY: bayY,
    spanOk: bayX <= params.maxSpan + 1e-6 && bayY <= params.maxSpan + 1e-6,
    overHeightCount: over,
    belowMinCount: below,
    estimatedCost,
  };
}

// ---------------------------------------------------------------------------
// Exports.
// ---------------------------------------------------------------------------

export function scheduleToCsv(result: DesignResult): string {
  const rows: string[] = [];
  rows.push(
    "Pier,Grid,X (m),Y (m),Ground RL (m),Top RL (m),Height (mm),Diameter (mm),Load (kN),Flag"
  );
  for (const p of result.piers) {
    const flag = p.aboveMax ? "OVER-HEIGHT" : p.belowMin ? "BELOW-MIN" : "";
    rows.push(
      [
        p.label,
        p.grid,
        p.x.toFixed(3),
        p.y.toFixed(3),
        p.groundZ.toFixed(3),
        p.topZ.toFixed(3),
        Math.round(p.height * 1000),
        p.diameter,
        p.loadKn.toFixed(1),
        flag,
      ].join(",")
    );
  }
  return rows.join("\n");
}

/** Minimal AutoCAD R12 DXF: a 2D setout plan of piers, labels and footprint. */
export function scheduleToDxf(result: DesignResult): string {
  const out: string[] = [];
  const e = (code: number, value: string | number) => {
    out.push(String(code));
    out.push(String(value));
  };

  e(0, "SECTION");
  e(2, "ENTITIES");

  const line = (x1: number, y1: number, x2: number, y2: number, layer: string) => {
    e(0, "LINE");
    e(8, layer);
    e(10, x1);
    e(20, y1);
    e(11, x2);
    e(21, y2);
  };
  const circle = (x: number, y: number, r: number, layer: string) => {
    e(0, "CIRCLE");
    e(8, layer);
    e(10, x);
    e(20, y);
    e(40, r);
  };
  const text = (x: number, y: number, h: number, s: string, layer: string) => {
    e(0, "TEXT");
    e(8, layer);
    e(10, x);
    e(20, y);
    e(40, h);
    e(1, s);
  };

  const fp = result.footprint;
  line(fp.x0, fp.y0, fp.x1, fp.y0, "FOOTPRINT");
  line(fp.x1, fp.y0, fp.x1, fp.y1, "FOOTPRINT");
  line(fp.x1, fp.y1, fp.x0, fp.y1, "FOOTPRINT");
  line(fp.x0, fp.y1, fp.x0, fp.y0, "FOOTPRINT");

  for (const p of result.piers) {
    circle(p.x, p.y, p.diameter / 2000, "PIERS");
    text(
      p.x + p.diameter / 1500,
      p.y + p.diameter / 1500,
      0.15,
      `${p.label} ${Math.round(p.height * 1000)}`,
      "LABELS"
    );
  }

  e(0, "ENDSEC");
  e(0, "EOF");
  return out.join("\n");
}
