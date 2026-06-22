import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Github,
  Pause,
  Play,
  Sparkles,
  X,
} from "lucide-react";
import type { SelectedInfo, SkyData, SkyView } from "@/lib/sky/SkyView";

const LOCATIONS = [
  {
    name: "Vivonne Bay",
    sub: "Kangaroo Island, SA",
    lat: -35.9838,
    lon: 137.1767,
  },
  {
    name: "Vivonne Bay Beach",
    sub: "Kangaroo Island, SA",
    lat: -35.9815,
    lon: 137.1835,
  },
];

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
  const mountRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<SkyView | null>(null);

  const [data, setData] = useState<SkyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loc, setLoc] = useState(0);
  const [minutes, setMinutes] = useState(21 * 60); // 9pm by default
  const [dayOffset, setDayOffset] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<SelectedInfo | null>(null);

  const [showConstellations, setShowConstellations] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showPlanets, setShowPlanets] = useState(true);
  const [showDSO, setShowDSO] = useState(true);

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
      fetch(`${base}sky/sky-stars.json`).then(r => r.json()),
      fetch(`${base}sky/sky-constellations.json`).then(r => r.json()),
      fetch(`${base}sky/sky-messier.json`).then(r => r.json()),
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
          lat: LOCATIONS[loc].lat,
          lon: LOCATIONS[loc].lon,
          locationName: LOCATIONS[loc].name,
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
      lat: LOCATIONS[loc].lat,
      lon: LOCATIONS[loc].lon,
      locationName: LOCATIONS[loc].name,
      showConstellations,
      showLabels,
      showPlanets,
      showDSO,
    });
  }, [loc, showConstellations, showLabels, showPlanets, showDSO]);

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
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#05060a] text-zinc-100">
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
            <p className="hidden text-[11px] text-zinc-400 sm:block">
              Looking up from {LOCATIONS[loc].name} · {LOCATIONS[loc].sub}
            </p>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 p-1 backdrop-blur">
          {LOCATIONS.map((l, i) => (
            <button
              key={l.name}
              onClick={() => setLoc(i)}
              className={`h-7 rounded-md px-2.5 font-mono text-[11px] transition ${
                i === loc
                  ? "bg-[#C9A84C] text-[#1a1a2e]"
                  : "text-zinc-300 hover:bg-white/10"
              }`}
            >
              {i === 0 ? "House" : "Beach"}
            </button>
          ))}
        </div>
      </header>

      {/* Selected object card */}
      {selected && (
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

      {/* Bottom controls */}
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
    </div>
  );
}
