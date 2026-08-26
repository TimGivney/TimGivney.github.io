import {
  createBlankCube,
  setStickerColor,
  type Axis,
  type CubeState,
  type SolutionMove,
  type Sticker,
} from "./engine";

const COLOR_LETTER = ["U", "D", "F", "B", "R", "L"] as const;
const FACE_ORDER = ["U", "R", "F", "D", "L", "B"] as const;
const SOLVED_FACELETS =
  "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";

interface StickerAddress {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
}

interface FaceDefinition {
  letter: (typeof FACE_ORDER)[number];
  color: number;
  address: (row: number, column: number) => StickerAddress;
}

function faceDefinitions(n: number): FaceDefinition[] {
  const max = n - 1;
  return [
    {
      letter: "U",
      color: 0,
      address: (row, column) => ({
        x: column,
        y: max,
        z: row,
        nx: 0,
        ny: 1,
        nz: 0,
      }),
    },
    {
      letter: "R",
      color: 4,
      address: (row, column) => ({
        x: max,
        y: max - row,
        z: max - column,
        nx: 1,
        ny: 0,
        nz: 0,
      }),
    },
    {
      letter: "F",
      color: 2,
      address: (row, column) => ({
        x: column,
        y: max - row,
        z: max,
        nx: 0,
        ny: 0,
        nz: 1,
      }),
    },
    {
      letter: "D",
      color: 1,
      address: (row, column) => ({
        x: column,
        y: 0,
        z: max - row,
        nx: 0,
        ny: -1,
        nz: 0,
      }),
    },
    {
      letter: "L",
      color: 5,
      address: (row, column) => ({
        x: 0,
        y: max - row,
        z: column,
        nx: -1,
        ny: 0,
        nz: 0,
      }),
    },
    {
      letter: "B",
      color: 3,
      address: (row, column) => ({
        x: max - column,
        y: max - row,
        z: 0,
        nx: 0,
        ny: 0,
        nz: -1,
      }),
    },
  ];
}

function matches(sticker: Sticker, address: StickerAddress) {
  return (
    sticker.x === address.x &&
    sticker.y === address.y &&
    sticker.z === address.z &&
    sticker.nx === address.nx &&
    sticker.ny === address.ny &&
    sticker.nz === address.nz
  );
}

export function createPhysicalEntryCube(n: 2 | 3 = 3): CubeState {
  const cube = createBlankCube(n);
  if (n === 3) {
    for (const face of faceDefinitions(n))
      setStickerColor(cube, face.address(1, 1), face.color);
  }
  return cube;
}

export interface CubieState {
  center: number[];
  cp: number[];
  co: number[];
  ep: number[];
  eo: number[];
}

export interface PhysicalStateValidation {
  valid: boolean;
  message: string;
  facelets?: string;
  cubies?: CubieState;
}

function isPermutation(values: number[], size: number) {
  return (
    values.length === size &&
    new Set(values).size === size &&
    values.every(value => Number.isInteger(value) && value >= 0 && value < size)
  );
}

export function permutationParity(values: number[]) {
  let inversions = 0;
  for (let left = 0; left < values.length; left++)
    for (let right = left + 1; right < values.length; right++)
      if (values[left] > values[right]) inversions++;
  return inversions % 2;
}

function validateCornerState(state: Pick<CubieState, "cp" | "co">) {
  if (!isPermutation(state.cp, 8))
    return "The corner colours do not form eight valid corner pieces.";
  if (state.co.reduce((sum, value) => sum + value, 0) % 3 !== 0)
    return "A corner is twisted; recheck the three colours on each corner.";
  return null;
}

export function validateCubieState(state: CubieState): string | null {
  const cornerProblem = validateCornerState(state);
  if (cornerProblem) return cornerProblem;
  if (!isPermutation(state.ep, 12))
    return "The edge colours do not form twelve valid edge pieces.";
  if (state.eo.reduce((sum, value) => sum + value, 0) % 2 !== 0)
    return "An edge is flipped; recheck the two colours on each edge.";
  if (permutationParity(state.cp) !== permutationParity(state.ep))
    return "The entered pieces have impossible permutation parity.";
  return null;
}

function readFacelets(cube: CubeState) {
  let facelets = "";
  for (const face of faceDefinitions(cube.n)) {
    for (let row = 0; row < cube.n; row++) {
      for (let column = 0; column < cube.n; column++) {
        const sticker = cube.stickers.find(candidate =>
          matches(candidate, face.address(row, column))
        );
        if (!sticker || sticker.color < 0 || sticker.color > 5) return null;
        facelets += COLOR_LETTER[sticker.color];
      }
    }
  }
  return facelets;
}

