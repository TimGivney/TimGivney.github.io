import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
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
  createCube,
  expandSolution,
  invertMove,
  randomScramble,
  solutionLabel,
  solveFromHistory,
  type Axis,
  type Move,
} from "@/lib/cube/engine";

const SIZES = [2, 3, 4, 5] as const;

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

  const [n, setN] = useState(5);
  const [busy, setBusy] = useState(false); // any animation running
  const [solving, setSolving] = useState(false);
  const [paused, setPaused] = useState(false);
  const [solved, setSolved] = useState(true);
  const [moveCount, setMoveCount] = useState(0);
  const [speed, setSpeed] = useState(2); // 0..4
  const [status, setStatus] = useState("Solved");
  const [solutionLabels, setSolutionLabels] = useState<string[]>([]);
  const [solutionIndex, setSolutionIndex] = useState(-1);

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
    const view = new CubeView(mountRef.current, n, {
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
    });
    viewRef.current = view;
    historyRef.current = [];
    setMoveCount(0);
    setSolved(true);
    setStatus("Solved");
    setSolutionLabels([]);
    setSolutionIndex(-1);
    return () => {
      view.dispose();
      viewRef.current = null;
    };
  }, [n]);

  const pushMove = useCallback(
    async (move: Move) => {
      const view = viewRef.current;
      if (!view || busy) return;
      setBusy(true);
      await view.animateMove(move, turnDuration());
      historyRef.current.push(move);
      setMoveCount(historyRef.current.length);
      setSolutionLabels([]);
      setSolutionIndex(-1);
      setBusy(false);
    },
    [busy, turnDuration]
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
    if (!view || busy || solving) return;
    const last = historyRef.current.pop();
    if (!last) return;
    setBusy(true);
    await view.animateMove(invertMove(last), turnDuration());
    setMoveCount(historyRef.current.length);
    setSolutionLabels([]);
    setSolutionIndex(-1);
    setBusy(false);
  }, [busy, solving, turnDuration]);

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
    setSolutionLabels([]);
    setSolutionIndex(-1);
  }, [n]);

  const scramble = useCallback(async () => {
    const view = viewRef.current;
    if (!view || busy || solving) return;
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
  }, [busy, solving, n, turnDuration]);

  const solve = useCallback(async () => {
    const view = viewRef.current;
    if (!view || busy || solving) return;
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
  }, [busy, solving, n, turnDuration]);

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

  // Keyboard shortcuts for outer faces.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (solving || busy) return;
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
      if (e.target instanceof HTMLInputElement) return;
      e.preventDefault();
      void pushMove(faceMove(face, e.shiftKey));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [solving, busy, pushMove, faceMove]);

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
      <div ref={mountRef} className="absolute inset-0" />

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
              onClick={() => !busy && !solving && setN(s)}
              disabled={busy || solving}
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
      <div className="absolute left-1/2 top-16 z-10 -translate-x-1/2">
        <span
          className={`rounded-full border px-3 py-1 font-mono text-[11px] backdrop-blur ${
            solved
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
              : "border-[#C9A84C]/30 bg-[#C9A84C]/10 text-[#e7cf85]"
          }`}
        >
          {status} · {moveCount} moves
        </span>
      </div>

      {/* Solution ribbon */}
      {solutionLabels.length > 0 && (
        <div className="absolute inset-x-0 bottom-44 z-10 flex justify-center px-4">
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
      )}

      {/* Bottom controls */}
      <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {/* Face turn buttons */}
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

          {/* Primary actions */}
          <div className="flex flex-wrap items-center justify-center gap-2">
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
                disabled={busy || solving || solved}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#C9A84C] px-4 py-2 text-sm font-semibold text-[#1a1a2e] shadow-lg shadow-[#C9A84C]/20 transition hover:bg-[#d8ba63] disabled:opacity-40"
              >
                <Sparkles className="h-4 w-4" /> Solve
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
          </div>

          <p className="text-center text-[11px] text-zinc-500">
            Drag the background to orbit · drag a face to turn it · scroll to
            zoom · keys U D L R F B (hold Shift to reverse)
          </p>
        </div>
      </div>
    </div>
  );
}
