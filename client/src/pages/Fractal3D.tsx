import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Boxes,
  Download,
  Eye,
  EyeOff,
  Github,
  Maximize,
  Minimize,
  Orbit,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Square,
} from "lucide-react";
import {
  Fractal3DView,
  defaultDistanceFor,
  type Fractal3DCamera,
  type Fractal3DType,
} from "@/lib/fractal/Fractal3DView";
import type { MeshRequest, MeshResponse } from "@/lib/fractal/meshWorker";

const PALETTES = ["Ember", "Ice", "Spectrum", "Gold", "Azure"] as const;

const TYPES: { id: Fractal3DType; label: string }[] = [
  { id: "mandelbulb", label: "Mandelbulb" },
  { id: "mandelbox", label: "Mandelbox" },
  { id: "julia", label: "Quaternion Julia" },
];

const TYPE_BLURB: Record<Fractal3DType, string> = {
  mandelbulb: "The iconic 3D Mandelbrot",
  mandelbox: "Box + sphere folding",
  julia: "4D Julia cross-section",
};

// Per-fractal presets that set the defining parameter(s).
const BULB_PRESETS: { label: string; power: number }[] = [
  { label: "Classic", power: 8 },
  { label: "Power 2", power: 2 },
  { label: "Power 4", power: 4 },
  { label: "Power 6", power: 6 },
  { label: "Power 12", power: 12 },
];

const BOX_PRESETS: { label: string; boxScale: number }[] = [
  { label: "Scaffold", boxScale: -1.8 },
  { label: "Soft", boxScale: -1.5 },
  { label: "Sharp", boxScale: -2.2 },
  { label: "Positive", boxScale: 2.0 },
];

const JULIA_PRESETS: { label: string; c: [number, number, number, number] }[] =
  [
    { label: "Nebula", c: [-0.45, 0.6, 0.2, 0.0] },
    { label: "Bulbs", c: [-0.2, 0.4, -0.4, -0.4] },
    { label: "Tendrils", c: [-0.59, 0.2, 0.2, 0.1] },
    { label: "Quartz", c: [-0.125, -0.256, 0.847, 0.0895] },
    { label: "Bloom", c: [0.18, 0.88, 0.0, 0.0] },
  ];

const RES_OPTIONS: { label: string; longEdge: number }[] = [
  { label: "Screen", longEdge: 0 },
  { label: "4K", longEdge: 3840 },
  { label: "8K", longEdge: 7680 },
];

// Voxel grid resolution for the 3D-printable mesh export. Higher grids resolve
// finer surface detail; the mesher also lifts its iteration count and refines
// each vertex onto the true surface, so every tier is noticeably sharper.
const MESH_RES: { label: string; res: number }[] = [
  { label: "Draft", res: 96 },
  { label: "Standard", res: 160 },
  { label: "High", res: 256 },
  { label: "Ultra", res: 320 },
];

