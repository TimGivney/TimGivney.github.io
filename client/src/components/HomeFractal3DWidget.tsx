import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, Palette, RotateCcw, Shuffle } from "lucide-react";
import type {
  Fractal3DParams,
  Fractal3DType,
  Fractal3DView,
} from "@/lib/fractal/Fractal3DView";

const PALETTE_NAMES = ["Ember", "Ice", "Spectrum", "Gold", "Azure"];

// Light-blue "Azure" palette to match the site's theme.
const DEFAULT_PALETTE = 4;

// A handful of striking fractals to drop the preview on with "Surprise me".
const SPOTS: { type: Fractal3DType; params: Partial<Fractal3DParams> }[] = [
  { type: "mandelbulb", params: { type: "mandelbulb", power: 8 } },
  { type: "mandelbulb", params: { type: "mandelbulb", power: 6 } },
  { type: "mandelbox", params: { type: "mandelbox", boxScale: -1.8 } },
  { type: "mandelbox", params: { type: "mandelbox", boxScale: -2.2 } },
  {
    type: "julia",
    params: { type: "julia", juliaC: [-0.45, 0.6, 0.2, 0.0] },
  },
  {
    type: "julia",
    params: { type: "julia", juliaC: [-0.125, -0.256, 0.847, 0.0895] },
  },
];

/**
 * Compact, interactive 3D fractal for the homepage. The WebGL ray-marcher is
 * loaded lazily (only once the widget scrolls into view) so it never weighs
 * down the initial page load. The full explorer lives at /fractal3d.
 */
export default function HomeFractal3DWidget() {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<Fractal3DView | null>(null);
  const [ready, setReady] = useState(false);
  const [palette, setPalette] = useState(DEFAULT_PALETTE);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    let cancelled = false;
    const io = new IntersectionObserver(
      async entries => {
        if (!entries[0].isIntersecting || viewRef.current) return;
        io.disconnect();
        const { Fractal3DView } = await import("@/lib/fractal/Fractal3DView");
        if (cancelled || !mountRef.current) return;
        const view = new Fractal3DView(mountRef.current, {});
        view.setParams({
          type: "mandelbulb",
          power: 8,
          iterations: 8,
          palette: DEFAULT_PALETTE,
          quality: 0.5,
          glow: 0.7,
        });
        view.setAutoRotate(true);
        view.setColorCycle(true);
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

  const surprise = async () => {
    const view = viewRef.current;
    if (!view) return;
    const spot = SPOTS[Math.floor(Math.random() * SPOTS.length)];
    view.setParams(spot.params);
    const { defaultDistanceFor } = await import("@/lib/fractal/Fractal3DView");
    view.setCamera({ dist: defaultDistanceFor(spot.type) });
  };

  const cyclePalette = () => {
    const view = viewRef.current;
    if (!view) return;
    const next = (palette + 1) % PALETTE_NAMES.length;
    setPalette(next);
    view.setParams({ palette: next });
  };

  const reset = () => {
    const view = viewRef.current;
    if (!view) return;
    view.setParams({ type: "mandelbulb", power: 8, palette: DEFAULT_PALETTE });
    setPalette(DEFAULT_PALETTE);
    view.resetCamera();
  };

  const btn =
    "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-sm font-semibold" style={{ color: "#1B3F6B" }}>
          Interactive 3D fractal
        </p>
        <span className="text-xs text-gray-400">{PALETTE_NAMES[palette]}</span>
      </div>

      <div className="relative flex-1 overflow-hidden rounded-xl bg-[#05060a] ring-1 ring-gray-200">
        <div ref={mountRef} className="h-full min-h-[24rem] w-full" />
        {!ready && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-400">
            Loading 3D fractal…
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
          href="/fractal3d"
          className="ml-auto inline-flex items-center gap-1 text-sm font-semibold transition-opacity hover:opacity-70"
          style={{ color: "#C9A84C" }}
        >
          Open Fractal Lab 3D <ArrowUpRight size={15} />
        </Link>
      </div>

      <p className="mt-2 text-xs text-gray-400">
        Drag to orbit · scroll to zoom. Mandelbulb, Mandelbox &amp; quaternion
        Julia in Fractal Lab 3D.
      </p>
    </div>
  );
}
