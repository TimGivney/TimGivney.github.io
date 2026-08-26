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
assert(solved.valid, "solved 3×3 cube validates");
assert(
  solved.facelets === "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB",
  "solved cube uses cubejs facelet order"
);

assert(
  validatePhysicalState(createPhysicalEntryCube()).message.includes(
    "48 stickers"
  ),
  "3×3 entry cube reports incomplete stickers"
);
assert(
  validatePhysicalState(createPhysicalEntryCube(2)).message.includes(
    "24 stickers"
  ),
  "2×2 entry cube reports incomplete stickers"
);
const solvedTwo = validatePhysicalState(createCube(2));
assert(solvedTwo.valid && !!solvedTwo.cubies, "solved 2×2 cube validates");
assert(
  solvedTwo.cubies?.cp.every((piece, position) => piece === position) ?? false,
  "solved 2×2 corners map to the cubejs order"
);
const twistedTwoCorner = cloneCube(createCube(2));
setStickerColor(twistedTwoCorner, { x: 1, y: 1, z: 1, nx: 0, ny: 1, nz: 0 }, 2);
setStickerColor(twistedTwoCorner, { x: 1, y: 1, z: 1, nx: 1, ny: 0, nz: 0 }, 0);
setStickerColor(twistedTwoCorner, { x: 1, y: 1, z: 1, nx: 0, ny: 0, nz: 1 }, 4);
assert(
  validatePhysicalState(twistedTwoCorner).message.includes("corner is twisted"),
  "a single twisted 2×2 corner is rejected"
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

for (const algorithm of algorithms) {
  const ours = createCube(2);
  for (const move of parseCubeAlgorithm(algorithm, 2)) {
    const reps = move.quarters === 2 ? 2 : move.quarters === 1 ? 1 : 3;
    for (let turn = 0; turn < reps; turn++)
      applyMove(ours, { axis: move.axis, layer: move.layer, dir: 1 });
  }
  const expected = new Cube();
  expected.move(algorithm);
  const validation = validatePhysicalState(ours);
  assert(validation.valid && !!validation.cubies, `${algorithm} 2×2 validates`);
  assert(
    JSON.stringify(validation.cubies?.cp) ===
      JSON.stringify(expected.toJSON().cp),
    `${algorithm} maps 2×2 corner permutation to cubejs`
  );
  assert(
    JSON.stringify(validation.cubies?.co) ===
      JSON.stringify(expected.toJSON().co),
    `${algorithm} maps 2×2 corner orientation to cubejs`
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
  assert(
    isSolved(scrambled),
    `3×3 trial ${trial} arbitrary-state solution solves`
  );
}

for (let trial = 0; trial < 20; trial++) {
  const scrambleMoves = randomScramble(2, 18);
  const scrambled = applyMoves(createCube(2), scrambleMoves);
  const validation = validatePhysicalState(scrambled);
  assert(
    validation.valid && !!validation.cubies,
    `2×2 trial ${trial} validates`
  );
  if (!validation.cubies) continue;
  const solution = new Cube(validation.cubies).solve();
  for (const move of parseCubeAlgorithm(solution, 2)) {
    const reps = move.quarters === 2 ? 2 : move.quarters === 1 ? 1 : 3;
    for (let turn = 0; turn < reps; turn++)
      applyMove(scrambled, { axis: move.axis, layer: move.layer, dir: 1 });
  }
  assert(
    isSolved(scrambled),
    `2×2 trial ${trial} arbitrary-state solution solves`
  );
}

if (failures === 0) console.log("ALL PHYSICAL SOLVER TESTS PASSED");
else process.exit(1);