export default function Fractal3D() {
  const rootRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<Fractal3DView | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [uiHidden, setUiHidden] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const [type, setType] = useState<Fractal3DType>("mandelbulb");
  const [power, setPower] = useState(8);
  const [boxScale, setBoxScale] = useState(-1.8);
  const [juliaC, setJuliaC] = useState<[number, number, number, number]>([
    -0.45, 0.6, 0.2, 0.0,
  ]);
  const [iterations, setIterations] = useState(8);
  const [palette, setPalette] = useState(0);
  const [colorShift, setColorShift] = useState(0);
  const [glow, setGlow] = useState(0.6);
  const [quality, setQuality] = useState(0.6);

  const [autoRotate, setAutoRotate] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [colorCycle, setColorCycle] = useState(false);
  const [resIdx, setResIdx] = useState(1);
  const [saving, setSaving] = useState(false);
  const [meshFormat, setMeshFormat] = useState<"stl" | "obj">("stl");
  const [meshResIdx, setMeshResIdx] = useState(1);
  const [meshBusy, setMeshBusy] = useState(false);
  const [meshProgress, setMeshProgress] = useState(0);
  const [meshNote, setMeshNote] = useState<string | null>(null);
  const meshWorkerRef = useRef<Worker | null>(null);
  const [, setCam] = useState<Fractal3DCamera>({
    yaw: 0.7,
    pitch: -0.35,
    dist: 2.8,
  });

  useEffect(() => {
    if (!mountRef.current) return;
    try {
      const v = new Fractal3DView(mountRef.current, {
        onChange: c => setCam(c),
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

  useEffect(() => {
    viewRef.current?.setParams({
      type,
      power,
      boxScale,
      juliaC,
      iterations,
      palette,
      colorShift,
      glow,
      quality,
    });
  }, [
    type,
    power,
    boxScale,
    juliaC,
    iterations,
    palette,
    colorShift,
    glow,
    quality,
  ]);

  // Frame each fractal from a sensible distance (the Mandelbox is much bigger).
  useEffect(() => {
    viewRef.current?.setCamera({ dist: defaultDistanceFor(type) });
  }, [type]);

  useEffect(() => {
    viewRef.current?.setAutoRotate(autoRotate);
  }, [autoRotate]);

  useEffect(() => {
    viewRef.current?.setAnimate(animate);
  }, [animate]);

  // Slowly drift the palette while exploring (off by default).
  useEffect(() => {
    viewRef.current?.setColorCycle(colorCycle);
  }, [colorCycle]);

  // Extract a watertight triangle mesh of the current fractal in a Web Worker,
  // then download it as STL (best for slicers) or OBJ.
  const exportMesh = useCallback(() => {
    if (meshBusy) return;
    setMeshNote(null);
    setMeshBusy(true);
    setMeshProgress(0);
    const worker = new Worker(
      new URL("../lib/fractal/meshWorker.ts", import.meta.url),
      { type: "module" }
    );
    meshWorkerRef.current = worker;
    const finish = () => {
      setMeshBusy(false);
      setMeshProgress(0);
      worker.terminate();
      meshWorkerRef.current = null;
    };
    worker.onmessage = (e: MessageEvent<MeshResponse>) => {
      const msg = e.data;
      if (msg.kind === "progress") {
        setMeshProgress(msg.frac);
      } else if (msg.kind === "done") {
        let blob: Blob | null = null;
        if (msg.format === "stl" && msg.stl) {
          blob = new Blob([msg.stl], { type: "model/stl" });
        } else if (msg.format === "obj" && msg.obj !== undefined) {
          blob = new Blob([msg.obj], { type: "text/plain" });
        }
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `fractal3d-${type}-${Date.now()}.${msg.format}`;
          a.click();
          URL.revokeObjectURL(url);
          setMeshNote(`${msg.triangles.toLocaleString()} triangles`);
        }
        finish();
      } else {
        setMeshNote(msg.message);
        finish();
      }
    };
    worker.onerror = e => {
      setMeshNote(e.message || "Mesh export failed");
      finish();
    };
    const req: MeshRequest = {
      params: {
        type,
        power,
        boxScale,
        juliaC,
        iterations,
        resolution: MESH_RES[meshResIdx].res,
      },
      format: meshFormat,
    };
    worker.postMessage(req);
  }, [
    meshBusy,
    type,
    power,
    boxScale,
    juliaC,
    iterations,
    meshResIdx,
    meshFormat,
  ]);

  useEffect(
    () => () => {
      meshWorkerRef.current?.terminate();
      meshWorkerRef.current = null;
    },
    []
  );

  const reset = useCallback(() => viewRef.current?.resetCamera(), []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else rootRef.current?.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

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
    setTimeout(() => {
      try {
        const url = opt.longEdge
          ? v.exportPNG(opt.longEdge).url
          : v.screenshot();
        const a = document.createElement("a");
        a.href = url;
        a.download = `fractal3d-${type}-${opt.label.toLowerCase()}-${Date.now()}.png`;
        a.click();
      } finally {
        setSaving(false);
      }
    }, 60);
  }, [resIdx, saving, type]);

  const label = "font-mono text-[10px] uppercase tracking-wider text-zinc-400";
  const pill =
    "rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 font-mono text-xs text-zinc-100 backdrop-blur transition hover:bg-white/15 disabled:opacity-40";

  return (
    <div
      ref={rootRef}
      className="relative h-[100dvh] w-full overflow-hidden bg-[#05060a] text-zinc-100"
    >
      <div ref={mountRef} className="absolute inset-0" />

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
                Fractal Lab 3D
              </h1>
              <p className="hidden text-[11px] text-zinc-400 sm:block">
                {TYPE_BLURB[type]} · ray-marched
              </p>
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            <button
              onClick={() => setAutoRotate(v => !v)}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 backdrop-blur transition ${
                autoRotate
                  ? "bg-[#C9A84C] text-[#1a1a2e]"
                  : "bg-white/5 text-zinc-300 hover:bg-white/10"
              }`}
              title="Auto-rotate"
            >
              <Orbit className="h-4 w-4" />
            </button>
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

      {/* Fractal type selector (top centre) */}
      {!uiHidden && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-10 -translate-x-1/2">
          <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-white/10 bg-black/40 p-1 backdrop-blur">
            {TYPES.map(t => (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                className={`h-7 rounded-md px-2.5 font-mono text-[11px] transition ${
                  type === t.id
                    ? "bg-[#C9A84C] text-[#1a1a2e]"
                    : "text-zinc-300 hover:bg-white/10"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom controls */}
      {!uiHidden && (
        <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-4 sm:px-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-xl border border-white/10 bg-black/40 p-3 backdrop-blur">
            {/* Presets */}
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <span className={label}>Preset</span>
              {type === "mandelbulb" &&
                BULB_PRESETS.map(p => (
                  <button
                    key={p.label}
                    onClick={() => setPower(p.power)}
                    className={`rounded-md px-2.5 py-1.5 font-mono text-xs transition ${
                      power === p.power
                        ? "bg-[#C9A84C] text-[#1a1a2e]"
                        : "border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/15"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              {type === "mandelbox" &&
                BOX_PRESETS.map(p => (
                  <button
                    key={p.label}
                    onClick={() => setBoxScale(p.boxScale)}
                    className={`rounded-md px-2.5 py-1.5 font-mono text-xs transition ${
                      boxScale === p.boxScale
                        ? "bg-[#C9A84C] text-[#1a1a2e]"
                        : "border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/15"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              {type === "julia" &&
                JULIA_PRESETS.map(p => (
                  <button
                    key={p.label}
                    onClick={() => setJuliaC(p.c)}
                    className={`rounded-md px-2.5 py-1.5 font-mono text-xs transition ${
                      juliaC.join() === p.c.join()
                        ? "bg-[#C9A84C] text-[#1a1a2e]"
                        : "border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/15"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
            </div>

            {/* Sliders */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {type === "mandelbulb" && (
                <label className="flex flex-col gap-1">
                  <span className={label}>Power · {power.toFixed(1)}</span>
                  <input
                    type="range"
                    min={2}
                    max={12}
                    step={0.1}
                    value={power}
                    onChange={e => setPower(Number(e.target.value))}
                    className="accent-[#C9A84C]"
                  />
                </label>
              )}
              {type === "mandelbox" && (
                <label className="flex flex-col gap-1">
                  <span className={label}>Scale · {boxScale.toFixed(2)}</span>
                  <input
                    type="range"
                    min={-2.5}
                    max={2.5}
                    step={0.05}
                    value={boxScale}
                    onChange={e => setBoxScale(Number(e.target.value))}
                    className="accent-[#C9A84C]"
                  />
                </label>
              )}
              {type === "julia" && (
                <label className="flex flex-col gap-1">
                  <span className={label}>
                    Constant w · {juliaC[3].toFixed(2)}
                  </span>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.01}
                    value={juliaC[3]}
                    onChange={e =>
                      setJuliaC([
                        juliaC[0],
                        juliaC[1],
                        juliaC[2],
                        Number(e.target.value),
                      ])
                    }
                    className="accent-[#C9A84C]"
                  />
                </label>
              )}
              <label className="flex flex-col gap-1">
                <span className={label}>Iterations · {iterations}</span>
                <input
                  type="range"
                  min={4}
                  max={16}
                  step={1}
                  value={iterations}
                  onChange={e => setIterations(Number(e.target.value))}
                  className="accent-[#C9A84C]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={label}>
                  Quality · {Math.round(quality * 100)}%
                </span>
                <input
                  type="range"
                  min={0.2}
                  max={1}
                  step={0.05}
                  value={quality}
                  onChange={e => setQuality(Number(e.target.value))}
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
                  onClick={() => setColorShift(s => (s + 0.15) % 1)}
                  className={pill}
                  title="Shift colours"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setAnimate(v => !v)}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 font-mono text-[11px] transition ${
                    animate
                      ? "bg-[#C9A84C] text-[#1a1a2e]"
                      : "border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/15"
                  }`}
                  title="Animate the fractal parameter"
                >
                  {animate ? (
                    <Square className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  Animate
                </button>
                <button
                  onClick={() => setColorCycle(v => !v)}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 font-mono text-[11px] transition ${
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
                <button onClick={reset} className={pill} title="Reset view">
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
                  <Download className="h-3.5 w-3.5" />{" "}
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>

            {/* 3D-printable mesh export */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={label}>3D print</span>
                <div className="flex items-center gap-0.5 rounded-md border border-white/10 bg-white/5 p-0.5">
                  {(["stl", "obj"] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setMeshFormat(f)}
                      className={`rounded px-1.5 py-1 font-mono text-[10px] uppercase transition ${
                        meshFormat === f
                          ? "bg-[#C9A84C] text-[#1a1a2e]"
                          : "text-zinc-300 hover:bg-white/10"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-0.5 rounded-md border border-white/10 bg-white/5 p-0.5">
                  {MESH_RES.map((opt, i) => (
                    <button
                      key={opt.label}
                      onClick={() => setMeshResIdx(i)}
                      className={`rounded px-1.5 py-1 font-mono text-[10px] transition ${
                        i === meshResIdx
                          ? "bg-[#C9A84C] text-[#1a1a2e]"
                          : "text-zinc-300 hover:bg-white/10"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {meshNote && (
                  <span className="font-mono text-[10px] text-zinc-400">
                    {meshNote}
                  </span>
                )}
                <button
                  onClick={exportMesh}
                  disabled={meshBusy}
                  className="inline-flex items-center gap-1 rounded-md border border-[#C9A84C]/60 bg-[#C9A84C]/15 px-2.5 py-1.5 font-mono text-xs font-medium text-[#C9A84C] transition hover:bg-[#C9A84C]/25 disabled:opacity-60"
                  title="Export a 3D-printable mesh of the current fractal"
                >
                  <Boxes className="h-3.5 w-3.5" />{" "}
                  {meshBusy
                    ? `Meshing ${Math.round(meshProgress * 100)}%`
                    : "Export model"}
                </button>
              </div>
            </div>

            <p className="text-center font-mono text-[10px] text-zinc-500">
              <Sparkles className="mr-1 inline h-3 w-3 text-[#C9A84C]" />
              Drag to orbit · scroll or pinch to zoom · F fullscreen · H hide UI
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
