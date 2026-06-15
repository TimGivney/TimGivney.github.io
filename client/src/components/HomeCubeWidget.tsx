import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, RotateCcw, Shuffle, Sparkles } from "lucide-react";
import {
  createCube,
  expandSolution,
  randomScramble,
  solveFromHistory,
  type Move,
} from "@/lib/cube/engine";
import type { CubeView } from "@/lib/cube/CubeView";

const N = 5;

/**
 * Compact, interactive 5x5 cube for the homepage. Three.js is loaded lazily
 * (only once the widget scrolls into view) so it never weighs down the initial
 * page load. The full NxN studio lives at /cube.
 */
export default function HomeCubeWidget() {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<CubeView | null>(null);
  const historyRef = useRef<Move[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hasMoves, setHasMoves] = useState(false);
  const [status, setStatus] = useState<"Solved" | "Scrambled" | "Solving…">(
    "Solved"
  );

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    let cancelled = false;
    const io = new IntersectionObserver(
      async entries => {
        if (!entries[0].isIntersecting || viewRef.current) return;
        io.disconnect();
        const { CubeView } = await import("@/lib/cube/CubeView");
        if (cancelled || !mountRef.current) return;
        viewRef.current = new CubeView(mountRef.current, N, {
          distanceScale: 0.7,
          onMove: m => {
            historyRef.current.push(m);
            setHasMoves(true);
          },
          onSolvedChange: s => setStatus(s ? "Solved" : "Scrambled"),
        });
        setReady(true);
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
      viewRef.current?.dispose();
      viewRef.current = null;
    };
  }, []);

  const scramble = async () => {
    const view = viewRef.current;
    if (!view || busy) return;
    setBusy(true);
    setStatus("Scrambled");
    for (const m of randomScramble(N, 30)) {
      await view.animateMove(m, 95);
      historyRef.current.push(m);
    }
    setHasMoves(true);
    setBusy(false);
  };

  const solve = async () => {
    const view = viewRef.current;
    if (!view || busy || historyRef.current.length === 0) return;
    setBusy(true);
    setStatus("Solving…");
    const quarters = expandSolution(solveFromHistory(historyRef.current));
    for (const q of quarters) await view.animateMove(q, 150);
    historyRef.current = [];
    setHasMoves(false);
    setStatus("Solved");
    setBusy(false);
  };

  const reset = () => {
    const view = viewRef.current;
    if (!view || busy) return;
    view.setState(createCube(N));
    historyRef.current = [];
    setHasMoves(false);
    setStatus("Solved");
  };

  const btn =
    "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-sm font-semibold" style={{ color: "#1B3F6B" }}>
          Interactive cube
        </p>
        <span className="text-xs text-gray-400">{status}</span>
      </div>

      <div className="relative flex-1 overflow-hidden rounded-xl bg-gradient-to-b from-gray-50 to-gray-100 ring-1 ring-gray-200">
        <div ref={mountRef} className="h-full min-h-[24rem] w-full" />
        {!ready && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-400">
            Loading cube…
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={scramble}
          disabled={!ready || busy}
          className={btn}
          style={{ backgroundColor: "#EEF3F9", color: "#1B3F6B" }}
        >
          <Shuffle size={15} /> Scramble
        </button>
        <button
          type="button"
          onClick={solve}
          disabled={!ready || busy || !hasMoves}
          className={`${btn} text-white`}
          style={{ backgroundColor: "#1B3F6B" }}
        >
          <Sparkles size={15} /> Solve
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={!ready || busy}
          className={`${btn} text-gray-600 hover:text-gray-900`}
        >
          <RotateCcw size={15} /> Reset
        </button>
        <Link
          href="/cube"
          className="ml-auto inline-flex items-center gap-1 text-sm font-semibold transition-opacity hover:opacity-70"
          style={{ color: "#C9A84C" }}
        >
          Open Cube Studio <ArrowUpRight size={15} />
        </Link>
      </div>

      <p className="mt-2 text-xs text-gray-400">
        Drag to rotate · scramble, then solve. Full 2×2–5×5 solver in Cube
        Studio.
      </p>
    </div>
  );
}
