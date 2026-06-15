/**
 * NxN Rubik's cube engine — a pure, exact sticker model.
 *
 * Stickers live on integer cubie coordinates (0..N-1 on each axis) plus an
 * outward normal. Every move is a 90deg rotation of one layer about one axis,
 * applied with integer arithmetic so there is never any floating-point drift.
 * The same model drives both the solver logic and the 3D renderer.
 */

export type Axis = 0 | 1 | 2; // 0 = X, 1 = Y, 2 = Z

/** A single quarter-turn of one layer. dir is +1 (right-hand) or -1. */
export interface Move {
  axis: Axis;
  layer: number;
  dir: 1 | -1;
}

/** A compacted move used in solutions: quarters is +1, -1 or 2 (180deg). */
export interface SolutionMove {
  axis: Axis;
  layer: number;
  quarters: 1 | -1 | 2;
}

export interface Sticker {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  /** Face id of the colour: 0=U 1=D 2=F 3=B 4=R 5=L */
  color: number;
}

export const FACE = { U: 0, D: 1, F: 2, B: 3, R: 4, L: 5 } as const;

export interface CubeState {
  n: number;
  stickers: Sticker[];
}

/** Build a solved cube of size n. */
export function createCube(n: number): CubeState {
  const stickers: Sticker[] = [];
  const max = n - 1;
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      for (let z = 0; z < n; z++) {
        if (x === max)
          stickers.push({ x, y, z, nx: 1, ny: 0, nz: 0, color: FACE.R });
        if (x === 0)
          stickers.push({ x, y, z, nx: -1, ny: 0, nz: 0, color: FACE.L });
        if (y === max)
          stickers.push({ x, y, z, nx: 0, ny: 1, nz: 0, color: FACE.U });
        if (y === 0)
          stickers.push({ x, y, z, nx: 0, ny: -1, nz: 0, color: FACE.D });
        if (z === max)
          stickers.push({ x, y, z, nx: 0, ny: 0, nz: 1, color: FACE.F });
        if (z === 0)
          stickers.push({ x, y, z, nx: 0, ny: 0, nz: -1, color: FACE.B });
      }
    }
  }
  return { n, stickers };
}

export function cloneCube(c: CubeState): CubeState {
  return { n: c.n, stickers: c.stickers.map(s => ({ ...s })) };
}

/** Apply a single right-handed quarter turn (dir +1) to a sticker in-place. */
function quarterPlus(s: Sticker, axis: Axis, max: number): void {
  if (axis === 0) {
    // about +X: (y,z) -> (max - z, y); normal (ny,nz) -> (-nz, ny)
    const y = s.y,
      z = s.z,
      ny = s.ny,
      nz = s.nz;
    s.y = max - z;
    s.z = y;
    s.ny = -nz;
    s.nz = ny;
  } else if (axis === 1) {
    // about +Y: (x,z) -> (z, max - x); normal (nx,nz) -> (nz, -nx)
    const x = s.x,
      z = s.z,
      nx = s.nx,
      nz = s.nz;
    s.x = z;
    s.z = max - x;
    s.nx = nz;
    s.nz = -nx;
  } else {
    // about +Z: (x,y) -> (max - y, x); normal (nx,ny) -> (-ny, nx)
    const x = s.x,
      y = s.y,
      nx = s.nx,
      ny = s.ny;
    s.x = max - y;
    s.y = x;
    s.nx = -ny;
    s.ny = nx;
  }
}

function coordOnAxis(s: Sticker, axis: Axis): number {
  return axis === 0 ? s.x : axis === 1 ? s.y : s.z;
}

/** Apply a move to the cube state in-place. */
export function applyMove(c: CubeState, m: Move): CubeState {
  const max = c.n - 1;
  const reps = m.dir === 1 ? 1 : 3; // a -90 turn is three +90 turns
  for (const s of c.stickers) {
    if (coordOnAxis(s, m.axis) === m.layer) {
      for (let r = 0; r < reps; r++) quarterPlus(s, m.axis, max);
    }
  }
  return c;
}

export function applyMoves(c: CubeState, moves: Move[]): CubeState {
  for (const m of moves) applyMove(c, m);
  return c;
}

/** Apply a compacted solution move in-place. */
export function applySolutionMove(c: CubeState, m: SolutionMove): CubeState {
  const reps = m.quarters === 2 ? 2 : m.quarters === 1 ? 1 : 3;
  const dir: 1 | -1 = 1;
  for (let i = 0; i < reps; i++)
    applyMove(c, { axis: m.axis, layer: m.layer, dir });
  return c;
}

export function invertMove(m: Move): Move {
  return { axis: m.axis, layer: m.layer, dir: m.dir === 1 ? -1 : 1 };
}

