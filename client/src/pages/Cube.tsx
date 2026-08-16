import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Palette,
  Pause,
  Play,
  RotateCcw,
  Shuffle,
  Sparkles,
  Square,
  Undo2,
} from "lucide-react";
import { CubeView } from "@/lib/cube/CubeView";
import {
  countStickerColors,
  createCube,
  expandSolution,
  invertMove,
  randomScramble,
  solutionLabel,
  solveFromHistory,
  type Axis,
  type Move,
  type SolutionMove,
} from "@/lib/cube/engine";
import {
  createPhysicalEntryCube,
  parseCubeAlgorithm,
  validatePhysicalState,
} from "@/lib/cube/physicalSolver";
import { solveFacelets } from "@/lib/cube/solverClient";

const SIZES = [2, 3, 4, 5] as const;
const CUBE_COLORS = [
  { id: 0, label: "White", hex: "#f7f7f7" },
  { id: 1, label: "Yellow", hex: "#fdd835" },
  { id: 2, label: "Green", hex: "#00a64f" },
  { id: 3, label: "Blue", hex: "#1466b8" },
  { id: 4, label: "Red", hex: "#c4222f" },
  { id: 5, label: "Orange", hex: "#f07d1a" },
] as const;

type FaceKey = "U" | "D" | "L" | "R" | "F" | "B";
const FACE_MOVES: Record<FaceKey, { axis: Axis; high: boolean; cw: 1 | -1 }> = {
  U: { axis: 1, high: true, cw: -1 },
  D: { axis: 1, high: false, cw: 1 },
  R: { axis: 0, high: true, cw: -1 },
  L: { axis: 0, high: false, cw: 1 },
  F: { axis: 2, high: true, cw: -1 },
  B: { axis: 2, high: false, cw: 1 },
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export default function Cube() {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<CubeView | null>(null);
  const historyRef = useRef<Move[]>([]);

  const [n, setN] = useState(3);
  const [busy, setBusy] = useState(false); // any animation running
  const [solving, setSolving] = useState(false);
  const [paused, setPaused] = useState(false);
  const [solved, setSolved] = useState(true);
  const [moveCount, setMoveCount] = useState(0);
  const [speed, setSpeed] = useState(2); // 0..4
  const [status, setStatus] = useState("Solved");
  const [painting, setPainting] = useState(false);
  const [paintColor, setPaintColor] = useState(0);
  const [colorCounts, setColorCounts] = useState<number[]>(() =>
    Array(6).fill(9)
  );
  const [solutionLabels, setSolutionLabels] = useState<string[]>([]);
  const [solutionIndex, setSolutionIndex] = useState(-1);
  const [physicalSolution, setPhysicalSolution] = useState<SolutionMove[]>([]);
  const [physicalStep, setPhysicalStep] = useState(0);

  const speedRef = useRef(speed);
  speedRef.current = speed;
  const pausedRef = useRef(false);
  const cancelRef = useRef(false);

  const turnDuration = useCallback(() => {
    const map = [620, 420, 280, 170, 90];
    return map[speedRef.current] ?? 280;
  }, []);

  // Build / rebuild the view when n changes.
  useEffect(() => {
    if (!mountRef.current) return;
    let view: CubeView;
    view = new CubeView(mountRef.current, n, {
      onMove: m => {
        historyRef.current.push(m);
        setMoveCount(historyRef.current.length);
        setSolutionLabels([]);
        setSolutionIndex(-1);
      },
      onSolvedChange: s => {
        setSolved(s);
        setStatus(s ? "Solved" : "Scrambled");
      },
      onStickerPaint: state => {
        const counts = countStickerColors(state);
        const entered = counts.reduce((sum, count) => sum + count, 0);
        setColorCounts(counts);
        setStatus(
          entered === 54
            ? "All stickers entered · ready to validate"
            : `${54 - entered} stickers left`
        );
      },
    });
    viewRef.current = view;
    historyRef.current = [];
    setMoveCount(0);
    setSolved(true);
    setStatus("Solved");
    setPainting(false);
    setColorCounts(Array(6).fill(n * n));
    setSolutionLabels([]);
    setSolutionIndex(-1);
    setPhysicalSolution([]);
    setPhysicalStep(0);
    return () => {
      view.dispose();
      viewRef.current = null;
    };
  }, [n, turnDuration]);

  useEffect(() => {
    viewRef.current?.setPaintColor(painting ? paintColor : null);
  }, [painting, paintColor]);

  const pushMove = useCallback(
    async (move: Move) => {
      const view = viewRef.current;
      if (!view || busy || painting || physicalSolution.length > 0) return;
      setBusy(true);
      await view.animateMove(move, turnDuration());
      historyRef.current.push(move);
      setMoveCount(historyRef.current.length);
      setSolutionLabels([]);
      setSolutionIndex(-1);
      setBusy(false);
    },
    [busy, painting, physicalSolution.length, turnDuration]
  );

  const faceMove = useCallback(
    (face: FaceKey, prime: boolean): Move => {
      const def = FACE_MOVES[face];
      const layer = def.high ? n - 1 : 0;
      const dir = (prime ? -def.cw : def.cw) as 1 | -1;
      return { axis: def.axis, layer, dir };
    },
    [n]
  );

  const undo = useCallback(async () => {
    const view = viewRef.current;
    if (!view || busy || solving || painting) return;
    const last = historyRef.current.pop();
    if (!last) return;
    setBusy(true);
    await view.animateMove(invertMove(last), turnDuration());
    setMoveCount(historyRef.current.length);
    setSolutionLabels([]);
    setSolutionIndex(-1);
    setBusy(false);
  }, [busy, painting, solving, turnDuration]);

  const reset = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    cancelRef.current = true;
    pausedRef.current = false;
    setPaused(false);
    setSolving(false);
    setBusy(false);
    view.setState(createCube(n));
    historyRef.current = [];
    setMoveCount(0);
    setStatus("Solved");
    setPainting(false);
    setColorCounts(Array(6).fill(n * n));
    setSolutionLabels([]);
    setSolutionIndex(-1);
    setPhysicalSolution([]);
    setPhysicalStep(0);
  }, [n]);

  const scramble = useCallback(async () => {
    const view = viewRef.current;
    if (!view || busy || solving || painting || physicalSolution.length > 0)
      return;
    setBusy(true);
    setStatus("Scrambling…");
    setSolutionLabels([]);
    setSolutionIndex(-1);
    const moves = randomScramble(n, n * 8);
    for (const m of moves) {
      await view.animateMove(m, 95);
      historyRef.current.push(m);
      setMoveCount(historyRef.current.length);
    }
    setStatus("Scrambled");
    setBusy(false);
  }, [busy, n, painting, physicalSolution.length, solving]);

  const solve = useCallback(async () => {
    const view = viewRef.current;
    if (!view || busy || solving || physicalSolution.length > 0) return;
    if (historyRef.current.length === 0) {
      setStatus("Already solved");
      return;
    }
    const solution = solveFromHistory(historyRef.current);
    const labels = solution.map(m => solutionLabel(m, n));
    setSolutionLabels(labels);
    const quarters = expandSolution(solution);

    setSolving(true);
    setBusy(true);
    setPaused(false);
    pausedRef.current = false;
    cancelRef.current = false;
    setStatus("Solving…");

    // Map each quarter move back to its solution-step index for highlighting.
    const stepOfQuarter: number[] = [];
    solution.forEach((m, i) => {
      const reps = m.quarters === 2 ? 2 : 1;
      for (let r = 0; r < reps; r++) stepOfQuarter.push(i);
    });

    for (let i = 0; i < quarters.length; i++) {
      while (pausedRef.current && !cancelRef.current) await sleep(60);
      if (cancelRef.current) break;
      setSolutionIndex(stepOfQuarter[i]);
      await view.animateMove(quarters[i], turnDuration());
    }

    const finished = !cancelRef.current;
    setSolving(false);
    setBusy(false);
    setPaused(false);
    if (finished) {
      historyRef.current = [];
      setMoveCount(0);
      setSolutionIndex(-1);
      setStatus("Solved");
    } else {
      setStatus("Stopped");
    }
  }, [busy, solving, n, physicalSolution.length, turnDuration]);

  const togglePause = useCallback(() => {
    if (!solving) return;
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  }, [solving]);

  const stopSolve = useCallback(() => {
    cancelRef.current = true;
    pausedRef.current = false;
    setPaused(false);
  }, []);

  const togglePainting = useCallback(() => {
    const view = viewRef.current;
    if (!view || busy || solving) return;
    if (painting) {
      reset();
      return;
    }
    if (n !== 3) {
      setStatus("Choose 3×3 to enter a physical cube");
      return;
    }
    const entry = createPhysicalEntryCube();
    view.setState(entry);
    historyRef.current = [];
    setMoveCount(0);
    setPainting(true);
    setPaintColor(0);
    setColorCounts(countStickerColors(entry));
    setSolutionLabels([]);
    setSolutionIndex(-1);
    setPhysicalSolution([]);
    setPhysicalStep(0);
    setStatus("48 stickers left · white top, green front");
  }, [busy, n, painting, reset, solving]);

  const solvePhysical = useCallback(async () => {
    const view = viewRef.current;
    if (!view || busy || !painting) return;
    const validation = validatePhysicalState(view.state);
    if (!validation.valid || !validation.facelets) {
      setStatus(validation.message);
      return;
    }

    setBusy(true);
    setStatus("Checking pieces…");
    try {
      const algorithm = await solveFacelets(validation.facelets, () =>
        setStatus("Preparing the solver…")
      );
      const moves = parseCubeAlgorithm(algorithm);
      setPainting(false);
      setPhysicalSolution(moves);
      setPhysicalStep(0);
      setSolutionLabels(moves.map(move => solutionLabel(move, 3)));
      setSolutionIndex(moves.length > 0 ? 0 : -1);
      setStatus(
        moves.length > 0
          ? `Solution ready · ${moves.length} steps`
          : "Already solved"
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "The cube state is invalid."
      );
    } finally {
      setBusy(false);
    }
  }, [busy, painting]);

  const stepPhysical = useCallback(
    async (direction: 1 | -1) => {
      const view = viewRef.current;
      if (!view || busy || physicalSolution.length === 0) return;
      const index = direction === 1 ? physicalStep : physicalStep - 1;
      const selected = physicalSolution[index];
      if (!selected) return;
      const move: SolutionMove =
        direction === 1
          ? selected
          : {
              ...selected,
              quarters:
                selected.quarters === 2 ? 2 : selected.quarters === 1 ? -1 : 1,
            };
      setBusy(true);
      for (const quarter of expandSolution([move]))
        await view.animateMove(quarter, turnDuration());
      const nextStep = physicalStep + direction;
      setPhysicalStep(nextStep);
      setSolutionIndex(nextStep);
      setStatus(
        nextStep === physicalSolution.length
          ? "Solved · your physical cube should now match"
          : `Step ${nextStep + 1} of ${physicalSolution.length}`
      );
      setBusy(false);
    },
    [busy, physicalSolution, physicalStep, turnDuration]
  );

  // Keyboard shortcuts for outer faces.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        solving ||
        busy ||
        painting ||
        physicalSolution.length > 0 ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;
      const map: Record<string, FaceKey> = {
        u: "U",
        d: "D",
        l: "L",
        r: "R",
        f: "F",
        b: "B",
      };
      const face = map[e.key.toLowerCase()];
      if (!face) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      )
        return;
      e.preventDefault();
      void pushMove(faceMove(face, e.shiftKey));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [solving, busy, painting, physicalSolution.length, pushMove, faceMove]);

  const faceButtons: FaceKey[] = ["U", "D", "L", "R", "F", "B"];

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#0a0c11] text-zinc-100">
      {/* Studio backdrop */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 120% at 50% 18%, #1a2536 0%, #0e131c 45%, #06080c 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(#9fb4d8 1px, transparent 1px), linear-gradient(90deg, #9fb4d8 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(70% 70% at 50% 40%, #000 0%, transparent 100%)",
        }}
      />

      {/* 3D canvas */}
      <div
        ref={mountRef}
        className="absolute inset-x-0 bottom-48 top-12 sm:inset-0"
      />

      {/* Top bar */}
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-zinc-300 backdrop-blur transition hover:bg-white/10"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Home
          </Link>
          <div>
            <h1 className="font-mono text-sm font-semibold tracking-tight text-zinc-100 sm:text-base">
              Cube Studio
            </h1>
            <p className="hidden text-[11px] text-zinc-400 sm:block">
              Interactive {n}×{n} Rubik’s cube solver
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 p-1 backdrop-blur">
          {SIZES.map(s => (
            <button
              key={s}
              onClick={() =>
                !busy &&
                !solving &&
                !painting &&
                physicalSolution.length === 0 &&
                setN(s)
              }
              disabled={
                busy || solving || painting || physicalSolution.length > 0
              }
              className={`h-7 w-9 rounded-md font-mono text-xs transition disabled:opacity-40 ${
                n === s
                  ? "bg-[#C9A84C] text-[#1a1a2e]"
                  : "text-zinc-300 hover:bg-white/10"
              }`}
            >
              {s}×{s}
            </button>
          ))}
        </div>
      </header>

      {/* Status pill */}
      <div className="absolute inset-x-4 top-16 z-10 flex justify-center">
        <span
          className={`inline-block max-w-full rounded-2xl border px-3 py-1 text-center font-mono text-[11px] backdrop-blur ${
            solved && !painting
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
              : "border-[#C9A84C]/30 bg-[#C9A84C]/10 text-[#e7cf85]"
          }`}
        >
          {status} ·{" "}
          {painting
            ? `${colorCounts.reduce((sum, count) => sum + count, 0)}/54 stickers`
            : physicalSolution.length > 0
              ? `${physicalStep}/${physicalSolution.length} complete`
              : `${moveCount} moves`}
        </span>
      </div>

      {/* Solution ribbon */}
      {solutionLabels.length > 0 && (
        <div className="absolute inset-x-0 bottom-44 z-10 flex justify-center px-4">
          <div className="flex max-w-full flex-col items-center gap-2">
            {physicalSolution.length > 0 && (
              <div className="rounded-xl border border-[#C9A84C]/30 bg-black/55 px-5 py-2 text-center backdrop-blur">
                <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-zinc-400">
                  {physicalStep < physicalSolution.length
                    ? `Next move · step ${physicalStep + 1}`
                    : "Sequence complete"}
                </p>
                <p className="mt-0.5 font-mono text-3xl font-bold text-[#e7cf85]">
                  {physicalStep < solutionLabels.length
                    ? solutionLabels[physicalStep]
                    : "Solved"}
                </p>
              </div>
            )}
            <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-white/10 bg-black/40 px-3 py-2 backdrop-blur">
              {solutionLabels.map((lbl, i) => (
                <span
                  key={i}
                  className={`whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-xs transition ${
                    i === solutionIndex
                      ? "bg-[#C9A84C] text-[#1a1a2e]"
                      : i < solutionIndex
                        ? "text-zinc-500"
                        : "text-zinc-200"
                  }`}
                >
                  {lbl}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {painting ? (
            <div className="flex items-center justify-center gap-1.5 rounded-xl border border-[#C9A84C]/25 bg-black/35 p-2 backdrop-blur">
              <span className="mr-1 hidden font-mono text-[10px] uppercase tracking-wider text-zinc-400 sm:block">
                Pick colour
              </span>
              {CUBE_COLORS.map(color => (
                <button
                  key={color.id}
                  onClick={() => setPaintColor(color.id)}
                  aria-label={`${color.label}, ${colorCounts[color.id]} stickers`}
                  aria-pressed={paintColor === color.id}
                  title={`${color.label} · ${colorCounts[color.id]} / ${n * n}`}
                  className={`relative h-9 w-9 rounded-lg border-2 transition hover:scale-105 ${
                    paintColor === color.id
                      ? "scale-105 border-[#C9A84C] shadow-lg shadow-[#C9A84C]/25"
                      : "border-white/20"
                  }`}
                  style={{ backgroundColor: color.hex }}
                >
                  <span
                    className={`absolute -bottom-1 -right-1 min-w-4 rounded-full px-1 font-mono text-[8px] leading-4 ${
                      color.id < 2
                        ? "bg-zinc-900 text-white"
                        : "bg-white text-zinc-900"
                    }`}
                  >
                    {colorCounts[color.id]}
                  </span>
                </button>
              ))}
            </div>
          ) : physicalSolution.length === 0 ? (
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {faceButtons.map(f => (
                <div
                  key={f}
                  className="flex overflow-hidden rounded-md border border-white/10"
                >
                  <button
                    onClick={() => pushMove(faceMove(f, false))}
                    disabled={busy || solving}
                    className="bg-white/5 px-2.5 py-1.5 font-mono text-xs text-zinc-100 transition hover:bg-white/15 disabled:opacity-40"
                    title={`${f} (key: ${f.toLowerCase()})`}
                  >
                    {f}
                  </button>
                  <button
                    onClick={() => pushMove(faceMove(f, true))}
                    disabled={busy || solving}
                    className="border-l border-white/10 bg-white/5 px-2 py-1.5 font-mono text-xs text-zinc-400 transition hover:bg-white/15 disabled:opacity-40"
                    title={`${f}' (key: shift+${f.toLowerCase()})`}
                  >
                    {f}′
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {/* Primary actions */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {painting ? (
              <>
                <button
                  onClick={togglePainting}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/15 disabled:opacity-40"
                >
                  <RotateCcw className="h-4 w-4" /> Cancel
                </button>
                <button
                  onClick={solvePhysical}
                  disabled={
                    busy ||
                    colorCounts.reduce((sum, count) => sum + count, 0) !== 54
                  }
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#C9A84C] px-4 py-2 text-sm font-semibold text-[#1a1a2e] shadow-lg shadow-[#C9A84C]/20 transition hover:bg-[#d8ba63] disabled:opacity-40"
                >
                  <Sparkles className="h-4 w-4" /> Validate & solve
                </button>
              </>
            ) : physicalSolution.length > 0 ? (
              <>
                <button
                  onClick={() => stepPhysical(-1)}
                  disabled={busy || physicalStep === 0}
                  className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/15 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>
                <button
                  onClick={() => stepPhysical(1)}
                  disabled={busy || physicalStep === physicalSolution.length}
                  className="inline-flex items-center gap-1 rounded-md bg-[#C9A84C] px-4 py-2 text-sm font-semibold text-[#1a1a2e] shadow-lg shadow-[#C9A84C]/20 transition hover:bg-[#d8ba63] disabled:opacity-40"
                >
                  Next step <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={reset}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/15 disabled:opacity-40"
                >
                  <RotateCcw className="h-4 w-4" /> Start over
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={togglePainting}
                  disabled={busy || solving || n !== 3}
                  title={
                    n === 3
                      ? "Enter every sticker from a physical cube"
                      : "Choose 3×3 first"
                  }
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#C9A84C]/35 bg-[#C9A84C]/10 px-3.5 py-2 text-sm font-medium text-[#e7cf85] transition hover:bg-[#C9A84C]/20 disabled:opacity-40"
                >
                  <Palette className="h-4 w-4" /> Enter physical cube
                </button>
                <button
                  onClick={scramble}
                  disabled={busy || solving}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/15 disabled:opacity-40"
                >
                  <Shuffle className="h-4 w-4" /> Scramble
                </button>

                {!solving ? (
                  <button
                    onClick={solve}
                    disabled={busy || solved}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#C9A84C] px-4 py-2 text-sm font-semibold text-[#1a1a2e] shadow-lg shadow-[#C9A84C]/20 transition hover:bg-[#d8ba63] disabled:opacity-40"
                  >
                    <Sparkles className="h-4 w-4" /> Solve demo
                  </button>
                ) : (
                  <>
                    <button
                      onClick={togglePause}
                      className="inline-flex items-center gap-1.5 rounded-md bg-[#C9A84C] px-4 py-2 text-sm font-semibold text-[#1a1a2e] transition hover:bg-[#d8ba63]"
                    >
                      {paused ? (
                        <Play className="h-4 w-4" />
                      ) : (
                        <Pause className="h-4 w-4" />
                      )}
                      {paused ? "Resume" : "Pause"}
                    </button>
                    <button
                      onClick={stopSolve}
                      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/15"
                    >
                      <Square className="h-3.5 w-3.5" /> Stop
                    </button>
                  </>
                )}

                <button
                  onClick={undo}
                  disabled={busy || solving || moveCount === 0}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/15 disabled:opacity-40"
                >
                  <Undo2 className="h-4 w-4" /> Undo
                </button>
                <button
                  onClick={reset}
                  disabled={busy && !solving}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/15 disabled:opacity-40"
                >
                  <RotateCcw className="h-4 w-4" /> Reset
                </button>
              </>
            )}

            {!painting && (
              <div className="ml-1 flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                  Speed
                </span>
                <input
                  type="range"
                  min={0}
                  max={4}
                  value={speed}
                  onChange={e => setSpeed(Number(e.target.value))}
                  className="h-1 w-24 cursor-pointer accent-[#C9A84C]"
                />
              </div>
            )}
          </div>

          <p className="text-center text-[11px] text-zinc-500">
            {painting
              ? "Hold your cube with white on top and green facing you · paint every grey sticker · drag the background to inspect hidden faces"
              : physicalSolution.length > 0
                ? "Perform the highlighted move on your physical cube, then press Next step · prime (′) means anticlockwise"
                : "Drag the background to orbit · drag a face to turn it · scroll to zoom · keys U D L R F B"}
          </p>

          <p className="text-center text-[11px] text-zinc-600">
            Made by Tim, for Tim ·{" "}
            <a
              href="https://github.com/TimGivney/TimGivney.github.io"
              target="_blank"
              rel="noreferrer"
              className="text-zinc-400 underline-offset-2 transition hover:text-[#C9A84C] hover:underline"
            >
              Open source on GitHub
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
