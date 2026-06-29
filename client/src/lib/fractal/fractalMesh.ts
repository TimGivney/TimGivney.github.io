// CPU mesh extraction for the 3D fractals so they can be 3D-printed.
//
// The fractals in Fractal3DView are implicit surfaces traced by a shader, so
// there is no geometry to export. Here we sample a signed scalar field on a
// voxel grid (sign = inside/outside from the same escape-time iteration as the
// shader, magnitude = the distance estimate) and run marching cubes to build a
// watertight triangle mesh. The result is exported as binary STL or OBJ.
//
// The distance estimators below mirror the GLSL in Fractal3DView.ts exactly so
// the exported model matches what you see on screen.

export type FractalMeshType = "mandelbulb" | "mandelbox" | "julia";

export interface MeshParams {
  type: FractalMeshType;
  power: number;
  iterations: number;
  boxScale: number;
  juliaC: [number, number, number, number];
  resolution: number; // grid cells along the longest axis
}

export interface MeshResult {
  positions: Float32Array; // 9 floats (3 verts) per triangle
  triangles: number;
  bounds: { min: [number, number, number]; max: [number, number, number] };
}

// Generous search extent used by the coarse pre-scan that auto-fits a tight
// bounding cube. The Mandelbox (especially at positive scale) is far bigger
// than the Mandelbulb / Julia, so each gets its own outer search bound.
const SEARCH_EXTENT: Record<FractalMeshType, number> = {
  mandelbulb: 1.4,
  mandelbox: 7.0,
  julia: 1.9,
};

// ---------------- signed scalar field (inside < 0 < outside) ----------------

// Mandelbulb (White & Nylander), matching deBulb in the shader.
function fieldBulb(
  x: number,
  y: number,
  z: number,
  power: number,
  iters: number
): number {
  let zx = x;
  let zy = y;
  let zz = z;
  let dr = 1.0;
  let r = 0.0;
  let escaped = false;
  for (let i = 0; i < iters; i++) {
    r = Math.sqrt(zx * zx + zy * zy + zz * zz);
    if (r > 2.0) {
      escaped = true;
      break;
    }
    const theta = Math.acos(Math.max(-1, Math.min(1, zz / r))) * power;
    const phi = Math.atan2(zy, zx) * power;
    const zr = Math.pow(r, power);
    dr = Math.pow(r, power - 1.0) * power * dr + 1.0;
    const st = Math.sin(theta);
    zx = zr * (st * Math.cos(phi)) + x;
    zy = zr * (st * Math.sin(phi)) + y;
    zz = zr * Math.cos(theta) + z;
  }
  const de = (0.5 * (Math.log(Math.max(r, 1e-9)) * r)) / Math.max(dr, 1e-9);
  return escaped ? Math.abs(de) : -Math.abs(de);
}

// Mandelbox (box fold + sphere fold), matching deBox in the shader.
function fieldBox(
  x: number,
  y: number,
  z: number,
  scale: number,
  iters: number
): number {
  let zx = x;
  let zy = y;
  let zz = z;
  let dr = 1.0;
  let escaped = false;
  for (let i = 0; i < iters; i++) {
    // box fold
    zx = Math.max(-1, Math.min(1, zx)) * 2.0 - zx;
    zy = Math.max(-1, Math.min(1, zy)) * 2.0 - zy;
    zz = Math.max(-1, Math.min(1, zz)) * 2.0 - zz;
    const m2 = zx * zx + zy * zy + zz * zz;
    if (m2 < 0.25) {
      zx *= 4.0;
      zy *= 4.0;
      zz *= 4.0;
      dr *= 4.0;
    } else if (m2 < 1.0) {
      const t = 1.0 / m2;
      zx *= t;
      zy *= t;
      zz *= t;
      dr *= t;
    }
    zx = zx * scale + x;
    zy = zy * scale + y;
    zz = zz * scale + z;
    dr = dr * Math.abs(scale) + 1.0;
    if (zx * zx + zy * zy + zz * zz > 4096.0) {
      escaped = true;
      break;
    }
  }
  const len = Math.sqrt(zx * zx + zy * zy + zz * zz);
  const de = len / Math.max(Math.abs(dr), 1e-9);
  return escaped ? Math.abs(de) : -Math.abs(de);
}

// Quaternion Julia (q -> q^2 + c), matching deJulia in the shader.
function fieldJulia(
  x: number,
  y: number,
  z: number,
  c: [number, number, number, number],
  iters: number
): number {
  let zx = x;
  let zy = y;
  let zz = z;
  let zw = 0.0;
  let dz = 1.0;
  let md = x * x + y * y + z * z;
  let escaped = false;
  for (let i = 0; i < iters; i++) {
    dz = 2.0 * Math.sqrt(zx * zx + zy * zy + zz * zz + zw * zw) * dz;
    const nx = zx * zx - zy * zy - zz * zz - zw * zw + c[0];
    const ny = 2.0 * zx * zy + c[1];
    const nz = 2.0 * zx * zz + c[2];
    const nw = 2.0 * zx * zw + c[3];
    zx = nx;
    zy = ny;
    zz = nz;
    zw = nw;
    md = zx * zx + zy * zy + zz * zz + zw * zw;
    if (md > 16.0) {
      escaped = true;
      break;
    }
  }
  const r = Math.sqrt(Math.max(md, 1e-12));
  const de = (0.25 * (Math.log(r) * r)) / Math.max(dz, 1e-9);
  return escaped ? Math.abs(de) : -Math.abs(de);
}

