import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, RotateCcw, Shuffle } from "lucide-react";
import type { ToxicView } from "@/lib/toxic/ToxicView";

// A few striking specimens to land the preview on.
const SPOTS = [
  "sarscov2",
  "meningococcus",
  "ebola",
  "ragweed",
  "dna",
  "hiv",
  "rabies",
];

const NAMES: Record<string, string> = {
  sarscov2: "SARS-CoV-2",
  meningococcus: "Meningococcus",
  ebola: "Ebola virus",
  ragweed: "Ragweed pollen",
  dna: "Your DNA",
  hiv: "HIV",
  rabies: "Rabies virus",
};

/**
 * Compact, interactive 3D specimen for the homepage. The Three.js viewer loads
 * lazily (only once scrolled into view) so it never weighs down the initial
 * page load. The full gallery lives at /toxic.
 */
export default function HomeToxicWidget() {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<ToxicView | null>(null);
  const [ready, setReady] = useState(false);
  const [current, setCurrent] = useState("sarscov2");

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    let cancelled = false;
    const io = new IntersectionObserver(
      async entries => {
        if (!entries[0].isIntersecting || viewRef.current) return;
        io.disconnect();
        const { ToxicView } = await import("@/lib/toxic/ToxicView");
        if (cancelled || !mountRef.current) return;
        const view = new ToxicView(mountRef.current, { autoRotate: true });
        view.setSpecimen("sarscov2");
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
    view.setSpecimen(next);
    view.resetView();
  };

  const reset = () => {
    const view = viewRef.current;
    if (!view) return;
    view.setSpecimen("sarscov2");
    setCurrent("sarscov2");
    view.resetView();
  };

  const btn =
    "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-sm font-semibold" style={{ color: "#1B3F6B" }}>
          Interactive specimen
        </p>
        <span className="text-xs text-gray-400">{NAMES[current]}</span>
      </div>

      <div className="relative flex-1 overflow-hidden rounded-xl bg-[#05060a] ring-1 ring-gray-200">
        <div ref={mountRef} className="h-full min-h-[24rem] w-full" />
        {!ready && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-400">
            Loading specimen…
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
          <Shuffle size={15} /> Random specimen
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
          href="/toxic"
          className="ml-auto inline-flex items-center gap-1 text-sm font-semibold transition-opacity hover:opacity-70"
          style={{ color: "#C9A84C" }}
        >
          Open Toxic <ArrowUpRight size={15} />
        </Link>
      </div>

      <p className="mt-2 text-xs text-gray-400">
        Drag to orbit · scroll to zoom. Pathogens, pollens &amp; you — in 3D,
        under the microscope, and to scale.
      </p>
    </div>
  );
}
