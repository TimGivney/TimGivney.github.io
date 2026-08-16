import {
  applyMove,
  applyMoves,
  applySolutionMove,
  cloneCube,
  countStickerColors,
  createCube,
  expandSolution,
  findStickerPlacementMoves,
  isSolved,
  randomScramble,
  simplify,
  solveFromHistory,
  type Axis,
  type Move,
} from "./engine.ts";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  }
}

// 1. Fresh cube is solved.
for (const n of [2, 3, 4, 5]) {
  assert(isSolved(createCube(n)), `n=${n} fresh cube solved`);
}

// 2. Sticker counts are correct (6 * n^2).
for (const n of [2, 3, 4, 5]) {
  assert(createCube(n).stickers.length === 6 * n * n, `n=${n} sticker count`);
}

// 3. Any single move repeated 4x returns to solved.
for (const n of [3, 4, 5]) {
  for (let axis = 0 as Axis; axis < 3; axis = (axis + 1) as Axis) {
    for (let layer = 0; layer < n; layer++) {
      const c = createCube(n);
      for (let i = 0; i < 4; i++) applyMove(c, { axis, layer, dir: 1 });
      assert(isSolved(c), `n=${n} axis=${axis} layer=${layer} x4 solved`);
    }
  }
}

// 4. A move followed by its inverse is identity.
for (const n of [3, 4, 5]) {
  for (let axis = 0 as Axis; axis < 3; axis = (axis + 1) as Axis) {
    for (let layer = 0; layer < n; layer++) {
      const c = createCube(n);
      applyMove(c, { axis, layer, dir: 1 });
      applyMove(c, { axis, layer, dir: -1 });
      assert(isSolved(c), `n=${n} axis=${axis} layer=${layer} move+inverse`);
    }
  }
}

// 5. A scramble is (almost surely) not solved, and reversing history solves it.
for (const n of [2, 3, 4, 5]) {
  for (let trial = 0; trial < 200; trial++) {
    const c = createCube(n);
    const history: Move[] = randomScramble(n, 40);
    applyMoves(c, history);
    if (n >= 3)
      assert(!isSolved(c), `n=${n} trial=${trial} scramble not solved`);

    const sol = solveFromHistory(history);
    const test = cloneCube(c);
    for (const m of sol) applySolutionMove(test, m);
    assert(isSolved(test), `n=${n} trial=${trial} solution solves cube`);
  }
}

// 6. expandSolution applied equals applySolutionMove applied.
for (let trial = 0; trial < 100; trial++) {
  const n = 5;
  const history = randomScramble(n, 50);
  const sol = solveFromHistory(history);
  const a = createCube(n);
  applyMoves(a, history);
  const b = cloneCube(a);
  for (const m of sol) applySolutionMove(a, m);
  for (const m of expandSolution(sol)) applyMove(b, m);
  assert(isSolved(a) && isSolved(b), `trial=${trial} expand matches`);
}

// 7. simplify never produces a longer sequence than the input quarter count.
for (let trial = 0; trial < 100; trial++) {
  const n = 5;
  const moves = randomScramble(n, 60);
  const sol = simplify(moves);
  assert(sol.length <= moves.length, `trial=${trial} simplify not longer`);
}

// 8. Colour placement uses legal moves and remains solvable for every size.
for (const n of [2, 3, 4, 5]) {
  const solved = createCube(n);
  for (const target of solved.stickers) {
    for (let color = 0; color < 6; color++) {
      const moves = findStickerPlacementMoves(solved, target, color);
      assert(moves !== null, `n=${n} colour=${color} placement path exists`);
      if (!moves) continue;
      const placed = cloneCube(solved);
      applyMoves(placed, moves);
      const sticker = placed.stickers.find(
        candidate =>
          candidate.x === target.x &&
          candidate.y === target.y &&
          candidate.z === target.z &&
          candidate.nx === target.nx &&
          candidate.ny === target.ny &&
          candidate.nz === target.nz
      );
      assert(
        sticker?.color === color,
        `n=${n} colour=${color} reaches target square`
      );
      assert(
        countStickerColors(placed).every(count => count === n * n),
        `n=${n} colour=${color} preserves sticker counts`
      );
      const restored = cloneCube(placed);
      for (const move of solveFromHistory(moves))
        applySolutionMove(restored, move);
      assert(isSolved(restored), `n=${n} colour=${color} placement solves`);
    }
  }
}

// 9. Colour placement also works after an existing scramble.
for (const n of [2, 3, 4, 5]) {
  for (let trial = 0; trial < 100; trial++) {
    const history = randomScramble(n, n * 8);
    const cube = applyMoves(createCube(n), history);
    const target = {
      ...cube.stickers[Math.floor(Math.random() * cube.stickers.length)],
    };
    const color = Math.floor(Math.random() * 6);
    const placement = findStickerPlacementMoves(cube, target, color);
    assert(
      placement !== null,
      `n=${n} trial=${trial} scrambled placement path`
    );
    if (!placement) continue;
    applyMoves(cube, placement);
    const sticker = cube.stickers.find(
      candidate =>
        candidate.x === target.x &&
        candidate.y === target.y &&
        candidate.z === target.z &&
        candidate.nx === target.nx &&
        candidate.ny === target.ny &&
        candidate.nz === target.nz
    );
    assert(
      sticker?.color === color,
      `n=${n} trial=${trial} scrambled placement reaches target`
    );
    for (const move of solveFromHistory([...history, ...placement]))
      applySolutionMove(cube, move);
    assert(isSolved(cube), `n=${n} trial=${trial} scrambled placement solves`);
  }
}

// 10. Colour placement rejects invalid requests.
{
  const cube = createCube(3);
  const target = { ...cube.stickers[0] };
  assert(
    findStickerPlacementMoves(cube, target, -1) === null,
    "placement rejects negative colours"
  );
  assert(
    findStickerPlacementMoves(cube, target, 6) === null,
    "placement rejects colours outside the palette"
  );
  assert(
    findStickerPlacementMoves(
      cube,
      { x: -1, y: 0, z: 0, nx: -1, ny: 0, nz: 0 },
      0
    ) === null,
    "placement rejects missing sticker addresses"
  );
}

if (failures === 0) console.log("ALL ENGINE TESTS PASSED");
else {
  console.error(`${failures} FAILURES`);
  process.exit(1);
}
