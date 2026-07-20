import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Download,
  FileDown,
  Layers,
  Maximize,
  Minimize,
  Mountain,
  Orbit,
  RotateCcw,
  Ruler,
  Table2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { FoundationView, type ViewToggles } from "@/lib/foundation/FoundationView";
import {
  analyseTerrain,
  DEFAULT_PARAMS,
  demFromPoints,
  designFoundation,
  parsePointCloud,
  scheduleToCsv,
  scheduleToDxf,
  synthTerrain,
  TERRAIN_PRESETS,
  type Dem,
  type DesignParams,
  type FoundationSystem,
  type TerrainPreset,
} from "@/lib/foundation/foundation";

type Source = "synthetic" | "upload";

const SYSTEM_LABEL: Record<FoundationSystem, string> = {
  pier: "Concrete pier",
  stump: "Steel/timber stump",
  pedestal: "Adjustable pedestal",
};

const SYSTEM_DIAMETERS: Record<FoundationSystem, number[]> = {
  pier: [200, 250, 300, 350, 400, 450],
  stump: [90, 100, 125, 150, 200],
  pedestal: [50, 80, 100, 150],
};

function download(name: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Foundation() {
  const rootRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<FoundationView | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(true);

  // terrain source
  const [source, setSource] = useState<Source>("synthetic");
  const [preset, setPreset] = useState<TerrainPreset>("sloped");
  const [slope, setSlope] = useState(2.4);
  const [roughness, setRoughness] = useState(0.6);
  const [uploaded, setUploaded] = useState<{ dem: Dem; name: string; count: number; format: string } | null>(null);

  // design params (individually controlled)
  const [system, setSystem] = useState<FoundationSystem>("pier");
  const [footprintW, setFootprintW] = useState(DEFAULT_PARAMS.footprintW);
  const [footprintL, setFootprintL] = useState(DEFAULT_PARAMS.footprintL);
  const [maxSpan, setMaxSpan] = useState(DEFAULT_PARAMS.maxSpan);
  const [minHeight, setMinHeight] = useState(DEFAULT_PARAMS.minHeight);
  const [maxHeight, setMaxHeight] = useState(DEFAULT_PARAMS.maxHeight);
  const [clearance, setClearance] = useState(DEFAULT_PARAMS.clearance);
  const [imposedLoad, setImposedLoad] = useState(DEFAULT_PARAMS.imposedLoad);

  // view
  const [toggles, setToggles] = useState<ViewToggles>({
    terrain: true,
    piers: true,
    beams: true,
    deck: true,
    exaggeration: 1,
  });

  const dem = useMemo<Dem | null>(() => {
    try {
      if (source === "upload") return uploaded?.dem ?? null;
      return synthTerrain(preset, 12, slope, roughness);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    }
  }, [source, uploaded, preset, slope, roughness]);

  const params = useMemo<DesignParams>(
    () => ({
      ...DEFAULT_PARAMS,
      footprintW,
      footprintL,
      maxSpan,
      minHeight,
      maxHeight,
      clearance,
      imposedLoad,
      system,
      diameters: SYSTEM_DIAMETERS[system],
    }),
    [footprintW, footprintL, maxSpan, minHeight, maxHeight, clearance, imposedLoad, system]
  );

  const result = useMemo(() => (dem ? designFoundation(dem, params) : null), [dem, params]);
  const stats = useMemo(() => (dem ? analyseTerrain(dem) : null), [dem]);

  // create the view once the mount is ready
  useEffect(() => {
    if (!mountRef.current || viewRef.current) return;
    try {
      viewRef.current = new FoundationView(mountRef.current, { autoRotate });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    return () => {
      viewRef.current?.dispose();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // push data to the view; reframe when the terrain (dem) itself changes
  const prevDem = useRef<Dem | null>(null);
  useEffect(() => {
    const v = viewRef.current;
    if (!v || !dem || !result) return;
    v.update(dem, result);
    if (prevDem.current !== dem) {
      v.frame();
      prevDem.current = dem;
    }
  }, [dem, result]);

  useEffect(() => {
    viewRef.current?.setToggles(toggles);
  }, [toggles]);

  useEffect(() => {
    viewRef.current?.setAutoRotate(autoRotate);
  }, [autoRotate]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else rootRef.current?.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const onUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const parsed = parsePointCloud(text, file.name);
        if (parsed.points.length < 3) {
          setError(`Only ${parsed.points.length} points read from ${file.name}. Expected x y z per line (CSV/XYZ), or an OBJ/PLY mesh.`);
          return;
        }
        const d = demFromPoints(parsed.points, 90);
        setUploaded({ dem: d, name: file.name, count: parsed.points.length, format: parsed.format });
        setSource("upload");
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    };
    reader.onerror = () => setError(`Could not read ${file.name}`);
    reader.readAsText(file);
  }, []);

  const savePNG = useCallback(() => {
    const url = viewRef.current?.exportPNG(2560);
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `foundation-${Date.now()}.png`;
    a.click();
  }, []);

  const exportCsv = useCallback(() => {
    if (!result) return;
    download(`foundation-schedule-${Date.now()}.csv`, scheduleToCsv(result), "text/csv");
  }, [result]);

  const exportDxf = useCallback(() => {
    if (!result) return;
    download(`foundation-plan-${Date.now()}.dxf`, scheduleToDxf(result), "application/dxf");
  }, [result]);

  const reset = useCallback(() => viewRef.current?.resetView(), []);

  const bom = result?.bom;
  const label = "font-mono text-[10px] uppercase tracking-wider text-zinc-400";
  const field =
    "w-full rounded-md border border-white/10 bg-black/40 px-2 py-1 font-mono text-xs text-zinc-100 outline-none focus:border-[#C9A84C]/60";
  const iconBtn =
    "inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/5 text-zinc-300 backdrop-blur transition hover:bg-white/10";

  function numRow(
    text: string,
    value: number,
    setter: (n: number) => void,
    step: number,
    unit: string,
    min?: number,
    max?: number
  ) {
    return (
      <label className="block">
        <span className={label}>
          {text} <span className="text-zinc-600">({unit})</span>
        </span>
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          max={max}
          onChange={e => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) setter(n);
          }}
          className={`mt-1 ${field}`}
        />
      </label>
    );
  }

  return (
    <div
      ref={rootRef}
      className="relative h-[100dvh] w-full overflow-hidden bg-[#05060a] text-zinc-100"
    >
      <div ref={mountRef} className="absolute inset-0" />

      {error && (
        <div className="absolute left-1/2 top-4 z-30 w-[min(92vw,32rem)] -translate-x-1/2">
          <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-950/70 px-3 py-2 backdrop-blur">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
            <p className="text-xs leading-relaxed text-rose-100">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-rose-300 hover:text-white">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Top bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="pointer-events-auto flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-zinc-300 backdrop-blur transition hover:bg-white/10"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Home
          </Link>
          <div>
            <h1 className="font-mono text-sm font-semibold tracking-tight text-zinc-100 sm:text-base">
              Terrain → Foundation
            </h1>
            <p className="hidden text-[11px] text-zinc-400 sm:block">
              Site scan to build-ready pier layout &amp; schedule
            </p>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={() => setAutoRotate(v => !v)}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 backdrop-blur transition ${
              autoRotate ? "bg-[#C9A84C] text-[#1a1a2e]" : "bg-white/5 text-zinc-300 hover:bg-white/10"
            }`}
            title="Auto-rotate"
          >
            <Orbit className="h-4 w-4" />
          </button>
          <button onClick={reset} className={iconBtn} title="Reset view">
            <RotateCcw className="h-4 w-4" />
          </button>
          <button onClick={savePNG} className={iconBtn} title="Save PNG">
            <Download className="h-4 w-4" />
          </button>
          <button onClick={toggleFullscreen} className={iconBtn} title="Fullscreen (F)">
            {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Left control panel */}
      <div className="pointer-events-auto absolute left-3 top-16 z-10 flex max-h-[calc(100dvh-5.5rem)] w-[16.5rem] flex-col gap-3 overflow-y-auto rounded-xl border border-white/10 bg-black/50 p-3 backdrop-blur sm:left-4">
        {/* Terrain source */}
        <section className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Mountain className="h-3.5 w-3.5 text-[#C9A84C]" />
            <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-200">
              Terrain
            </h2>
          </div>
          <div className="flex rounded-md border border-white/10 p-0.5">
            {(["synthetic", "upload"] as Source[]).map(s => (
              <button
                key={s}
                onClick={() => {
                  setSource(s);
                  if (s === "upload" && !uploaded) fileRef.current?.click();
                }}
                className={`h-6 flex-1 rounded font-mono text-[10px] transition ${
                  source === s ? "bg-[#C9A84C] text-[#1a1a2e]" : "text-zinc-300 hover:bg-white/10"
                }`}
              >
                {s === "synthetic" ? "Sample site" : "Upload scan"}
              </button>
            ))}
          </div>

          {source === "synthetic" ? (
            <>
              <label className="block">
                <span className={label}>Site preset</span>
                <select
                  value={preset}
                  onChange={e => setPreset(e.target.value as TerrainPreset)}
                  className={`mt-1 ${field}`}
                >
                  {TERRAIN_PRESETS.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={label}>
                  Fall <span className="text-zinc-600">({slope.toFixed(1)} m)</span>
                </span>
                <input
                  type="range"
                  min={0.4}
                  max={5}
                  step={0.1}
                  value={slope}
                  onChange={e => setSlope(Number(e.target.value))}
                  className="mt-1 w-full accent-[#C9A84C]"
                />
              </label>
              <label className="block">
                <span className={label}>
                  Roughness <span className="text-zinc-600">({roughness.toFixed(1)} m)</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={roughness}
                  onChange={e => setRoughness(Number(e.target.value))}
                  className="mt-1 w-full accent-[#C9A84C]"
                />
              </label>
            </>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-white/20 bg-white/5 px-2 py-2 font-mono text-[11px] text-zinc-200 transition hover:bg-white/10"
              >
                <Upload className="h-3.5 w-3.5" /> Choose point cloud
              </button>
              <p className="text-[10px] leading-relaxed text-zinc-500">
                CSV / XYZ (x y z per line), OBJ or ASCII PLY.
              </p>
              {uploaded && (
                <p className="rounded bg-white/5 px-2 py-1 font-mono text-[10px] text-zinc-300">
                  {uploaded.name}
                  <br />
                  {uploaded.count.toLocaleString()} pts · {uploaded.format}
                </p>
              )}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xyz,.txt,.obj,.ply"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = "";
            }}
          />
        </section>

        {/* Building */}
        <section className="space-y-2 border-t border-white/10 pt-3">
          <div className="flex items-center gap-1.5">
            <Ruler className="h-3.5 w-3.5 text-[#C9A84C]" />
            <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-200">
              Structure
            </h2>
          </div>
          <label className="block">
            <span className={label}>Foundation system</span>
            <select
              value={system}
              onChange={e => setSystem(e.target.value as FoundationSystem)}
              className={`mt-1 ${field}`}
            >
              {(Object.keys(SYSTEM_LABEL) as FoundationSystem[]).map(s => (
                <option key={s} value={s}>
                  {SYSTEM_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {numRow("Width", footprintW, setFootprintW, 0.5, "m", 1)}
            {numRow("Length", footprintL, setFootprintL, 0.5, "m", 1)}
          </div>
          {numRow("Max span", maxSpan, setMaxSpan, 0.1, "m", 0.5)}
          <div className="grid grid-cols-2 gap-2">
            {numRow("Min height", minHeight, setMinHeight, 0.05, "m", 0)}
            {numRow("Max height", maxHeight, setMaxHeight, 0.1, "m", 0.1)}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {numRow("Clearance", clearance, setClearance, 0.05, "m", 0)}
            {numRow("Load", imposedLoad, setImposedLoad, 0.5, "kPa", 0.5)}
          </div>
        </section>

        {/* Display */}
        <section className="space-y-2 border-t border-white/10 pt-3">
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-[#C9A84C]" />
            <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-200">
              Display
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                ["terrain", "Terrain"],
                ["piers", "Piers"],
                ["beams", "Beams"],
                ["deck", "Deck"],
              ] as [keyof ViewToggles, string][]
            ).map(([k, lbl]) => (
              <button
                key={k}
                onClick={() => setToggles(t => ({ ...t, [k]: !t[k] }))}
                className={`h-7 rounded-md border border-white/10 font-mono text-[10px] transition ${
                  toggles[k as "terrain"] ? "bg-white/15 text-zinc-100" : "bg-black/30 text-zinc-500"
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
          <label className="block">
            <span className={label}>
              Vertical exaggeration{" "}
              <span className="text-zinc-600">({toggles.exaggeration.toFixed(1)}×)</span>
            </span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.5}
              value={toggles.exaggeration}
              onChange={e => setToggles(t => ({ ...t, exaggeration: Number(e.target.value) }))}
              className="mt-1 w-full accent-[#C9A84C]"
            />
          </label>
        </section>
      </div>

      {/* Terrain analysis chips (top-centre) */}
      {stats && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-10 hidden -translate-x-1/2 lg:block">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/45 px-3 py-1.5 backdrop-blur">
            <Stat label="Max slope" value={`${stats.maxSlopeDeg.toFixed(1)}°`} />
            <Stat label="Mean" value={`${stats.meanSlopeDeg.toFixed(1)}°`} />
            <Stat label="Relief" value={`${stats.reliefZ.toFixed(2)} m`} />
            <Stat label="Aspect" value={`${Math.round(stats.aspectDeg)}°`} />
          </div>
        </div>
      )}

      {/* Schedule + BOM panel (right) */}
      {result && bom && (
        <div
          className={`pointer-events-auto absolute right-3 top-16 z-10 flex max-h-[calc(100dvh-5.5rem)] w-[20rem] flex-col rounded-xl border border-white/10 bg-black/55 backdrop-blur sm:right-4 ${
            scheduleOpen ? "" : "w-auto"
          }`}
        >
          <button
            onClick={() => setScheduleOpen(o => !o)}
            className="flex items-center gap-2 border-b border-white/10 px-3 py-2"
          >
            <Table2 className="h-3.5 w-3.5 text-[#C9A84C]" />
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-200">
              Foundation schedule
            </span>
            <span className="ml-auto font-mono text-[10px] text-zinc-500">
              {scheduleOpen ? "hide" : "show"}
            </span>
          </button>

          {scheduleOpen && (
            <>
              {/* BOM summary */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-b border-white/10 p-3">
                <Metric label="Piers" value={String(bom.pierCount)} />
                <Metric label="Bays" value={`${result.nx - 1} × ${result.ny - 1}`} />
                <Metric
                  label="Spacing"
                  value={`${bom.baySpacingX.toFixed(2)} × ${bom.baySpacingY.toFixed(2)} m`}
                />
                <Metric
                  label="Span"
                  value={bom.spanOk ? "OK" : "OVER"}
                  warn={!bom.spanOk}
                />
                <Metric label="Support ∑" value={`${bom.totalSupportLength.toFixed(1)} m`} />
                <Metric label="Concrete" value={`${bom.concreteVolume.toFixed(2)} m³`} />
                <Metric label="Beams" value={`${bom.beamLength.toFixed(1)} m`} />
                <Metric label="Height" value={`${(bom.minHeight * 1000) | 0}–${(bom.maxHeight * 1000) | 0} mm`} />
                <Metric
                  label="Over-height"
                  value={String(bom.overHeightCount)}
                  warn={bom.overHeightCount > 0}
                />
                <Metric label="Est. cost" value={`$${Math.round(bom.estimatedCost).toLocaleString()}`} />
              </div>

              {/* Schedule table */}
              <div className="min-h-0 flex-1 overflow-y-auto">
                <table className="w-full border-collapse font-mono text-[10px]">
                  <thead className="sticky top-0 bg-[#0b0e14]">
                    <tr className="text-zinc-400">
                      <th className="px-2 py-1 text-left font-medium">Pier</th>
                      <th className="px-1 py-1 text-right font-medium">X</th>
                      <th className="px-1 py-1 text-right font-medium">Y</th>
                      <th className="px-1 py-1 text-right font-medium">Ht</th>
                      <th className="px-2 py-1 text-right font-medium">Ø</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.piers.map(p => (
                      <tr
                        key={p.label}
                        className={`border-t border-white/5 ${
                          p.aboveMax ? "text-rose-300" : p.belowMin ? "text-amber-300" : "text-zinc-300"
                        }`}
                      >
                        <td className="px-2 py-0.5 text-left">
                          {p.label}
                          <span className="ml-1 text-zinc-600">{p.grid}</span>
                        </td>
                        <td className="px-1 py-0.5 text-right">{p.x.toFixed(1)}</td>
                        <td className="px-1 py-0.5 text-right">{p.y.toFixed(1)}</td>
                        <td className="px-1 py-0.5 text-right">{Math.round(p.height * 1000)}</td>
                        <td className="px-2 py-0.5 text-right">{p.diameter}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Export */}
              <div className="flex gap-2 border-t border-white/10 p-2.5">
                <button
                  onClick={exportCsv}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[#C9A84C] px-2 py-1.5 font-mono text-[11px] font-semibold text-[#1a1a2e] transition hover:brightness-110"
                >
                  <FileDown className="h-3.5 w-3.5" /> CSV
                </button>
                <button
                  onClick={exportDxf}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-2 py-1.5 font-mono text-[11px] text-zinc-200 transition hover:bg-white/10"
                >
                  <FileDown className="h-3.5 w-3.5" /> DXF
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <p className="pointer-events-none absolute bottom-2 left-1/2 z-10 -translate-x-1/2 text-center font-mono text-[9px] leading-relaxed text-zinc-600">
        Drag to orbit · scroll to zoom · right-drag to pan. Indicative layout only — subject to review by a licensed engineer.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-1.5 text-center">
      <div className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="font-mono text-xs font-semibold text-zinc-100">{value}</div>
    </div>
  );
}

function Metric({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`font-mono text-xs font-semibold ${warn ? "text-rose-300" : "text-zinc-100"}`}>
        {value}
      </div>
    </div>
  );
}
