import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  MountainSnow,
  Snowflake,
  Thermometer,
  Wind,
} from "lucide-react";

interface FallsSummary {
  temperature: number;
  wind: number;
  snowfall: number;
  snowLine: number;
}

export default function HomeFallsCreekWidget() {
  const [summary, setSummary] = useState<FallsSummary | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({
      latitude: "-36.8703",
      longitude: "147.2737",
      elevation: "1773",
      current: "temperature_2m,wind_speed_10m",
      hourly: "snowfall,freezing_level_height",
      forecast_hours: "168",
      timezone: "Australia/Melbourne",
    });
    const controller = new AbortController();
    fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      signal: controller.signal,
    })
      .then(response => {
        if (!response.ok) throw new Error("Forecast unavailable");
        return response.json();
      })
      .then(data => {
        const snowfall = (data.hourly?.snowfall ?? []).reduce(
          (sum: number, value: number) => sum + value,
          0
        );
        const freezing = data.hourly?.freezing_level_height?.[0] ?? 0;
        setSummary({
          temperature: data.current?.temperature_2m ?? 0,
          wind: data.current?.wind_speed_10m ?? 0,
          snowfall,
          snowLine: freezing - 280,
        });
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700 bg-[#09131f] shadow-inner">
      <div className="relative h-[22rem] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_65%_28%,rgba(101,204,236,.3),transparent_25%),linear-gradient(155deg,#152b36_0%,#1d3c45_38%,#09131f_100%)]" />
        <svg
          viewBox="0 0 620 410"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="mountain" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#dff6ff" />
              <stop offset="0.45" stopColor="#84aebb" />
              <stop offset="1" stopColor="#1b3439" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            d="M-30 385 L40 310 92 325 161 219 215 270 294 119 349 220 391 171 447 251 505 194 663 363 663 430 -30 430Z"
            fill="url(#mountain)"
            opacity="0.95"
          />
          <g fill="none" stroke="rgba(5,24,35,.42)" strokeWidth="2">
            <path d="M26 354 Q109 300 185 319 T345 290 T520 310 T645 346" />
            <path d="M55 326 Q138 269 208 294 T356 258 T502 279 T622 318" />
            <path d="M102 292 Q168 245 233 261 T362 230 T475 249 T576 285" />
            <path d="M149 259 Q211 211 263 232 T365 201 T450 220 T530 255" />
          </g>
          <path
            d="M39 313 Q152 293 247 239 T450 215 T594 271"
            fill="none"
            stroke="#9ce8ff"
            strokeWidth="3"
            strokeDasharray="8 7"
            filter="url(#glow)"
          />
          <g fill="none" stroke="#f0443a" strokeWidth="4" strokeLinecap="round">
            <path d="M270 316 L331 167" />
            <path d="M342 332 L391 222" />
            <path d="M418 328 L463 259" />
          </g>
        </svg>

        <div className="absolute inset-x-4 top-4 flex items-center justify-between">
          <div className="rounded-lg border border-white/15 bg-black/45 px-3 py-2 backdrop-blur">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-200">
              Live model · Falls Creek
            </p>
            <p className="mt-0.5 text-sm font-semibold text-white">
              7-day alpine outlook
            </p>
          </div>
          <MountainSnow className="text-white drop-shadow" size={28} />
        </div>

        <div className="absolute inset-x-4 bottom-4 grid grid-cols-2 gap-2 text-white sm:grid-cols-4">
          <Stat
            icon={<Thermometer size={13} />}
            label="Summit"
            value={summary ? `${summary.temperature.toFixed(1)}°C` : "—"}
          />
          <Stat
            icon={<Wind size={13} />}
            label="Wind"
            value={summary ? `${summary.wind.toFixed(0)} km/h` : "—"}
          />
          <Stat
            icon={<Snowflake size={13} />}
            label="7-day snow"
            value={summary ? `${summary.snowfall.toFixed(1)} cm` : "—"}
          />
          <Stat
            icon={<MountainSnow size={13} />}
            label="Snow line"
            value={summary ? `${Math.round(summary.snowLine)} m` : "—"}
          />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-700 px-4 py-3">
        <p className="text-xs text-slate-400">
          3D terrain · hourly forecast · lift and run map
        </p>
        <a
          href="/falls-creek"
          className="inline-flex items-center gap-1 text-sm font-semibold text-cyan-300 transition hover:text-cyan-100"
        >
          Open snow map <ArrowUpRight size={15} />
        </a>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/42 p-2 backdrop-blur">
      <p className="flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.12em] text-cyan-200">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-xs font-semibold">{value}</p>
    </div>
  );
}
