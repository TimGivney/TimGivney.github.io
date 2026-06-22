import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, Palette, RotateCcw, Shuffle } from "lucide-react";
import type { FractalView } from "@/lib/fractal/FractalView";

// Pretty places to drop the mini explorer on "Surprise me".
const SPOTS: { cx: number; cy: number; scale: number }[] = [
  { cx: -0.743644, cy: 0.131826, scale: 0.012 }, // Seahorse
  { cx: 0.275, cy: 0.007, scale: 0.06 }, // Elephant
  { cx: -0.088, cy: 0.654, scale: 0.05 }, // Triple spiral
  { cx: -1.749, cy: 0.0, scale: 0.02 }, // Mini-brot
  { cx: -0.235125, cy: 0.827215, scale: 0.004 }, // Tendrils
];

const PALETTE_NAMES = ["Ember", "Ice", "Spectrum", "Gold"];

/**
 * Compact, interactive fractal for the homepage. The WebGL renderer is loaded
 * lazily (only once the widget scrolls into view) so it never weighs down the
 * initial page load. The full explorer lives at /fractal.
 */
export default function HomeFractalWidget() {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<FractalView | null>(null);
  const [ready, setReady] = useState(false);
  const [palette, setPalette] = useState(2);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    let cancelled = false;
    const io = new IntersectionObserver(
      async entries => {
        if (!entries[0].isIntersecting || viewRef.current) return;
        io.disconnect();
        const { FractalView } = await import("@/lib/fractal/FractalView");
        if (cancelled || !mountRef.current) return;
        const view = new FractalView(mountRef.current, {});
        view.setParams({ palette: 2, maxIter: 400, colorScale: 1.2 });
        view.setState({ centerX: -0.743644, centerY: 0.131826, scale: 0.012 });
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
    const spot = SPOTS[Math.floor(Math.random() * SPOTS.length)];
    view.setState({ centerX: spot.cx, centerY: spot.cy, scale: spot.scale });
  };

  const cyclePalette = () => {
    const view = viewRef.current;
    if (!view) return;
    const next = (palette + 1) % PALETTE_NAMES.length;
    setPalette(next);
    view.setParams({ palette: next });
  };

  const reset = () => {
    viewRef.current?.setState({
      centerX: -0.743644,
      centerY: 0.131826,
      scale: 0.012,
    });
  };

  const btn =
    "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-sm font-semibold" style={{ color: "#1B3F6B" }}>
          Interactive fractal
        </p>
        <span className="text-xs text-gray-400">{PALETTE_NAMES[palette]}</span>
      </div>

      <div className="relative flex-1 overflow-hidden rounded-xl bg-[#05060a] ring-1 ring-gray-200">
        <div ref={mountRef} className="h-full min-h-[24rem] w-full" />
        {!ready && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-400">
            Loading fractal…
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
          <Shuffle size={15} /> Surprise me
        </button>
        <button
          type="button"
          onClick={cyclePalette}
          disabled={!ready}
          className={`${btn} text-white`}
          style={{ backgroundColor: "#1B3F6B" }}
        >
          <Palette size={15} /> Palette
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
          href="/fractal"
          className="ml-auto inline-flex items-center gap-1 text-sm font-semibold transition-opacity hover:opacity-70"
          style={{ color: "#C9A84C" }}
        >
          Open Fractal Lab <ArrowUpRight size={15} />
        </Link>
      </div>

      <p className="mt-2 text-xs text-gray-400">
        Drag to pan · scroll to zoom. Full Mandelbrot/Julia explorer in Fractal
        Lab.
      </p>
    </div>
  );
}
