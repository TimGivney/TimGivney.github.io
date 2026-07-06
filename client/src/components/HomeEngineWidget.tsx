import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, RotateCcw, Shuffle } from "lucide-react";
import type { EngineView } from "@/lib/engine/EngineView";

// A few landmark engines to land the preview on.
const SPOTS = [
  "holden-v8",
  "repco-rb620",
  "ford-barra",
  "rotec-r3600",
  "ronaldson-austral",
  "sarich-orbital",
  "cac-avon",
];

const NAMES: Record<string, string> = {
  "holden-v8": "Holden V8",
  "repco-rb620": "Repco-Brabham V8",
  "ford-barra": "Ford Barra",
  "rotec-r3600": "Rotec R3600 radial",
  "ronaldson-austral": "Ronaldson-Tippett",
  "sarich-orbital": "Sarich Orbital",
  "cac-avon": "CAC Avon turbojet",
};

const START = "holden-v8";

/**
 * Compact, interactive 3D engine for the homepage. The Three.js viewer loads
 * lazily (only once scrolled into view). The full catalogue lives at /ausengine.
 */
export default function HomeEngineWidget() {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EngineView | null>(null);
  const [ready, setReady] = useState(false);
  const [current, setCurrent] = useState(START);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    let cancelled = false;
    const io = new IntersectionObserver(
      async entries => {
        if (!entries[0].isIntersecting || viewRef.current) return;
        io.disconnect();
        const { EngineView } = await import("@/lib/engine/EngineView");
        if (cancelled || !mountRef.current) return;
        const view = new EngineView(mountRef.current, { autoRotate: true });
        view.setEngine(START);
        viewRef.current = view;
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

  const surprise = () => {
    const view = viewRef.current;
    if (!view) return;
    let next = current;
    while (next === current) next = SPOTS[Math.floor(Math.random() * SPOTS.length)];
    setCurrent(next);
    view.setEngine(next);
    view.resetView();
  };

  const reset = () => {
    const view = viewRef.current;
    if (!view) return;
    view.setEngine(START);
    setCurrent(START);
    view.resetView();
  };

  const btn =
    "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-sm font-semibold" style={{ color: "#1B3F6B" }}>
          Interactive engine
        </p>
        <span className="text-xs text-gray-400">{NAMES[current]}</span>
      </div>

      <div className="relative flex-1 overflow-hidden rounded-xl bg-[#05060a] ring-1 ring-gray-200">
        <div ref={mountRef} className="h-full min-h-[24rem] w-full" />
        {!ready && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-400">
            Loading engine…
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={surprise}
          disabled={!ready}
          className={btn}
          style={{ backgroundColor: "#EEF3F9", color: "#1B3F6B" }}
        >
          <Shuffle size={15} /> Random engine
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={!ready}
          className={`${btn} text-gray-600 hover:text-gray-900`}
        >
          <RotateCcw size={15} /> Reset
        </button>
        <Link
          href="/ausengine"
          className="ml-auto inline-flex items-center gap-1 text-sm font-semibold transition-opacity hover:opacity-70"
          style={{ color: "#C9A84C" }}
        >
          Open Aus Engines <ArrowUpRight size={15} />
        </Link>
      </div>

      <p className="mt-2 text-xs text-gray-400">
        Drag to orbit · scroll to zoom. Every engine designed &amp; built in
        Australia — in 3D, with a chronological timeline.
      </p>
    </div>
  );
}
