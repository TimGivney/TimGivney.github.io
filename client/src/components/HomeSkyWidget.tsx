import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, Pause, Play, RotateCcw } from "lucide-react";
import type { SkyData } from "@/lib/sky/SkyView";
import type { HorizonView } from "@/lib/sky/HorizonView";

const BEACH = { name: "Vivonne Bay Beach", lat: -35.9815, lon: 137.1835 };

// An instant that is night over Kangaroo Island (~21:00 ACST is ~11:30 UTC),
// so the preview always opens on a star-filled southern sky.
function beachNight(): Date {
  const d = new Date();
  d.setUTCHours(11, 30, 0, 0);
  return d;
}

/**
 * Compact, interactive Night Sky for the homepage. The star catalogue + WebGL
 * renderer are loaded lazily (only once the widget scrolls into view) so they
 * never weigh down the initial page load. The full planetarium lives at /sky.
 */
export default function HomeSkyWidget() {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HorizonView | null>(null);
  const timeRef = useRef<Date>(beachNight());
  const rafRef = useRef<number>(0);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    let cancelled = false;
    const io = new IntersectionObserver(
      async entries => {
        if (!entries[0].isIntersecting || viewRef.current) return;
        io.disconnect();
        const base = import.meta.env.BASE_URL;
        const [[stars, constellations, messier], { HorizonView }] =
          await Promise.all([
            Promise.all([
              fetch(`${base}sky-data/sky-stars.json`).then(r => r.json()),
              fetch(`${base}sky-data/sky-constellations.json`).then(r =>
                r.json()
              ),
              fetch(`${base}sky-data/sky-messier.json`).then(r => r.json()),
            ]),
            import("@/lib/sky/HorizonView"),
          ]);
        if (cancelled || !mountRef.current) return;
        const data: SkyData = { stars, constellations, messier };
        const view = new HorizonView(mountRef.current, data, {
          lat: BEACH.lat,
          lon: BEACH.lon,
          locationName: BEACH.name,
          showConstellations: true,
          showLabels: false,
          showPlanets: true,
          showDSO: false,
        });
        view.setTime(timeRef.current);
        viewRef.current = view;
        setReady(true);
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
      cancelAnimationFrame(rafRef.current);
      viewRef.current?.dispose();
      viewRef.current = null;
    };
  }, []);

  // Gentle time-lapse so the stars wheel across the sky in the preview.
  useEffect(() => {
    if (!ready || !playing) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      // ~1 sky-hour every real second.
      timeRef.current = new Date(timeRef.current.getTime() + dt * 3600);
      viewRef.current?.setTime(timeRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [ready, playing]);

  const resetNight = () => {
    timeRef.current = beachNight();
    viewRef.current?.setTime(timeRef.current);
  };

  const btn =
    "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-sm font-semibold" style={{ color: "#1B3F6B" }}>
          Vivonne Bay night sky
        </p>
        <span className="text-xs text-gray-400">Kangaroo Island, SA</span>
      </div>

      <div className="relative flex-1 overflow-hidden rounded-xl bg-[#05060a] ring-1 ring-gray-200">
        <div ref={mountRef} className="h-full min-h-[24rem] w-full" />
        {!ready && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-400">
            Loading sky…
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPlaying(p => !p)}
          disabled={!ready}
          className={`${btn} text-white`}
          style={{ backgroundColor: "#1B3F6B" }}
        >
          {playing ? <Pause size={15} /> : <Play size={15} />}
          {playing ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          onClick={resetNight}
          disabled={!ready}
          className={`${btn} text-gray-600 hover:text-gray-900`}
        >
          <RotateCcw size={15} /> Tonight
        </button>
        <Link
          href="/sky"
          className="ml-auto inline-flex items-center gap-1 text-sm font-semibold transition-opacity hover:opacity-70"
          style={{ color: "#C9A84C" }}
        >
          Open Night Sky <ArrowUpRight size={15} />
        </Link>
      </div>

      <p className="mt-2 text-xs text-gray-400">
        Drag to look around · play to watch the stars wheel. Full planetarium in
        Night Sky.
      </p>
    </div>
  );
}
