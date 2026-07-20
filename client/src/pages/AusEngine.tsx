import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Boxes,
  ChevronDown,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Github,
  Images,
  Maximize,
  Minimize,
  Orbit,
  RotateCcw,
  UserRound,
} from "lucide-react";
import { EngineView } from "@/lib/engine/EngineView";
import { TimelineView } from "@/lib/engine/TimelineView";
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  ENGINES,
  engineById,
  engineMediaById,
  type EngineMediaImage,
  type EnginePerson,
} from "@/lib/engine/engines";

type ViewMode = "model" | "timeline" | "photos";

const VIEW_TABS: { id: ViewMode; label: string }[] = [
  { id: "model", label: "3D model" },
  { id: "timeline", label: "Timeline" },
  { id: "photos", label: "Photos & people" },
];

function MediaImageCard({ image }: { image: EngineMediaImage }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [image.src]);

  return (
    <article className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.035]">
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-black/40">
        <span className="absolute left-2 top-2 z-10 rounded bg-black/70 px-1.5 py-1 font-mono text-[8px] uppercase tracking-wider text-zinc-300 backdrop-blur">
          {image.kind === "archive" ? "Archive" : "Photograph"}
        </span>
        {failed ? (
          <div className="flex flex-col items-center gap-2 px-5 text-center text-zinc-500">
            <Images className="h-7 w-7" />
            <span className="font-mono text-[10px] uppercase tracking-wider">
              Image unavailable
            </span>
          </div>
        ) : (
          <img
            src={image.src}
            alt={image.alt}
            loading="lazy"
            onError={() => setFailed(true)}
            className={`h-full w-full ${
              image.kind === "archive" ? "object-contain p-2" : "object-cover"
            }`}
          />
        )}
      </div>
      <div className="space-y-2 p-3">
        <p className="text-xs leading-relaxed text-zinc-300">{image.caption}</p>
        <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] text-zinc-500">
          <span>
            {image.credit} · {image.license}
          </span>
          <a
            href={image.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[#C9A84C] transition hover:text-[#E7C766]"
          >
            Source <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      </div>
    </article>
  );
}

