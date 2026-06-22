import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Download,
  Github,
  Microscope,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  FractalView,
  type FractalState,
} from "@/lib/fractal/FractalView";

const PALETTES = ["Ember", "Ice", "Spectrum", "Gold", "Azure"] as const;

// A few hand-picked Julia constants worth exploring.
const JULIA_PRESETS: { label: string; c: [number, number] }[] = [
  { label: "Dendrite", c: [0, 1] },
  { label: "Rabbit", c: [-0.123, 0.745] },
  { label: "Spiral", c: [-0.8, 0.156] },
  { label: "San Marco", c: [-0.75, 0] },
  { label: "Galaxies", c: [-0.391, -0.587] },
  { label: "Lightning", c: [0.285, 0.01] },
  { label: "Nebula", c: [-0.4, 0.6] },
  { label: "Feather", c: [-0.7269, 0.1889] },
];

// Famous Mandelbrot landmarks: { center, vertical scale }.
const MANDEL_PRESETS: {
  label: string;
  centerX: number;
  centerY: number;
  scale: number;
}[] = [
  { label: "Home", centerX: -0.5, centerY: 0, scale: 2.6 },
  { label: "Seahorse", centerX: -0.743644, centerY: 0.131826, scale: 0.012 },
  { label: "Elephant", centerX: 0.275, centerY: 0.007, scale: 0.06 },
  { label: "Triple Spiral", centerX: -0.088, centerY: 0.654, scale: 0.05 },
  { label: "Mini-brot", centerX: -1.749, centerY: 0, scale: 0.02 },
  { label: "Scepter", centerX: -1.36, centerY: 0.005, scale: 0.04 },
  { label: "Tendrils", centerX: -0.235125, centerY: 0.827215, scale: 0.004 },
];

function formatZoom(scale: number): string {
  const z = 2.6 / scale; // relative to the default view extent
  if (z < 1000) return z.toFixed(z < 10 ? 2 : 0) + "×";
  return z.toExponential(1).replace("e+", "e") + "×";
}