function makeFieldFn(
  p: MeshParams
): (x: number, y: number, z: number) => number {
  // A few extra iterations sharpen the surface without changing the shape.
  const iters = Math.max(6, Math.round(p.iterations) + 3);
  if (p.type === "mandelbulb")
    return (x, y, z) => fieldBulb(x, y, z, p.power, iters);
  if (p.type === "mandelbox")
    return (x, y, z) => fieldBox(x, y, z, p.boxScale, iters);
  return (x, y, z) => fieldJulia(x, y, z, p.juliaC, iters);
}

// ---------------- marching cubes -------------------------------------------

import { EDGE_TABLE, TRI_TABLE } from "./marchingCubesTables";

// Cube corner offsets (matches the standard Paul Bourke ordering).
const CORNER = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [1, 1, 1],
  [0, 1, 1],
];
// Edge -> the two corner indices it connects.
const EDGE_CORNERS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];

/**
 * Build a triangle mesh of the current fractal via marching cubes.
 *
 * Works slice-by-slice (two scalar layers held at a time) to keep memory low
 * and to report progress. `onProgress` is called with a 0..1 fraction.
 */
export function generateMesh(
  params: MeshParams,
  onProgress?: (frac: number) => void
): MeshResult {
  const field = makeFieldFn(params);
  const n = Math.max(16, Math.round(params.resolution));

  // --- Coarse pre-scan: auto-fit a tight cube around the actual surface, so we
  // never clip the shape and we spend the full grid resolution on it. ---
  const ext = SEARCH_EXTENT[params.type];
  const cn = 48;
  const cStep = (2 * ext) / cn;
  let lo: [number, number, number] = [Infinity, Infinity, Infinity];
  let hi: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  let found = false;
  for (let k = 0; k <= cn; k++) {
    const z = -ext + k * cStep;
    for (let j = 0; j <= cn; j++) {
      const y = -ext + j * cStep;
      for (let i = 0; i <= cn; i++) {
        const x = -ext + i * cStep;
        // Within ~one coarse cell of the surface (catches the zero crossing).
        if (field(x, y, z) < cStep) {
          found = true;
          if (x < lo[0]) lo[0] = x;
          if (y < lo[1]) lo[1] = y;
          if (z < lo[2]) lo[2] = z;
          if (x > hi[0]) hi[0] = x;
          if (y > hi[1]) hi[1] = y;
          if (z > hi[2]) hi[2] = z;
        }
      }
    }
  }
  let cx = 0,
    cy = 0,
    cz = 0,
    h = ext;
  if (found) {
    cx = (lo[0] + hi[0]) / 2;
    cy = (lo[1] + hi[1]) / 2;
    cz = (lo[2] + hi[2]) / 2;
    const halfSpan = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2;
    h = halfSpan + 2.5 * cStep; // pad so the surface isn't cut at the rim
  }

  const step = (2 * h) / n;
  const nx = n + 1;
  const ny = n + 1;

  const coord = (i: number) => i * step - h;
  const ox = cx,
    oy = cy,
    oz = cz;

  // Sample one full z-slice of the scalar field (nx*ny values).
  const sliceAt = (k: number): Float32Array => {
    const s = new Float32Array(nx * ny);
    const z = coord(k) + oz;
    let idx = 0;
    for (let j = 0; j < ny; j++) {
      const y = coord(j) + oy;
      for (let i = 0; i < nx; i++) {
        s[idx++] = field(coord(i) + ox, y, z);
      }
    }
    return s;
  };

  const positions: number[] = [];
  let lower = sliceAt(0);
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;

  const vert = (
    cornerA: number[],
    cornerB: number[],
    valA: number,
    valB: number,
    bx: number,
    by: number,
    bz: number
  ): [number, number, number] => {
    // Linear interpolation of the zero crossing along the edge.
    const denom = valB - valA;
    const t = Math.abs(denom) < 1e-12 ? 0.5 : -valA / denom;
    const x = bx + (cornerA[0] + t * (cornerB[0] - cornerA[0])) * step;
    const y = by + (cornerA[1] + t * (cornerB[1] - cornerA[1])) * step;
    const z = bz + (cornerA[2] + t * (cornerB[2] - cornerA[2])) * step;
    return [x, y, z];
  };

  const cube = new Float32Array(8);
  for (let k = 0; k < n; k++) {
    const upper = sliceAt(k + 1);
    const zBase = coord(k) + oz;
    for (let j = 0; j < n; j++) {
      const yBase = coord(j) + oy;
      for (let i = 0; i < n; i++) {
        const xBase = coord(i) + ox;
        // Gather the 8 corner values for this cell.
        for (let c = 0; c < 8; c++) {
          const ci = i + CORNER[c][0];
          const cj = j + CORNER[c][1];
          const layer = CORNER[c][2] === 0 ? lower : upper;
          cube[c] = layer[cj * nx + ci];
        }
        let cubeIndex = 0;
        for (let c = 0; c < 8; c++) if (cube[c] < 0) cubeIndex |= 1 << c;
        const edges = EDGE_TABLE[cubeIndex];
        if (edges === 0) continue;

        // Compute the interpolated vertex on each intersected edge.
        const ev: ([number, number, number] | null)[] = new Array(12).fill(
          null
        );
        for (let e = 0; e < 12; e++) {
          if (edges & (1 << e)) {
            const a = EDGE_CORNERS[e][0];
            const b = EDGE_CORNERS[e][1];
            ev[e] = vert(
              CORNER[a],
              CORNER[b],
              cube[a],
              cube[b],
              xBase,
              yBase,
              zBase
            );
          }
        }
        const tri = TRI_TABLE[cubeIndex];
        for (let t = 0; tri[t] !== -1; t += 3) {
          const p0 = ev[tri[t]]!;
          const p1 = ev[tri[t + 1]]!;
          const p2 = ev[tri[t + 2]]!;
          positions.push(
            p0[0],
            p0[1],
            p0[2],
            p1[0],
            p1[1],
            p1[2],
            p2[0],
            p2[1],
            p2[2]
          );
          for (const p of [p0, p1, p2]) {
            if (p[0] < minX) minX = p[0];
            if (p[1] < minY) minY = p[1];
            if (p[2] < minZ) minZ = p[2];
            if (p[0] > maxX) maxX = p[0];
            if (p[1] > maxY) maxY = p[1];
            if (p[2] > maxZ) maxZ = p[2];
          }
        }
      }
    }
    lower = upper;
    if (onProgress && (k & 3) === 0) onProgress((k + 1) / n);
  }
  onProgress?.(1);

  const arr = new Float32Array(positions);
  return {
    positions: arr,
    triangles: arr.length / 9,
    bounds: {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
    },
  };
}