export function isSolved(c: CubeState): boolean {
  // Group stickers by their current outward normal; each group must be one colour.
  const groups = new Map<string, number>();
  for (const s of c.stickers) {
    const key = `${s.nx},${s.ny},${s.nz}`;
    const existing = groups.get(key);
    if (existing === undefined) groups.set(key, s.color);
    else if (existing !== s.color) return false;
  }
  return true;
}

/**
 * Simplify a quarter-move list into a shorter, equivalent solution.
 * Parallel layers (same axis) commute, so we reorder same-axis runs by layer to
 * expose cancellations, then merge adjacent moves on the same axis+layer.
 */
export function simplify(moves: Move[]): SolutionMove[] {
  let work: Array<{ axis: Axis; layer: number; q: number }> = moves.map(m => ({
    axis: m.axis,
    layer: m.layer,
    q: m.dir === 1 ? 1 : 3,
  }));

  let changed = true;
  while (changed) {
    changed = false;

    // Sort within maximal same-axis runs by layer (stable) to group equal layers.
    let i = 0;
    while (i < work.length) {
      let j = i;
      while (j + 1 < work.length && work[j + 1].axis === work[i].axis) j++;
      if (j > i) {
        const run = work.slice(i, j + 1);
        const sorted = [...run].sort((a, b) => a.layer - b.layer);
        if (sorted.some((v, k) => v !== run[k])) {
          work.splice(i, run.length, ...sorted);
          changed = true;
        }
      }
      i = j + 1;
    }

    // Merge adjacent same axis+layer.
    const out: typeof work = [];
    for (const m of work) {
      const prev = out[out.length - 1];
      if (prev && prev.axis === m.axis && prev.layer === m.layer) {
        prev.q = (prev.q + m.q) % 4;
        if (prev.q === 0) out.pop();
        changed = true;
      } else {
        out.push({ ...m });
      }
    }
    work = out.filter(m => m.q % 4 !== 0);
  }

  return work
    .filter(m => m.q % 4 !== 0)
    .map(m => {
      const q = ((m.q % 4) + 4) % 4;
      const quarters: 1 | -1 | 2 = q === 1 ? 1 : q === 3 ? -1 : 2;
      return { axis: m.axis, layer: m.layer, quarters };
    });
}

/**
 * Produce a solution for the given move history: invert + reverse it, then
 * simplify. Guaranteed correct because it literally undoes what was done.
 */
export function solveFromHistory(history: Move[]): SolutionMove[] {
  const reversed = [...history].reverse().map(invertMove);
  return simplify(reversed);
}

/** Expand a solution into atomic quarter turns (for animation). */
export function expandSolution(sol: SolutionMove[]): Move[] {
  const out: Move[] = [];
  for (const m of sol) {
    if (m.quarters === 2) {
      out.push({ axis: m.axis, layer: m.layer, dir: 1 });
      out.push({ axis: m.axis, layer: m.layer, dir: 1 });
    } else {
      out.push({
        axis: m.axis,
        layer: m.layer,
        dir: m.quarters === 1 ? 1 : -1,
      });
    }
  }
  return out;
}

/** A random scramble as a flat list of quarter turns. */
export function randomScramble(n: number, count: number): Move[] {
  const moves: Move[] = [];
  let lastAxis = -1;
  let lastLayer = -1;
  for (let i = 0; i < count; i++) {
    let axis: Axis;
    let layer: number;
    do {
      axis = Math.floor(Math.random() * 3) as Axis;
      layer = Math.floor(Math.random() * n);
    } while (axis === lastAxis && layer === lastLayer);
    lastAxis = axis;
    lastLayer = layer;
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    moves.push({ axis, layer, dir });
  }
  return moves;
}

const AXIS_LETTER: Record<Axis, [string, string]> = {
  0: ["L", "R"], // low side, high side
  1: ["D", "U"],
  2: ["B", "F"],
};

/** Human-readable label for a quarter move, e.g. "R", "U'", "2L". */
export function moveLabel(m: Move, n: number): string {
  return solutionLabel(
    { axis: m.axis, layer: m.layer, quarters: m.dir === 1 ? 1 : -1 },
    n
  );
}

export function solutionLabel(m: SolutionMove, n: number): string {
  const max = n - 1;
  const highSide = m.layer * 2 >= max;
  const [lowLetter, highLetter] = AXIS_LETTER[m.axis];
  const letter = highSide ? highLetter : lowLetter;
  const depth = highSide ? max - m.layer : m.layer; // 0 = outer face
  const prefix = depth === 0 ? "" : String(depth + 1);

  // Clockwise (no prime) for a high-side face is dir -1; for a low-side face +1.
  const cwQuarter = highSide ? -1 : 1;
  let suffix = "";
  if (m.quarters === 2) suffix = "2";
  else if (m.quarters !== cwQuarter) suffix = "'";

  return `${prefix}${letter}${suffix}`;
}