export default function Fractal() {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<FractalView | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [julia, setJulia] = useState(false);
  const [maxIter, setMaxIter] = useState(300);
  const [palette, setPalette] = useState(0);
  const [colorScale, setColorScale] = useState(1);
  const [colorShift, setColorShift] = useState(0);
  const [juliaIdx, setJuliaIdx] = useState(2);
  const [deep, setDeep] = useState(false);
  const [view, setView] = useState<FractalState>({
    centerX: -0.5,
    centerY: 0,
    scale: 2.6,
  });

  useEffect(() => {
    if (!mountRef.current) return;
    try {
      const v = new FractalView(mountRef.current, {
        onChange: s => setView(s),
      });
      viewRef.current = v;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    return () => {
      viewRef.current?.dispose();
      viewRef.current = null;
    };
  }, []);

  // Push parameter changes into the renderer.
  useEffect(() => {
    viewRef.current?.setParams({
      maxIter,
      palette,
      colorScale,
      colorShift,
      julia,
      juliaC: JULIA_PRESETS[juliaIdx].c,
      deep,
    });
  }, [maxIter, palette, colorScale, colorShift, julia, juliaIdx, deep]);

  const setMode = useCallback((toJulia: boolean) => {
    setJulia(toJulia);
    // Reframe so the set is on-screen: Julia is centred on the origin,
    // the Mandelbrot on its usual seat at (-0.5, 0).
    viewRef.current?.setState({
      centerX: toJulia ? 0 : -0.5,
      centerY: 0,
      scale: 2.6,
    });
  }, []);

  const reset = useCallback(
    () =>
      viewRef.current?.setState({
        centerX: julia ? 0 : -0.5,
        centerY: 0,
        scale: 2.6,
      }),
    [julia]
  );
  const zoomIn = useCallback(() => viewRef.current?.zoomBy(0.5), []);
  const zoomOut = useCallback(() => viewRef.current?.zoomBy(2), []);

  const saveImage = useCallback(() => {
    const v = viewRef.current;
    if (!v) return;
    const url = v.screenshot();
    const a = document.createElement("a");
    a.href = url;
    a.download = `fractal-${Date.now()}.png`;
    a.click();
  }, []);

  const label = "font-mono text-[10px] uppercase tracking-wider text-zinc-400";
  const pill =
    "rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 font-mono text-xs text-zinc-100 backdrop-blur transition hover:bg-white/15 disabled:opacity-40";

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#05060a] text-zinc-100">
      {/* Fractal canvas */}
      <div ref={mountRef} className="absolute inset-0" />

      {error && (
        <div className="absolute inset-0 z-20 flex items-center justify-center px-6 text-center">
          <div className="max-w-md rounded-xl border border-white/10 bg-black/60 p-6 backdrop-blur">
            <p className="font-mono text-sm text-rose-300">
              Couldn’t start WebGL
            </p>
            <p className="mt-2 text-xs text-zinc-400">{error}</p>
          </div>
        </div>
      )}

      {/* Top bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="pointer-events-auto flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-zinc-300 backdrop-blur transition hover:bg-white/10"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Home
          </Link>
          <div>
            <h1 className="font-mono text-sm font-semibold tracking-tight text-zinc-100 sm:text-base">
              Fractal Lab
            </h1>
            <p className="hidden text-[11px] text-zinc-400 sm:block">
              {julia ? "Julia set" : "Mandelbrot set"} · GPU explorer
            </p>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 p-1 backdrop-blur">
          <button
            onClick={() => setMode(false)}
            className={`h-7 rounded-md px-2.5 font-mono text-xs transition ${
              !julia
                ? "bg-[#C9A84C] text-[#1a1a2e]"
                : "text-zinc-300 hover:bg-white/10"
            }`}
          >
            Mandelbrot
          </button>
          <button
            onClick={() => setMode(true)}
            className={`h-7 rounded-md px-2.5 font-mono text-xs transition ${
              julia
                ? "bg-[#C9A84C] text-[#1a1a2e]"
                : "text-zinc-300 hover:bg-white/10"
            }`}
          >
            Julia
          </button>
        </div>
      </header>

      {/* Zoom / coordinate readout */}
      <div className="pointer-events-none absolute left-1/2 top-16 z-10 -translate-x-1/2">
        <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 font-mono text-[11px] text-zinc-300 backdrop-blur">
          {formatZoom(view.scale)} · re {view.centerX.toFixed(6)} · im{" "}
          {view.centerY.toFixed(6)}
        </span>
      </div>

      {/* Bottom controls */}
      <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-xl border border-white/10 bg-black/40 p-3 backdrop-blur">
          {/* Presets */}
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <span className={label}>{julia ? "Constant" : "Landmark"}</span>
            {julia
              ? JULIA_PRESETS.map((p, i) => (
                  <button
                    key={p.label}
                    onClick={() => setJuliaIdx(i)}
                    className={`rounded-md px-2.5 py-1.5 font-mono text-xs transition ${
                      i === juliaIdx
                        ? "bg-[#C9A84C] text-[#1a1a2e]"
                        : "border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/15"
                    }`}
                  >
                    {p.label}
                  </button>
                ))
              : MANDEL_PRESETS.map(p => (
                  <button
                    key={p.label}
                    onClick={() =>
                      viewRef.current?.setState({
                        centerX: p.centerX,
                        centerY: p.centerY,
                        scale: p.scale,
                      })
                    }
                    className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 font-mono text-xs text-zinc-200 transition hover:bg-white/15"
                  >
                    {p.label}
                  </button>
                ))}
          </div>

          {/* Sliders */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className={label}>Iterations · {maxIter}</span>
              <input
                type="range"
                min={50}
                max={1500}
                step={10}
                value={maxIter}
                onChange={e => setMaxIter(Number(e.target.value))}
                className="accent-[#C9A84C]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={label}>Colour density</span>
              <input
                type="range"
                min={0.2}
                max={4}
                step={0.05}
                value={colorScale}
                onChange={e => setColorScale(Number(e.target.value))}
                className="accent-[#C9A84C]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={label}>Colour shift</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={colorShift}
                onChange={e => setColorShift(Number(e.target.value))}
                className="accent-[#C9A84C]"
              />
            </label>
          </div>

          {/* Palette + actions */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className={label}>Palette</span>
              {PALETTES.map((p, i) => (
                <button
                  key={p}
                  onClick={() => setPalette(i)}
                  className={`rounded-md px-2 py-1 font-mono text-[11px] transition ${
                    i === palette
                      ? "bg-[#C9A84C] text-[#1a1a2e]"
                      : "border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/15"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setDeep(d => !d)}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 font-mono text-[11px] transition ${
                  deep
                    ? "bg-[#C9A84C] text-[#1a1a2e]"
                    : "border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/15"
                }`}
                title="Emulated double precision for extra-deep zooms (slower)"
              >
                <Microscope className="h-3.5 w-3.5" /> Deep
                {deep ? " on" : ""}
              </button>
              <button onClick={zoomOut} className={pill} title="Zoom out">
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button onClick={zoomIn} className={pill} title="Zoom in">
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={reset}
                className={pill}
                title="Reset view"
              >
                <RotateCcw className="mr-1 inline h-3.5 w-3.5" />
                Reset
              </button>
              <button
                onClick={saveImage}
                className="inline-flex items-center gap-1 rounded-md bg-[#C9A84C] px-2.5 py-1.5 font-mono text-xs font-medium text-[#1a1a2e] transition hover:brightness-110"
                title="Save PNG"
              >
                <Download className="h-3.5 w-3.5" /> Save
              </button>
            </div>
          </div>

          <p className="text-center font-mono text-[10px] text-zinc-500">
            <Sparkles className="mr-1 inline h-3 w-3 text-[#C9A84C]" />
            Drag to pan · scroll or pinch to zoom toward the cursor ·{" "}
            {deep ? "deep precision on (~1e-13)" : "toggle Deep for extra-deep zooms"}
          </p>

          <p className="text-center font-mono text-[10px] text-zinc-600">
            Made by Tim, for Tim ·{" "}
            <a
              href="https://github.com/TimGivney/TimGivney.github.io"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-zinc-400 underline-offset-2 transition hover:text-[#C9A84C] hover:underline"
            >
              <Github className="h-3 w-3" /> Open source on GitHub
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
