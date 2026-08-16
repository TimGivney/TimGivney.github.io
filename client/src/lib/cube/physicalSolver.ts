import {
  createBlankCube,
  setStickerColor,
  type Axis,
  type CubeState,
  type SolutionMove,
  type Sticker,
  type StickerAddress,
} from "./engine";

const COLOR_LETTER = ["U", "D", "F", "B", "R", "L"] as const;

interface FaceDefinition {
  letter: "U" | "R" | "F" | "D" | "L" | "B";
  color: number;
  address: (row: number, column: number) => StickerAddress;
}

const max = 2;
const FACE_DEFINITIONS: FaceDefinition[] = [
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

export function createPhysicalEntryCube(): CubeState {
  const cube = createBlankCube(3);
  for (const face of FACE_DEFINITIONS)
    setStickerColor(cube, face.address(1, 1), face.color);
  return cube;
}

export interface PhysicalStateValidation {
  valid: boolean;
  message: string;
  facelets?: string;
}

export function validatePhysicalState(
  cube: CubeState
): PhysicalStateValidation {
  if (cube.n !== 3)
    return {
      valid: false,
      message: "Physical solving currently supports 3×3 cubes.",
    };

  const counts = [0, 0, 0, 0, 0, 0];
  for (const sticker of cube.stickers) {
    if (sticker.color >= 0 && sticker.color < 6) counts[sticker.color]++;
  }
  const entered = counts.reduce((sum, count) => sum + count, 0);
  if (entered !== 54)
    return {
      valid: false,
      message: `${54 - entered} stickers still need a colour.`,
    };

  for (let color = 0; color < counts.length; color++) {
    if (counts[color] !== 9)
      return {
        valid: false,
        message: `${COLOR_LETTER[color]} has ${counts[color]} stickers; every colour needs exactly 9.`,
      };
  }

  for (const face of FACE_DEFINITIONS) {
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

  let facelets = "";
  for (const face of FACE_DEFINITIONS) {
    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 3; column++) {
        const sticker = cube.stickers.find(candidate =>
          matches(candidate, face.address(row, column))
        );
        if (!sticker || sticker.color < 0 || sticker.color > 5)
          return { valid: false, message: "A sticker could not be read." };
        facelets += COLOR_LETTER[sticker.color];
      }
    }
  }

  return { valid: true, message: "Cube state is ready.", facelets };
}

const FACE_MOVE: Record<
  "U" | "R" | "F" | "D" | "L" | "B",
  { axis: Axis; layer: number; clockwise: 1 | -1 }
> = {
  U: { axis: 1, layer: 2, clockwise: -1 },
  R: { axis: 0, layer: 2, clockwise: -1 },
  F: { axis: 2, layer: 2, clockwise: -1 },
  D: { axis: 1, layer: 0, clockwise: 1 },
  L: { axis: 0, layer: 0, clockwise: 1 },
  B: { axis: 2, layer: 0, clockwise: 1 },
};

export interface CubieState {
  cp: number[];
  co: number[];
  ep: number[];
  eo: number[];
}

function isPermutation(values: number[], size: number) {
  return (
    values.length === size &&
    new Set(values).size === size &&
    values.every(value => Number.isInteger(value) && value >= 0 && value < size)
  );
}

function permutationParity(values: number[]) {
  let inversions = 0;
  for (let left = 0; left < values.length; left++)
    for (let right = left + 1; right < values.length; right++)
      if (values[left] > values[right]) inversions++;
  return inversions % 2;
}

export function validateCubieState(state: CubieState): string | null {
  if (!isPermutation(state.cp, 8))
    return "The corner colours do not form eight valid corner pieces.";
  if (!isPermutation(state.ep, 12))
    return "The edge colours do not form twelve valid edge pieces.";
  if (state.co.reduce((sum, value) => sum + value, 0) % 3 !== 0)
    return "A corner is twisted; recheck the three colours on each corner.";
  if (state.eo.reduce((sum, value) => sum + value, 0) % 2 !== 0)
    return "An edge is flipped; recheck the two colours on each edge.";
  if (permutationParity(state.cp) !== permutationParity(state.ep))
    return "The entered pieces have impossible permutation parity.";
  return null;
}

export function parseCubeAlgorithm(algorithm: string): SolutionMove[] {
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
        layer: definition.layer,
        quarters,
      };
    });
}
