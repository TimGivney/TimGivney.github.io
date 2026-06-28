import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  Github,
  MapPin,
  Maximize,
  Minimize,
  Pause,
  Play,
  Sparkles,
  X,
} from "lucide-react";
import type { SelectedInfo, SkyData, SkyView } from "@/lib/sky/SkyView";

// This view is grounded at the beach end of Vivonne Bay (Point Ellen), where the
// dark southern sky is at its best — not the house.
const BEACH = {
  name: "Vivonne Bay Beach",
  sub: "Kangaroo Island, SA",
  lat: -35.9815,
  lon: 137.1835,
};

// Google Maps link to the exact observing spot (the river mouth at Point Ellen).
const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${BEACH.lat},${BEACH.lon}`;

// South Australia: ACST (UTC+9:30), ACDT (UTC+10:30) during daylight saving
// (first Sunday of October to first Sunday of April).
function saOffsetHours(approxLocal: Date): number {
  const year = approxLocal.getUTCFullYear();
  const firstSunday = (month: number) => {
    const dow = new Date(Date.UTC(year, month, 1)).getUTCDay();
    return dow === 0 ? 1 : 8 - dow;
  };
  const dstStart = Date.UTC(year, 9, firstSunday(9));
  const dstEnd = Date.UTC(year, 3, firstSunday(3));
  const t = Date.UTC(
    approxLocal.getUTCFullYear(),
    approxLocal.getUTCMonth(),
    approxLocal.getUTCDate()
  );
  return t >= dstStart || t < dstEnd ? 10.5 : 9.5;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function Sky() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<SkyView | null>(null);

  const [data, setData] = useState<SkyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(21 * 60); // 9pm by default
  const [dayOffset, setDayOffset] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<SelectedInfo | null>(null);

  const [showConstellations, setShowConstellations] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showPlanets, setShowPlanets] = useState(true);
  const [showDSO, setShowDSO] = useState(true);
  const [showLocation, setShowLocation] = useState(false);
  const [hideUI, setHideUI] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // The actual instant (UTC) for the selected local time + day.
  const { when, localDate } = useMemo(() => {
    const base = new Date();
    const approxLocal = new Date(base.getTime() + 9.5 * 3600_000);
    const startOfLocalDay = Date.UTC(
      approxLocal.getUTCFullYear(),
      approxLocal.getUTCMonth(),
      approxLocal.getUTCDate()
    );
    const localMs = startOfLocalDay + dayOffset * 86400_000 + minutes * 60_000;
    const offset = saOffsetHours(new Date(localMs));
    return {
      when: new Date(localMs - offset * 3600_000),
      localDate: new Date(localMs),
    };
  }, [minutes, dayOffset]);

  // Fetch catalogue data once.
  useEffect(() => {
    let cancelled = false;
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}sky-data/sky-stars.json`).then(r => r.json()),
      fetch(`${base}sky-data/sky-constellations.json`).then(r => r.json()),
      fetch(`${base}sky-data/sky-messier.json`).then(r => r.json()),
    ])
      .then(([stars, constellations, messier]) => {
        if (!cancelled) setData({ stars, constellations, messier });
      })
      .catch(err => !cancelled && setError(String(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  // Build the view once data + mount are ready.
  useEffect(() => {
    if (!data || !mountRef.current) return;
    let view: SkyView | null = null;
    let cancelled = false;
    import("@/lib/sky/SkyView")
      .then(({ SkyView: SV }) => {
        if (cancelled || !mountRef.current) return;
        view = new SV(mountRef.current, data, {
          lat: BEACH.lat,
          lon: BEACH.lon,
          locationName: BEACH.name,
          showConstellations,
          showLabels,
          showPlanets,
          showDSO,
          onSelect: info => setSelected(info),
        });
        view.setTime(when);
        viewRef.current = view;
      })
      .catch(err => setError(String(err)));
    return () => {
      cancelled = true;
      view?.dispose();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    viewRef.current?.setTime(when);
  }, [when]);

  useEffect(() => {
    viewRef.current?.setOptions({
      lat: BEACH.lat,
      lon: BEACH.lon,
      locationName: BEACH.name,
      showConstellations,
      showLabels,
      showPlanets,
      showDSO,
    });
  }, [showConstellations, showLabels, showPlanets, showDSO]);

  // Time-lapse animation.
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setMinutes(m => {
        const next = m + 2;
        if (next >= 1440) {
          setDayOffset(d => d + 1);
          return next - 1440;
        }
        return next;
      });
    }, 60);
    return () => window.clearInterval(id);
  }, [playing]);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === "h" || e.key === "H") {
        e.preventDefault();
        setHideUI(v => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleFullscreen]);

  const goNow = useCallback(() => {
    setPlaying(false);
    const approxLocal = new Date(Date.now() + 9.5 * 3600_000);
    setDayOffset(0);
    setMinutes(approxLocal.getUTCHours() * 60 + approxLocal.getUTCMinutes());
  }, []);

  const timeLabel = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
    minutes % 60
  ).padStart(2, "0")}`;
  const dateLabel = `${WEEKDAYS[localDate.getUTCDay()]} ${localDate.getUTCDate()} ${
    MONTHS[localDate.getUTCMonth()]
  }`;
  const offsetLabel = saOffsetHours(localDate) === 10.5 ? "ACDT" : "ACST";

  const toggle =
    "rounded-md px-2.5 py-1.5 font-mono text-[11px] transition border";
  const toggleOn = "bg-[#C9A84C] text-[#1a1a2e] border-[#C9A84C]";
  const toggleOff =
    "border-white/10 bg-white/5 text-zinc-200 hover:bg-white/15";

  return (
    <div
      ref={containerRef}
      className="relative h-[100dvh] w-full overflow-hidden bg-[#05060a] text-zinc-100"
    >
      <div ref={mountRef} className="absolute inset-0" />

      {!data && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-sm text-zinc-400">
          Loading star catalogue…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-20 flex items-center justify-center px-6 text-center">
          <div className="max-w-md rounded-xl border border-white/10 bg-black/60 p-6 backdrop-blur">
            <p className="font-mono text-sm text-rose-300">Couldn’t load the sky</p>
            <p className="mt-2 text-xs text-zinc-400">{error}</p>
          </div>
        </div>
      )}

      {/* Top bar */}
      {!hideUI && (
        <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="pointer-events-auto flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-zinc-300 backdrop-blur transition hover:bg-white/10"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Home
            </Link>
            <div>
              <h1 className="font-mono text-sm font-semibold tracking-tight sm:text-base">
                Night Sky
              </h1>
              <p className="text-[11px] text-zinc-400">
                Looking up from {BEACH.name} · {BEACH.sub}
              </p>
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-1.5">
            <button
              onClick={() => setShowLocation(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 font-mono text-[11px] text-zinc-200 backdrop-blur transition hover:bg-white/15"
              title="See where this is on the map"
            >
              <MapPin className="h-3.5 w-3.5" /> Location
            </button>
            <button
              onClick={() => setHideUI(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 font-mono text-[11px] text-zinc-200 backdrop-blur transition hover:bg-white/15"
              title="Hide controls (H)"
            >
              <EyeOff className="h-3.5 w-3.5" /> Hide UI
            </button>
            <button
              onClick={toggleFullscreen}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 font-mono text-[11px] text-zinc-200 backdrop-blur transition hover:bg-white/15"
              title="Fullscreen (F)"
            >
              {isFullscreen ? (
                <Minimize className="h-3.5 w-3.5" />
              ) : (
                <Maximize className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {isFullscreen ? "Exit" : "Fullscreen"}
              </span>
            </button>
          </div>
        </header>
      )}

      {/* Restore-UI control when hidden */}
      {hideUI && (
        <div className="absolute right-4 top-3 z-10 flex items-center gap-1.5 sm:right-6">
          <button
            onClick={toggleFullscreen}
            className="inline-flex items-center justify-center rounded-md border border-white/10 bg-black/40 p-2 text-zinc-200 backdrop-blur transition hover:bg-white/15"
            title="Fullscreen (F)"
          >
            {isFullscreen ? (
              <Minimize className="h-4 w-4" />
            ) : (
              <Maximize className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => setHideUI(false)}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 font-mono text-[11px] text-zinc-200 backdrop-blur transition hover:bg-white/15"
            title="Show controls (H)"
          >
            <Eye className="h-3.5 w-3.5" /> Show UI
          </button>
        </div>
      )}

      {/* Selected object card */}
      {selected && !hideUI && (
        <div className="absolute left-4 top-20 z-10 w-72 max-w-[calc(100%-2rem)] rounded-xl border border-white/10 bg-black/55 p-4 backdrop-blur sm:left-6">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-mono text-base font-semibold text-[#C9A84C]">
                {selected.title}
              </p>
              {selected.subtitle && (
                <p className="text-[11px] uppercase tracking-wider text-zinc-400">
                  {selected.subtitle}
                </p>
              )}
            </div>
            <button
              onClick={() => {
                setSelected(null);
                viewRef.current?.clearSelection();
              }}
              className="rounded p-1 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ul className="mt-2 space-y-0.5">
            {selected.facts.map((f, i) => (
              <li key={i} className="text-xs text-zinc-300">
                {f}
              </li>
            ))}
          </ul>
          {selected.myth && (
            <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-relaxed text-zinc-300">
              {selected.myth}
            </p>
          )}
        </div>
      )}

      {/* Location: aerial photo with a pin on the exact spot */}
      {showLocation && (
        <div className="absolute inset-0 z-30 flex flex-col bg-black/90 backdrop-blur">
          <div className="flex items-start justify-between gap-3 px-4 py-3 sm:px-6">
            <div>
              <p className="font-mono text-sm font-semibold text-zinc-100">
                Vivonne Bay Beach · Location
              </p>
              <p className="text-[11px] text-zinc-400">
                The pin marks exactly where you’re standing — the river mouth at
                Point Ellen, {BEACH.lat}, {BEACH.lon}
              </p>
            </div>
            <button
              onClick={() => setShowLocation(false)}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 font-mono text-[11px] text-zinc-200 transition hover:bg-white/15"
            >
              <X className="h-4 w-4" /> Close
            </button>
          </div>
          <div className="relative flex-1 overflow-hidden">
            <img
              src={`${import.meta.env.BASE_URL}assets/vivonne-bay-beach-aerial.jpg`}
              alt="Aerial view of Vivonne Bay Beach, Kangaroo Island"
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* Pin on the river mouth */}
            <a
              href={MAPS_URL}
              target="_blank"
              rel="noreferrer"
              className="group absolute -translate-x-1/2 -translate-y-full"
              style={{ left: "52%", top: "9%" }}
              title="Open in Google Maps"
            >
              <span className="absolute left-1/2 top-full h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-[#C9A84C]/70" />
              <MapPin
                className="relative h-9 w-9 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] transition group-hover:scale-110"
                strokeWidth={2.5}
                style={{ color: "#C9A84C", fill: "#1a1a2e" }}
              />
              <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-black/70 px-2 py-0.5 font-mono text-[10px] text-zinc-100 backdrop-blur">
                You are here
              </span>
            </a>
          </div>
          <p className="px-4 py-2 text-center font-mono text-[10px] text-zinc-500 sm:px-6">
            Aerial of Vivonne Bay Beach, Kangaroo Island ·{" "}
            <a
              href={MAPS_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-zinc-400 underline-offset-2 transition hover:text-[#C9A84C] hover:underline"
            >
              <MapPin className="h-3 w-3" /> View on Google Maps
            </a>
          </p>
        </div>
      )}

      {/* Bottom controls */}
      {!hideUI && (
      <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-xl border border-white/10 bg-black/45 p-3 backdrop-blur">
          {/* Time row */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPlaying(p => !p)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#C9A84C] text-[#1a1a2e] transition hover:brightness-110"
              title={playing ? "Pause" : "Play time-lapse"}
            >
              {playing ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </button>
            <div className="flex-1">
              <input
                type="range"
                min={0}
                max={1439}
                step={1}
                value={minutes}
                onChange={e => setMinutes(Number(e.target.value))}
                className="w-full accent-[#C9A84C]"
              />
            </div>
            <div className="w-32 shrink-0 text-right font-mono text-sm">
              <span className="text-zinc-100">{timeLabel}</span>{" "}
              <span className="text-[10px] text-zinc-500">{offsetLabel}</span>
            </div>
          </div>

          {/* Date + toggles */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setDayOffset(d => d - 1)}
                className={`${toggle} ${toggleOff}`}
                title="Previous day"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-[5.5rem] text-center font-mono text-xs text-zinc-200">
                {dateLabel}
              </span>
              <button
                onClick={() => setDayOffset(d => d + 1)}
                className={`${toggle} ${toggleOff}`}
                title="Next day"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={goNow}
                className={`${toggle} ${toggleOff} inline-flex items-center gap-1`}
                title="Jump to now"
              >
                <Clock className="h-3.5 w-3.5" /> Now
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setShowConstellations(v => !v)}
                className={`${toggle} ${showConstellations ? toggleOn : toggleOff}`}
              >
                Constellations
              </button>
              <button
                onClick={() => setShowPlanets(v => !v)}
                className={`${toggle} ${showPlanets ? toggleOn : toggleOff}`}
              >
                Planets
              </button>
              <button
                onClick={() => setShowDSO(v => !v)}
                className={`${toggle} ${showDSO ? toggleOn : toggleOff}`}
              >
                Clusters
              </button>
              <button
                onClick={() => setShowLabels(v => !v)}
                className={`${toggle} ${showLabels ? toggleOn : toggleOff}`}
              >
                Labels
              </button>
            </div>
          </div>

          <p className="text-center font-mono text-[10px] text-zinc-500">
            <Sparkles className="mr-1 inline h-3 w-3 text-[#C9A84C]" />
            Tap any star, planet or cluster to identify it · zenith is centre,
            horizon is the rim (N up, E left)
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
