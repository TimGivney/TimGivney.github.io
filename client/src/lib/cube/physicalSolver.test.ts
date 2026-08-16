import Cube from "cubejs";
import {
  applyMove,
  applyMoves,
  cloneCube,
  createCube,
  isSolved,
  randomScramble,
  setStickerColor,
} from "./engine.ts";
import {
  createPhysicalEntryCube,
  parseCubeAlgorithm,
  validateCubieState,
  validatePhysicalState,
} from "./physicalSolver.ts";

let failures = 0;
function assert(condition: boolean, message: string) {
  if (!condition) {
    failures++;
    console.error("FAIL:", message);
  }
}

const solved = validatePhysicalState(createCube(3));
assert(solved.valid, "solved cube validates");
assert(
  solved.facelets === "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB",
  "solved cube uses cubejs facelet order"
);

assert(
  validatePhysicalState(createPhysicalEntryCube()).message.includes(
    "48 stickers"
  ),
  "entry cube reports incomplete stickers"
);
const wrongCount = cloneCube(createCube(3));
wrongCount.stickers[0].color = 1;
assert(
  validatePhysicalState(wrongCount).message.includes("exactly 9"),
  "invalid colour counts are rejected"
);
const wrongCenters = cloneCube(createCube(3));
setStickerColor(wrongCenters, { x: 1, y: 2, z: 1, nx: 0, ny: 1, nz: 0 }, 1);
setStickerColor(wrongCenters, { x: 1, y: 0, z: 1, nx: 0, ny: -1, nz: 0 }, 0);
assert(
  validatePhysicalState(wrongCenters).message.includes("six centre colours"),
  "invalid centre configuration is rejected"
);

const solvedCubies = new Cube().toJSON();
const duplicateCorner = { ...solvedCubies, cp: [...solvedCubies.cp] };
duplicateCorner.cp[0] = duplicateCorner.cp[1];
assert(
  validateCubieState(duplicateCorner)?.includes("corner pieces") ?? false,
  "duplicate corner is rejected"
);
const twistedCorner = { ...solvedCubies, co: [...solvedCubies.co] };
twistedCorner.co[0] = 1;
assert(
  validateCubieState(twistedCorner)?.includes("corner is twisted") ?? false,
  "twisted corner is rejected"
);
const flippedEdge = { ...solvedCubies, eo: [...solvedCubies.eo] };
flippedEdge.eo[0] = 1;
assert(
  validateCubieState(flippedEdge)?.includes("edge is flipped") ?? false,
  "flipped edge is rejected"
);
const oddParity = { ...solvedCubies, cp: [...solvedCubies.cp] };
[oddParity.cp[0], oddParity.cp[1]] = [oddParity.cp[1], oddParity.cp[0]];
assert(
  validateCubieState(oddParity)?.includes("permutation parity") ?? false,
  "impossible parity is rejected"
);

const algorithms = ["R", "U F", "R U F' L2 D B'", "F R U R' U' F'"];
for (const algorithm of algorithms) {
  const ours = createCube(3);
  for (const move of parseCubeAlgorithm(algorithm)) {
    const reps = move.quarters === 2 ? 2 : move.quarters === 1 ? 1 : 3;
    for (let turn = 0; turn < reps; turn++)
      applyMove(ours, { axis: move.axis, layer: move.layer, dir: 1 });
  }
  const expected = new Cube();
  expected.move(algorithm);
  assert(
    validatePhysicalState(ours).facelets === expected.asString(),
    `${algorithm} maps to cubejs orientation`
  );
}

Cube.initSolver();
for (let trial = 0; trial < 12; trial++) {
  const outerMoves = randomScramble(3, 80)
    .filter(move => move.layer !== 1)
    .slice(0, 22);
  const scrambled = applyMoves(createCube(3), outerMoves);
  const validation = validatePhysicalState(scrambled);
  assert(validation.valid && !!validation.facelets, `trial ${trial} validates`);
  if (!validation.facelets) continue;
  const solution = Cube.fromString(validation.facelets).solve();
  for (const move of parseCubeAlgorithm(solution)) {
    const reps = move.quarters === 2 ? 2 : move.quarters === 1 ? 1 : 3;
    for (let turn = 0; turn < reps; turn++)
      applyMove(scrambled, { axis: move.axis, layer: move.layer, dir: 1 });
  }
  assert(isSolved(scrambled), `trial ${trial} arbitrary-state solution solves`);
}

if (failures === 0) console.log("ALL PHYSICAL SOLVER TESTS PASSED");
else process.exit(1);