function PersonCard({ person }: { person: EnginePerson }) {
  return (
    <article className="flex min-h-32 overflow-hidden rounded-xl border border-white/10 bg-white/[0.035]">
      {person.portrait ? (
        <a
          href={person.portrait.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="group relative w-28 shrink-0 overflow-hidden bg-black/30 sm:w-36"
          title="Open portrait source"
        >
          <img
            src={person.portrait.src}
            alt={person.portrait.alt}
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
          <ExternalLink className="absolute bottom-2 right-2 h-3 w-3 text-white drop-shadow" />
        </a>
      ) : (
        <div className="flex w-20 shrink-0 flex-col items-center justify-center gap-2 bg-black/30 px-2 text-center sm:w-24">
          <UserRound className="h-7 w-7 text-zinc-600" />
          <p className="font-mono text-[8px] uppercase tracking-wider text-zinc-500">
            No reusable portrait
          </p>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col justify-center space-y-1 p-3">
        <h3 className="font-mono text-sm font-semibold text-zinc-100">
          {person.name}
        </h3>
        <p className="font-mono text-[10px] uppercase tracking-wider text-[#C9A84C]">
          {person.role}
        </p>
        <p className="pt-1 text-[11px] leading-relaxed text-zinc-400">
          {person.contribution}
        </p>
        {person.portrait && (
          <p className="pt-1 font-mono text-[8px] text-zinc-600">
            {person.portrait.credit} · {person.portrait.license}
          </p>
        )}
      </div>
    </article>
  );
}

export default function AusEngine() {
  const rootRef = useRef<HTMLDivElement>(null);
  const modelMount = useRef<HTMLDivElement>(null);
  const timelineMount = useRef<HTMLDivElement>(null);
  const modelRef = useRef<EngineView | null>(null);
  const timelineRef = useRef<TimelineView | null>(null);

  const [id, setId] = useState("holden-v8");
  const [view, setView] = useState<ViewMode>("model");
  const [autoRotate, setAutoRotate] = useState(true);
  const [colorDrift, setColorDrift] = useState(false);
  const [uiHidden, setUiHidden] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eng = useMemo(() => engineById(id), [id]);
  const media = useMemo(() => engineMediaById(id), [id]);

  useEffect(() => setDetailsOpen(false), [id]);

  const grouped = useMemo(() => {
    return CATEGORY_ORDER.map(c => ({
      category: c,
      label: CATEGORY_LABEL[c],
      items: ENGINES.filter(e => e.category === c),
    })).filter(g => g.items.length > 0);
  }, []);

  // Lazily create each view only when first shown.
  useEffect(() => {
    if (view === "model" && modelMount.current && !modelRef.current) {
      try {
        const v = new EngineView(modelMount.current, { autoRotate });
        v.setEngine(id);
        v.setColorDrift(colorDrift);
        modelRef.current = v;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
    if (view === "timeline" && timelineMount.current && !timelineRef.current) {
      const v = new TimelineView(timelineMount.current, id);
      v.setInsetLeft(uiHidden ? 16 : 208);
      v.setSelectHandler(next => setId(next));
      timelineRef.current = v;
    }
  }, [view, id, autoRotate, colorDrift, uiHidden]);

  useEffect(() => {
    timelineRef.current?.setInsetLeft(uiHidden ? 16 : 208);
  }, [uiHidden]);

  useEffect(() => {
    return () => {
      modelRef.current?.dispose();
      timelineRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    modelRef.current?.setEngine(id);
    timelineRef.current?.setEngine(id);
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
    const url = modelRef.current?.exportPNG(2560);
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `ausengine-${id}-${Date.now()}.png`;
    a.click();
  }, [id]);

  const exportSTL = useCallback(() => {
    const buf = modelRef.current?.exportSTL();
    if (!buf) return;
    const blob = new Blob([buf], { type: "model/stl" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ausengine-${id}-${Date.now()}.stl`;
    a.click();
    URL.revokeObjectURL(url);
  }, [id]);

  const label = "font-mono text-[10px] uppercase tracking-wider text-zinc-400";
  const chip =
    "rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-zinc-300";

  return (
    <div
      ref={rootRef}
      className="relative h-[100dvh] w-full overflow-hidden bg-[#05060a] text-zinc-100"
    >
      <div
        ref={modelMount}
        className="absolute inset-0"
        style={{ display: view === "model" ? "block" : "none" }}
      />
      <div
        ref={timelineMount}
        className="absolute inset-0"
        style={{ display: view === "timeline" ? "block" : "none" }}
      />

      {view === "photos" && (
        <div
          className={`absolute inset-0 overflow-y-auto bg-[radial-gradient(circle_at_65%_15%,rgba(201,168,76,0.10),transparent_38%)] ${
            uiHidden
              ? "px-4 pb-8 pt-16 sm:px-8"
              : "pb-8 pl-[10rem] pr-3 pt-28 sm:pl-[13.5rem] sm:pr-6"
          }`}
        >
          <div className="mx-auto max-w-5xl">
            <div className="mb-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#C9A84C]">
                Real machines · real people
              </p>
              <h2 className="mt-1 font-mono text-xl font-semibold text-zinc-100">
                {eng.name}
              </h2>
              <p className="mt-2 max-w-2xl text-xs leading-relaxed text-zinc-400">
                Original photographs and archival material with creator, licence
                and source preserved. Where no reusable image could be verified,
                the gap is shown rather than filled with a substitute.
              </p>
            </div>

            <section>
              <div className="mb-2 flex items-center gap-2">
                <Images className="h-4 w-4 text-[#C9A84C]" />
                <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-200">
                  Engine photographs &amp; archive
                </h3>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {media.images.length > 0 ? (
                  media.images.map(image => (
                    <MediaImageCard key={image.src} image={image} />
                  ))
                ) : (
                  <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/10 bg-black/20 px-5 text-center">
                    <Images className="h-8 w-8 text-zinc-600" />
                    <div>
                      <p className="font-mono text-[11px] text-zinc-300">
                        No verified reusable photograph yet
                      </p>
                      <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
                        The 3D model remains available; this space is reserved
                        for a rights-cleared image of the real engine.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="mt-7">
              <div className="mb-2 flex items-center gap-2">
                <UserRound className="h-4 w-4 text-[#C9A84C]" />
                <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-200">
                  Designers &amp; makers
                </h3>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {media.people.map(person => (
                  <PersonCard key={person.name} person={person} />
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

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
                Aus Engines
              </h1>
              <p className="hidden text-[11px] text-zinc-400 sm:block">
                Engines designed &amp; built in Australia · in 3D
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

      {/* View tabs */}
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

      {/* Engine selector (left) */}
      {!uiHidden && (
        <div
          className={`absolute left-3 top-28 z-10 w-36 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-2 backdrop-blur sm:left-6 sm:w-44 ${
            view === "photos" ? "bottom-4" : "bottom-40 sm:bottom-44"
          }`}
        >
          {grouped.map(group => (
            <div key={group.category} className="mb-2">
              <p className="px-1 pb-1 font-mono text-[9px] uppercase tracking-wider text-zinc-500">
                {group.label}
              </p>
              {group.items.map(e => (
                <button
                  key={e.id}
                  onClick={() => setId(e.id)}
                  className={`mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition ${
                    id === e.id
                      ? "bg-[#C9A84C]/20 text-[#E7C766]"
                      : "text-zinc-300 hover:bg-white/10"
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: e.color }}
                  />
                  <span className="font-mono text-[11px] leading-tight">
                    {e.name}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Compact info + model actions */}
      {!uiHidden && view !== "photos" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-3 pb-4 sm:px-6">
          <div className="pointer-events-auto mx-auto flex max-h-[38vh] max-w-4xl flex-col gap-2 overflow-y-auto rounded-xl border border-white/10 bg-black/60 p-3 backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="font-mono text-sm font-semibold text-zinc-100">
                  {eng.name}
                </h2>
                <p className="font-mono text-[10px] text-zinc-400 sm:text-[11px]">
                  {eng.maker} · {eng.origin} · {eng.years}
                </p>
              </div>
              {view === "model" && (
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
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={savePNG}
                    className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 font-mono text-[11px] text-zinc-200 transition hover:bg-white/15"
                    title="Save PNG"
                  >
                    <Download className="h-3.5 w-3.5" /> PNG
                  </button>
                  <button
                    onClick={exportSTL}
                    className="inline-flex items-center gap-1 rounded-md border border-[#C9A84C]/60 bg-[#C9A84C]/15 px-2.5 py-1.5 font-mono text-[11px] font-medium text-[#C9A84C] transition hover:bg-[#C9A84C]/25"
                    title="Export a 3D-printable STL"
                  >
                    <Boxes className="h-3.5 w-3.5" /> STL
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className={chip}>{eng.layout}</span>
              <span className={chip}>{eng.displacement}</span>
              <span className={chip}>{eng.power}</span>
            </div>

            <div className="flex items-end gap-3">
              <p
                className={`min-w-0 flex-1 text-[11px] leading-relaxed text-zinc-300 sm:text-[12px] ${
                  detailsOpen ? "" : "line-clamp-2"
                }`}
              >
                {eng.story}
              </p>
              <button
                onClick={() => setDetailsOpen(v => !v)}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] text-zinc-300 transition hover:bg-white/10"
              >
                {detailsOpen ? "Less" : "Details"}
                <ChevronDown
                  className={`h-3 w-3 transition ${detailsOpen ? "rotate-180" : ""}`}
                />
              </button>
            </div>

            {detailsOpen && (
              <>
                <div className="grid gap-2 border-t border-white/10 pt-2 sm:grid-cols-2">
                  <p className="text-[11px] leading-relaxed text-zinc-400">
                    <span className={label}>Under the bonnet</span>
                    <br />
                    {eng.spec}
                  </p>
                  <p className="text-[11px] leading-relaxed text-zinc-400">
                    <span className={label}>Legacy</span>
                    <br />
                    {eng.legacy}
                  </p>
                </div>
                <div className="flex items-center justify-between border-t border-white/10 pt-2">
                  <p className="font-mono text-[10px] text-zinc-500">
                    Made by Tim, for Tim.
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
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
