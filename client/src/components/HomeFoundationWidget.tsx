import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, RotateCcw, Shuffle } from "lucide-react";
import type { FoundationView } from "@/lib/foundation/FoundationView";
import type { TerrainPreset } from "@/lib/foundation/foundation";

const SPOTS: { preset: TerrainPreset; slope: number; rough: number; label: string }[] = [
  { preset: "sloped", slope: 2.8, rough: 0.6, label: "Sloping block" },
  { preset: "rolling", slope: 1.8, rough: 1.1, label: "Rolling terrain" },
  { preset: "ridge", slope: 2.6, rough: 0.7, label: "Ridge" },
  { preset: "gully", slope: 2.4, rough: 0.6, label: "Gully" },
  { preset: "gentle", slope: 1.4, rough: 0.4, label: "Gentle fall" },
];

const START = 0;

/**
 * Compact interactive foundation preview for the homepage: a synthetic sloping
 * site with auto-placed piers, spun slowly. The full studio (upload scans,
 * schedule, CSV/DXF export) lives at /foundation.
 */
export default function HomeFoundationWidget() {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<FoundationView | null>(null);
  const [ready, setReady] = useState(false);
  const [idx, setIdx] = useState(START);

  const render = async (i: number) => {
    const view = viewRef.current;
    if (!view) return;
    const [{ synthTerrain, designFoundation, DEFAULT_PARAMS }] = await Promise.all([
      import("@/lib/foundation/foundation"),
    ]);
    const spot = SPOTS[i];
    const dem = synthTerrain(spot.preset, 12, spot.slope, spot.rough);
    const result = designFoundation(dem, { ...DEFAULT_PARAMS, maxSpan: 2.4 });
    view.update(dem, result);
    view.frame();
  };

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    let cancelled = false;
    const io = new IntersectionObserver(
      async entries => {
        if (!entries[0].isIntersecting || viewRef.current) return;
        io.disconnect();
        const { FoundationView } = await import("@/lib/foundation/FoundationView");
        if (cancelled || !mountRef.current) return;
        const view = new FoundationView(mountRef.current, { autoRotate: true });
        viewRef.current = view;
        await render(START);
        if (cancelled) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const surprise = () => {
    let next = idx;
    while (next === idx) next = Math.floor(Math.random() * SPOTS.length);
    setIdx(next);
    void render(next);
  };

  const reset = () => {
    setIdx(START);
    void render(START);
  };

  const btn =
    "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-sm font-semibold" style={{ color: "#1B3F6B" }}>
          Auto foundation layout
        </p>
        <span className="text-xs text-gray-400">{SPOTS[idx].label}</span>
      </div>

      <div className="relative flex-1 overflow-hidden rounded-xl bg-[#05060a] ring-1 ring-gray-200">
        <div ref={mountRef} className="h-full min-h-[24rem] w-full" />
        {!ready && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-400">
            Loading terrain…
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
          <Shuffle size={15} /> Random site
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
          href="/foundation"
          className="ml-auto inline-flex items-center gap-1 text-sm font-semibold transition-opacity hover:opacity-70"
          style={{ color: "#C9A84C" }}
        >
          Open Foundation studio <ArrowUpRight size={15} />
        </Link>
      </div>

      <p className="mt-2 text-xs text-gray-400">
        Drag to orbit · scroll to zoom. Piers auto-placed &amp; height-scheduled from the terrain — upload
        your own scan and export the schedule in the full studio.
      </p>
    </div>
  );
}