const CORNER_FACELETS = [
  [8, 9, 20],
  [6, 18, 38],
  [0, 36, 47],
  [2, 45, 11],
  [29, 26, 15],
  [27, 44, 24],
  [33, 53, 42],
  [35, 17, 51],
] as const;
const CORNER_COLORS = [
  ["U", "R", "F"],
  ["U", "F", "L"],
  ["U", "L", "B"],
  ["U", "B", "R"],
  ["D", "F", "R"],
  ["D", "L", "F"],
  ["D", "B", "L"],
  ["D", "R", "B"],
] as const;
const TWO_BY_TWO_TO_THREE_BY_THREE = [
  0, 2, 6, 8, 9, 11, 15, 17, 18, 20, 24, 26, 27, 29, 33, 35, 36, 38, 42, 44, 45,
  47, 51, 53,
] as const;

function createTwoByTwoCubieState(facelets: string): CubieState {
  const expanded = SOLVED_FACELETS.split("");
  for (let index = 0; index < facelets.length; index++)
    expanded[TWO_BY_TWO_TO_THREE_BY_THREE[index]] = facelets[index];

  const cp = Array(8).fill(-1);
  const co = Array(8).fill(0);
  for (let position = 0; position < CORNER_FACELETS.length; position++) {
    let orientation = 0;
    while (
      orientation < 3 &&
      !["U", "D"].includes(expanded[CORNER_FACELETS[position][orientation]])
    )
      orientation++;
    if (orientation === 3) continue;

    const color1 = expanded[CORNER_FACELETS[position][(orientation + 1) % 3]];
    const color2 = expanded[CORNER_FACELETS[position][(orientation + 2) % 3]];
    const piece = CORNER_COLORS.findIndex(
      colors => colors[1] === color1 && colors[2] === color2
    );
    if (piece >= 0) {
      cp[position] = piece;
      co[position] = orientation;
    }
  }

  const ep = Array.from({ length: 12 }, (_, index) => index);
  if (permutationParity(cp) === 1) [ep[0], ep[1]] = [ep[1], ep[0]];
  return {
    center: [0, 1, 2, 3, 4, 5],
    cp,
    co,
    ep,
    eo: Array(12).fill(0),
  };
}

export function validatePhysicalState(
  cube: CubeState
): PhysicalStateValidation {
  if (cube.n !== 2 && cube.n !== 3)
    return {
      valid: false,
      message: "Physical solving currently supports 2×2 and 3×3 cubes.",
    };

  const targetCount = cube.n * cube.n;
  const totalStickers = 6 * targetCount;
  const counts = [0, 0, 0, 0, 0, 0];
  for (const sticker of cube.stickers) {
    if (sticker.color >= 0 && sticker.color < 6) counts[sticker.color]++;
  }
  const entered = counts.reduce((sum, count) => sum + count, 0);
  if (entered !== totalStickers)
    return {
      valid: false,
      message: `${totalStickers - entered} stickers still need a colour.`,
    };

  for (let color = 0; color < counts.length; color++) {
    if (counts[color] !== targetCount)
      return {
        valid: false,
        message: `${COLOR_LETTER[color]} has ${counts[color]} stickers; every colour needs exactly ${targetCount}.`,
      };
  }

  if (cube.n === 3) {
    for (const face of faceDefinitions(cube.n)) {
      const center = cube.stickers.find(sticker =>
        matches(sticker, face.address(1, 1))
      );
      if (center?.color !== face.color)
        return {
          valid: false,
          message:
            "Keep white on top and green facing you; the six centre colours are fixed.",
        };
    }
  }

  const facelets = readFacelets(cube);
  if (!facelets)
    return { valid: false, message: "A sticker could not be read." };

  if (cube.n === 2) {
    const cubies = createTwoByTwoCubieState(facelets);
    const problem = validateCornerState(cubies);
    if (problem) return { valid: false, message: problem };
    return { valid: true, message: "Cube state is ready.", cubies };
  }

  return { valid: true, message: "Cube state is ready.", facelets };
}

const FACE_MOVE: Record<
  (typeof FACE_ORDER)[number],
  { axis: Axis; layer: number; clockwise: 1 | -1 }
> = {
  R: { axis: 0, layer: 2, clockwise: -1 },
  L: { axis: 0, layer: 0, clockwise: 1 },
  U: { axis: 1, layer: 2, clockwise: -1 },
  D: { axis: 1, layer: 0, clockwise: 1 },
  F: { axis: 2, layer: 2, clockwise: -1 },
  B: { axis: 2, layer: 0, clockwise: 1 },
};

export function parseCubeAlgorithm(algorithm: string, n = 3): SolutionMove[] {
  if (!algorithm.trim()) return [];
  return algorithm
    .trim()
    .split(/\s+/)
    .map(token => {
      const face = token[0] as keyof typeof FACE_MOVE;
      const definition = FACE_MOVE[face];
      if (!definition || !/^[URFDLB](2|')?$/.test(token))
        throw new Error(`Unsupported solution move: ${token}`);
      const quarters: 1 | -1 | 2 = token.endsWith("2")
        ? 2
        : token.endsWith("'")
          ? definition.clockwise === 1
            ? -1
            : 1
          : definition.clockwise;
      return {
        axis: definition.axis,
        layer: definition.layer === 2 ? n - 1 : 0,
        quarters,
      };
    });
}
