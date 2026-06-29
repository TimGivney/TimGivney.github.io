import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Download,
  Eye,
  EyeOff,
  Github,
  Maximize,
  Microscope,
  Minimize,
  Minus,
  Pause,
  Play,
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

// Export resolutions for the Save button. longEdge is the target length of the
// image's longer side in pixels; 0 = grab the current screen size as-is.
const RES_OPTIONS: { label: string; longEdge: number }[] = [
  { label: "Screen", longEdge: 0 },
  { label: "4K", longEdge: 3840 },
  { label: "8K", longEdge: 7680 },
];

function formatZoom(scale: number): string {
  const z = 2.6 / scale; // relative to the default view extent
  if (z < 1000) return z.toFixed(z < 10 ? 2 : 0) + "×";
  return z.toExponential(1).replace("e+", "e") + "×";
}

export default function Fractal() {
  const rootRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<FractalView | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [uiHidden, setUiHidden] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [julia, setJulia] = useState(false);
  const [maxIter, setMaxIter] = useState(300);
  const [palette, setPalette] = useState(0);
  const [colorScale, setColorScale] = useState(1);
  const [colorShift, setColorShift] = useState(0);
  const [juliaIdx, setJuliaIdx] = useState(2);
  const [deep, setDeep] = useState(false);
  const [resIdx, setResIdx] = useState(1);
  const [colorCycle, setColorCycle] = useState(false);
  const [saving, setSaving] = useState(false);
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

  // Slowly drift the palette while exploring (off by default).
  useEffect(() => {
    viewRef.current?.setColorCycle(colorCycle);
  }, [colorCycle]);

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

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      rootRef.current?.requestFullscreen?.();
    }
  }, []);

  // Keep state in sync with the actual fullscreen status (Esc, F11, etc.).
  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Keyboard shortcuts: F = fullscreen, H = hide/show the UI.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === "h" || e.key === "H") {
        e.preventDefault();
        setUiHidden(v => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleFullscreen]);

  const saveImage = useCallback(() => {
    const v = viewRef.current;
    if (!v || saving) return;
    const opt = RES_OPTIONS[resIdx];
    setSaving(true);
    // Let the "Saving…" state paint before the (synchronous, possibly heavy)
    // hi-res render blocks the main thread.
    setTimeout(() => {
      try {
        const url = opt.longEdge
          ? v.exportPNG(opt.longEdge).url
          : v.screenshot();
        const a = document.createElement("a");
        a.href = url;
        a.download = `fractal-${opt.label.toLowerCase()}-${Date.now()}.png`;
        a.click();
      } finally {
        setSaving(false);
      }
    }, 60);
  }, [resIdx, saving]);

  const label = "font-mono text-[10px] uppercase tracking-wider text-zinc-400";
  const pill =
    "rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 font-mono text-xs text-zinc-100 backdrop-blur transition hover:bg-white/15 disabled:opacity-40";

  return (
    <div
      ref={rootRef}
      className="relative h-[100dvh] w-full overflow-hidden bg-[#05060a] text-zinc-100"
    >
      {/* Fractal canvas */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* When the UI is hidden, a single discreet button brings it back. */}
      {uiHidden && !error && (
        <button
          onClick={() => setUiHidden(false)}
          className="pointer-events-auto absolute right-4 top-3 z-10 inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 font-mono text-[11px] text-zinc-300 backdrop-blur transition hover:bg-white/10 sm:right-6"
          title="Show controls (H)"
        >
          <Eye className="h-3.5 w-3.5" /> Show UI
        </button>
      )}

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
      {!uiHidden && (
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

        <div className="pointer-events-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 p-1 backdrop-blur">
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
          <button
            onClick={() => setUiHidden(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/5 text-zinc-300 backdrop-blur transition hover:bg-white/10"
            title="Hide controls (H)"
          >
            <EyeOff className="h-4 w-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/5 text-zinc-300 backdrop-blur transition hover:bg-white/10"
            title={fullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
          >
            {fullscreen ? (
              <Minimize className="h-4 w-4" />
            ) : (
              <Maximize className="h-4 w-4" />
            )}
          </button>
        </div>
      </header>
      )}

      {/* Zoom / coordinate readout */}
      {!uiHidden && (
      <div className="pointer-events-none absolute left-1/2 top-16 z-10 -translate-x-1/2">
        <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 font-mono text-[11px] text-zinc-300 backdrop-blur">
          {formatZoom(view.scale)} · re {view.centerX.toFixed(6)} · im{" "}
          {view.centerY.toFixed(6)}
        </span>
      </div>
      )}

      {/* Bottom controls */}
      {!uiHidden && (
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
              <button
                onClick={() => setColorCycle(c => !c)}
                className={`ml-1 inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 font-mono text-[11px] transition ${
                  colorCycle
                    ? "bg-[#C9A84C] text-[#1a1a2e]"
                    : "border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/15"
                }`}
                title="Slowly drift the colours as you explore"
              >
                {colorCycle ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                Drift
              </button>
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
              <div
                className="flex items-center gap-0.5 rounded-md border border-white/10 bg-white/5 p-0.5"
                title="Export resolution"
              >
                {RES_OPTIONS.map((opt, i) => (
                  <button
                    key={opt.label}
                    onClick={() => setResIdx(i)}
                    className={`rounded px-1.5 py-1 font-mono text-[10px] transition ${
                      i === resIdx
                        ? "bg-[#C9A84C] text-[#1a1a2e]"
                        : "text-zinc-300 hover:bg-white/10"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button
                onClick={saveImage}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-md bg-[#C9A84C] px-2.5 py-1.5 font-mono text-xs font-medium text-[#1a1a2e] transition hover:brightness-110 disabled:opacity-60"
                title={`Save ${RES_OPTIONS[resIdx].label} PNG`}
              >
                <Download className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          <p className="text-center font-mono text-[10px] text-zinc-500">
            <Sparkles className="mr-1 inline h-3 w-3 text-[#C9A84C]" />
            Drag to pan · scroll, pinch or double-click to zoom toward the cursor ·{" "}
            F fullscreen · H hide UI
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
      )}
    </div>
  );
}