// ---------------- exporters -------------------------------------------------

/** Binary STL (most reliable for slicers). */
export function meshToBinarySTL(positions: Float32Array): ArrayBuffer {
  const triangles = positions.length / 9;
  const buf = new ArrayBuffer(84 + triangles * 50);
  const view = new DataView(buf);
  // 80-byte header left as zeros, then triangle count.
  view.setUint32(80, triangles, true);
  let off = 84;
  for (let i = 0; i < positions.length; i += 9) {
    const ax = positions[i],
      ay = positions[i + 1],
      az = positions[i + 2];
    const bx = positions[i + 3],
      by = positions[i + 4],
      bz = positions[i + 5];
    const cx = positions[i + 6],
      cy = positions[i + 7],
      cz = positions[i + 8];
    // Face normal.
    const ux = bx - ax,
      uy = by - ay,
      uz = bz - az;
    const vx = cx - ax,
      vy = cy - ay,
      vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    view.setFloat32(off, nx, true);
    view.setFloat32(off + 4, ny, true);
    view.setFloat32(off + 8, nz, true);
    view.setFloat32(off + 12, ax, true);
    view.setFloat32(off + 16, ay, true);
    view.setFloat32(off + 20, az, true);
    view.setFloat32(off + 24, bx, true);
    view.setFloat32(off + 28, by, true);
    view.setFloat32(off + 32, bz, true);
    view.setFloat32(off + 36, cx, true);
    view.setFloat32(off + 40, cy, true);
    view.setFloat32(off + 44, cz, true);
    view.setUint16(off + 48, 0, true);
    off += 50;
  }
  return buf;
}

/** Wavefront OBJ with welded vertices to keep the file compact. */
export function meshToOBJ(positions: Float32Array): string {
  const map = new Map<string, number>();
  const verts: number[] = [];
  const faces: number[] = [];
  const key = (x: number, y: number, z: number) =>
    `${Math.round(x * 1e5)},${Math.round(y * 1e5)},${Math.round(z * 1e5)}`;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i],
      y = positions[i + 1],
      z = positions[i + 2];
    const k = key(x, y, z);
    let id = map.get(k);
    if (id === undefined) {
      verts.push(x, y, z);
      id = verts.length / 3;
      map.set(k, id);
    }
    faces.push(id);
  }
  const lines: string[] = ["# Fractal Lab 3D export — timgivney.com/fractal3d"];
  for (let i = 0; i < verts.length; i += 3) {
    lines.push(`v ${verts[i]} ${verts[i + 1]} ${verts[i + 2]}`);
  }
  for (let i = 0; i < faces.length; i += 3) {
    lines.push(`f ${faces[i]} ${faces[i + 1]} ${faces[i + 2]}`);
  }
  return lines.join("\n");
}
