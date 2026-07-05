import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  RotateCcw,
} from "lucide-react";
import { ToxicView } from "@/lib/toxic/ToxicView";
import { PetriView } from "@/lib/toxic/PetriView";
import { ScaleView } from "@/lib/toxic/ScaleView";
import {
  KIND_LABEL,
  SPECIMENS,
  specimenById,
  type SpecimenKind,
} from "@/lib/toxic/specimens";

type ViewMode = "model" | "micro" | "scale";

const VIEW_TABS: { id: ViewMode; label: string }[] = [
  { id: "model", label: "3D model" },
  { id: "micro", label: "Microscope" },
  { id: "scale", label: "Scale" },
];

// Group specimens for the selector.
const GROUP_ORDER: SpecimenKind[] = [
  "bacterium",
  "virus",
  "prion",
  "fungus",
  "pollen",
  "human",
];

export default function Toxic() {
  const rootRef = useRef<HTMLDivElement>(null);
  const modelMount = useRef<HTMLDivElement>(null);
  const microMount = useRef<HTMLDivElement>(null);
  const scaleMount = useRef<HTMLDivElement>(null);
  const modelRef = useRef<ToxicView | null>(null);
  const microRef = useRef<PetriView | null>(null);
  const scaleRef = useRef<ScaleView | null>(null);

  const [id, setId] = useState("meningococcus");
  const [view, setView] = useState<ViewMode>("model");
  const [autoRotate, setAutoRotate] = useState(true);
  const [colorDrift, setColorDrift] = useState(false);
  const [uiHidden, setUiHidden] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spec = useMemo(() => specimenById(id), [id]);

  const grouped = useMemo(() => {
    return GROUP_ORDER.map(k => ({
      kind: k,
      label: KIND_LABEL[k],
      items: SPECIMENS.filter(s => s.kind === k),
    })).filter(g => g.items.length > 0);
  }, []);

  // Lazily create each view only when first shown (keeps it light).
  useEffect(() => {
    if (view === "model" && modelMount.current && !modelRef.current) {
      try {
        const v = new ToxicView(modelMount.current, { autoRotate });
        v.setSpecimen(id);
        v.setColorDrift(colorDrift);
        modelRef.current = v;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
    if (view === "micro" && microMount.current && !microRef.current) {
      microRef.current = new PetriView(microMount.current, id);
    }
    if (view === "scale" && scaleMount.current && !scaleRef.current) {
      scaleRef.current = new ScaleView(scaleMount.current, id);
    }
  }, [view, id, autoRotate, colorDrift]);

  useEffect(() => {
    return () => {
      modelRef.current?.dispose();
      microRef.current?.dispose();
      scaleRef.current?.dispose();
    };
  }, []);

  // Push specimen changes to whichever views exist.
  useEffect(() => {
    modelRef.current?.setSpecimen(id);
    microRef.current?.setSpecimen(id);
    scaleRef.current?.setSpecimen(id);
  }, [id]);

  useEffect(() => {
    modelRef.current?.setAutoRotate(autoRotate);
  }, [autoRotate]);

  useEffect(() => {
    modelRef.current?.setColorDrift(colorDrift);
  }, [colorDrift]);

  const reset = useCallback(() => modelRef.current?.resetView(), []);

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
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
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

  const savePNG = useCallback(() => {
    let url: string | undefined;
    if (view === "model") url = modelRef.current?.exportPNG(2560);
    else if (view === "micro") url = microRef.current?.snapshot();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `toxic-${id}-${view}-${Date.now()}.png`;
    a.click();
  }, [view, id]);

  const exportSTL = useCallback(() => {
    const buf = modelRef.current?.exportSTL();
    if (!buf) return;
    const blob = new Blob([buf], { type: "model/stl" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `toxic-${id}-${Date.now()}.stl`;
    a.click();
    URL.revokeObjectURL(url);
  }, [id]);

  const label = "font-mono text-[10px] uppercase tracking-wider text-zinc-400";

  return (
    <div
      ref={rootRef}
      className="relative h-[100dvh] w-full overflow-hidden bg-[#05060a] text-zinc-100"
    >
      {/* view canvases (only the active one is visible) */}
      <div
        ref={modelMount}
        className="absolute inset-0"
        style={{ display: view === "model" ? "block" : "none" }}
      />
      <div
        ref={microMount}
        className="absolute inset-0"
        style={{ display: view === "micro" ? "block" : "none" }}
      />
      <div
        ref={scaleMount}
        className="absolute inset-0"
        style={{ display: view === "scale" ? "block" : "none" }}
      />

      {uiHidden && (
        <button
          onClick={() => setUiHidden(false)}
          className="pointer-events-auto absolute right-4 top-3 z-20 inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 font-mono text-[11px] text-zinc-300 backdrop-blur transition hover:bg-white/10 sm:right-6"
          title="Show controls (H)"
        >
          <Eye className="h-3.5 w-3.5" /> Show UI
        </button>
      )}

      {error && (
        <div className="absolute inset-0 z-30 flex items-center justify-center px-6 text-center">
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
                Toxic
              </h1>
              <p className="hidden text-[11px] text-zinc-400 sm:block">
                Pathogens, pollens & you · in 3D
              </p>
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            {view === "model" && (
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
            )}
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

      {/* View tabs (top centre) */}
      {!uiHidden && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-10 -translate-x-1/2">
          <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-white/10 bg-black/40 p-1 backdrop-blur">
            {VIEW_TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                className={`h-7 rounded-md px-2.5 font-mono text-[11px] transition ${
                  view === t.id
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

      {/* Specimen selector (left) */}
      {!uiHidden && (
        <div className="absolute left-3 top-28 bottom-28 z-10 w-44 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-2 backdrop-blur sm:left-6">
          {grouped.map(group => (
            <div key={group.kind} className="mb-2">
              <p className="px-1 pb-1 font-mono text-[9px] uppercase tracking-wider text-zinc-500">
                {group.label}
              </p>
              {group.items.map(s => (
                <button
                  key={s.id}
                  onClick={() => setId(s.id)}
                  className={`mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition ${
                    id === s.id
                      ? "bg-[#C9A84C]/20 text-[#E7C766]"
                      : "text-zinc-300 hover:bg-white/10"
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="font-mono text-[11px] leading-tight">
                    {s.name}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Info + actions (bottom) */}
      {!uiHidden && (
        <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-4 sm:px-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-2 rounded-xl border border-white/10 bg-black/50 p-3 backdrop-blur">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="font-mono text-sm font-semibold text-zinc-100">
                  {spec.name}{" "}
                  <span className="text-[#C9A84C]">· {spec.sizeLabel}</span>
                </h2>
                {spec.latin && (
                  <p className="font-mono text-[11px] italic text-zinc-400">
                    {spec.latin} · {KIND_LABEL[spec.kind]}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setColorDrift(v => !v)}
                  className={`rounded-md px-2 py-1.5 font-mono text-[11px] transition ${
                    colorDrift
                      ? "bg-[#C9A84C] text-[#1a1a2e]"
                      : "border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/15"
                  }`}
                  title="Slowly drift the colours"
                >
                  Drift
                </button>
                <button
                  onClick={reset}
                  className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 font-mono text-[11px] text-zinc-200 transition hover:bg-white/15"
                  title="Reset view"
                  disabled={view !== "model"}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                {view !== "scale" && (
                  <button
                    onClick={savePNG}
                    className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 font-mono text-[11px] text-zinc-200 transition hover:bg-white/15"
                    title="Save PNG"
                  >
                    <Download className="h-3.5 w-3.5" /> PNG
                  </button>
                )}
                {view === "model" && (
                  <button
                    onClick={exportSTL}
                    className="inline-flex items-center gap-1 rounded-md border border-[#C9A84C]/60 bg-[#C9A84C]/15 px-2.5 py-1.5 font-mono text-[11px] font-medium text-[#C9A84C] transition hover:bg-[#C9A84C]/25"
                    title="Export a 3D-printable STL"
                  >
                    <Boxes className="h-3.5 w-3.5" /> STL
                  </button>
                )}
              </div>
            </div>

            <p className="text-[12px] leading-relaxed text-zinc-300">
              {spec.danger}
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              <p className="text-[11px] leading-relaxed text-zinc-400">
                <span className={label}>Spreads</span>
                <br />
                {spec.spread}
              </p>
              <p className="text-[11px] leading-relaxed text-zinc-400">
                <span className={label}>The trace</span>
                <br />
                {spec.detective}
              </p>
            </div>

            <div className="mt-1 flex items-center justify-between border-t border-white/10 pt-2">
              <p className="font-mono text-[10px] text-zinc-500">
                Made by Tim, for Tim — and for his dad, the disease detective.
              </p>
              <a
                href="https://github.com/TimGivney/TimGivney.github.io"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-[10px] text-zinc-400 transition hover:text-zinc-200"
              >
                <Github className="h-3 w-3" /> Open source on GitHub
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
