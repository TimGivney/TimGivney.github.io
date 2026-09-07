import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, MapPinned, MountainSnow, Snowflake } from "lucide-react";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  StyleSpecification,
} from "maplibre-gl";
import { findSnowResort, type SnowResort } from "@/lib/snowResorts";

const FEATURED_RESORTS = [
  findSnowResort("perisher"),
  findSnowResort("falls-creek"),
  findSnowResort("thredbo"),
  findSnowResort("mount-buller"),
];

const EMPTY_GEOJSON = {
  type: "FeatureCollection" as const,
  features: [],
};

const HOME_MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    terrain: {
      type: "raster-dem",
      url: "https://tiles.mapterhorn.com/tilejson.json",
      tileSize: 512,
    },
    satellite: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
    },
    "resort-lines": { type: "geojson", data: EMPTY_GEOJSON },
    structures: { type: "geojson", data: EMPTY_GEOJSON },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "rgba(7, 17, 30, 0)" },
    },
    {
      id: "satellite",
      type: "raster",
      source: "satellite",
      paint: {
        "raster-saturation": -0.22,
        "raster-contrast": 0.18,
        "raster-brightness-min": 0.04,
      },
    },
    {
      id: "terrain-shade",
      type: "hillshade",
      source: "terrain",
      paint: {
        "hillshade-shadow-color": "rgba(2, 10, 28, 0.88)",
        "hillshade-highlight-color": "rgba(231, 247, 255, 0.3)",
        "hillshade-accent-color": "rgba(31, 70, 112, 0.48)",
        "hillshade-illumination-direction": 310,
        "hillshade-exaggeration": 0.95,
      },
    },
    {
      id: "snow-cover",
      type: "color-relief",
      source: "terrain",
      paint: {
        "color-relief-color": [
          "interpolate",
          ["linear"],
          ["elevation"],
          0,
          "rgba(208,235,250,0)",
          1400,
          "rgba(218,241,255,0.32)",
          1750,
          "rgba(248,253,255,0.86)",
          2400,
          "rgba(255,255,255,0.94)",
        ],
      },
    },
    {
      id: "runs",
      type: "line",
      source: "resort-lines",
      filter: ["==", ["get", "kind"], "run"],
      paint: {
        "line-color": [
          "match",
          ["get", "subtype"],
          "easy",
          "#34d399",
          "intermediate",
          "#54a8ff",
          "advanced",
          "#f87171",
          "expert",
          "#111827",
          "#e5f4ff",
        ],
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.6, 15, 2.2],
        "line-opacity": 0.9,
      },
    },
    {
      id: "lifts",
      type: "line",
      source: "resort-lines",
      filter: ["==", ["get", "kind"], "lift"],
      paint: {
        "line-color": "#fbbf24",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.8, 15, 2.5],
        "line-opacity": 0.95,
      },
    },
    {
      id: "buildings",
      type: "fill-extrusion",
      source: "structures",
      filter: ["==", ["get", "kind"], "building"],
      paint: {
        "fill-extrusion-color": "#b8c7d6",
        "fill-extrusion-height": ["coalesce", ["get", "height"], 7],
        "fill-extrusion-base": 0,
        "fill-extrusion-opacity": 0.88,
      },
    },
    {
      id: "lift-towers",
      type: "fill-extrusion",
      source: "structures",
      filter: ["==", ["get", "kind"], "pylon"],
      paint: {
        "fill-extrusion-color": "#fbbf24",
        "fill-extrusion-height": ["coalesce", ["get", "height"], 14],
        "fill-extrusion-base": 0,
        "fill-extrusion-opacity": 0.95,
      },
    },
  ],
  terrain: { source: "terrain", exaggeration: 1.8 },
};

interface CurrentConditions {
  temperature: number;
  snowfall: number;
}

function snowRamp(resort: SnowResort) {
  const lower = Math.max(0, resort.baseElevation - 450);
  const foothills = Math.max(lower + 1, resort.baseElevation - 120);
  const summit = Math.max(foothills + 1, resort.summitElevation);
  const upper = Math.max(summit + 1, resort.topElevation + 220);
  return [
    "interpolate",
    ["linear"],
    ["elevation"],
    lower,
    "rgba(208,235,250,0)",
    foothills,
    "rgba(218,241,255,0.3)",
    summit,
    "rgba(248,253,255,0.88)",
    upper,
    "rgba(255,255,255,0.95)",
  ];
}

export default function HomeFallsCreekWidget() {
  const mapNodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [selected, setSelected] = useState(FEATURED_RESORTS[0]);
  const [mapReady, setMapReady] = useState(false);
  const [conditions, setConditions] = useState<CurrentConditions | null>(null);

  useEffect(() => {
    const node = mapNodeRef.current;
    if (!node) return;
    let disposed = false;
    let rotationTimer = 0;

    const observer = new IntersectionObserver(
      async entries => {
        if (!entries[0].isIntersecting || mapRef.current) return;
        observer.disconnect();
        const [maplibregl] = await Promise.all([
          import("maplibre-gl"),
          import("maplibre-gl/dist/maplibre-gl.css"),
        ]);
        if (disposed || !mapNodeRef.current) return;

        const map = new maplibregl.Map({
          container: mapNodeRef.current,
          style: structuredClone(HOME_MAP_STYLE),
          center: [selected.lon, selected.lat],
          zoom: selected.zoom - 0.7,
          pitch: 70,
          bearing: selected.bearing,
          interactive: false,
          attributionControl: false,
          canvasContextAttributes: { antialias: true },
        });
        mapRef.current = map;
        map.once("load", () => {
          if (disposed) return;
          setMapReady(true);
          rotationTimer = window.setInterval(() => {
            map.easeTo({
              bearing: map.getBearing() + 14,
              duration: 6500,
              essential: false,
            });
          }, 7200);
        });
      },
      { rootMargin: "200px" }
    );

    observer.observe(node);
    return () => {
      disposed = true;
      observer.disconnect();
      window.clearInterval(rotationTimer);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    map.easeTo({
      center: [selected.lon, selected.lat],
      zoom: selected.zoom - 0.7,
      pitch: 70,
      bearing: selected.bearing,
      duration: 1600,
      essential: true,
    });
    map.setPaintProperty(
      "snow-cover",
      "color-relief-color",
      snowRamp(selected)
    );
    (map.getSource("resort-lines") as GeoJSONSource).setData(
      `${selected.assetBase}/resort-lines.geojson`
    );
    (map.getSource("structures") as GeoJSONSource).setData(
      `${selected.assetBase}/structures.geojson`
    );
  }, [mapReady, selected]);

  useEffect(() => {
    if (!mapReady) return;
    const controller = new AbortController();
    setConditions(null);
    const params = new URLSearchParams({
      latitude: String(selected.lat),
      longitude: String(selected.lon),
      elevation: String(selected.summitElevation),
      current: "temperature_2m,snowfall",
      timezone: "auto",
    });
    fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      signal: controller.signal,
    })
      .then(response => {
        if (!response.ok) throw new Error("Forecast unavailable");
        return response.json() as Promise<{
          current: { temperature_2m: number; snowfall: number };
        }>;
      })
      .then(data => {
        setConditions({
          temperature: data.current.temperature_2m,
          snowfall: data.current.snowfall,
        });
      })
      .catch(error => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setConditions(null);
        }
      });
    return () => controller.abort();
  }, [mapReady, selected]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700 bg-[#09131f] shadow-inner">
      <div className="relative aspect-[1200/794] overflow-hidden bg-[#07111e]">
        <img
          src="/assets/falls-creek-3d-preview.webp"
          alt="Rendered Australian alpine terrain with illustrative snow cover"
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          ref={mapNodeRef}
          className={`absolute inset-0 transition-opacity duration-700 ${
            mapReady ? "opacity-100" : "opacity-0"
          }`}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#06101c]/15 via-transparent to-[#06101c]/90" />

        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-lg border border-white/15 bg-[#07101b]/85 px-2.5 py-2 text-white shadow-lg backdrop-blur-md">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-cyan-300/15 text-cyan-200">
            <MountainSnow size={15} />
          </span>
          <span>
            <span className="block font-mono text-[8px] uppercase tracking-[0.18em] text-cyan-300">
              Live 3D terrain
            </span>
            <span className="block text-xs font-semibold">{selected.name}</span>
          </span>
        </div>

        <div className="absolute right-3 top-3 rounded-lg border border-white/15 bg-[#07101b]/85 px-2.5 py-2 text-right font-mono text-[8px] uppercase tracking-[0.12em] text-slate-300 backdrop-blur-md">
          {conditions ? (
            <>
              <span className="block text-cyan-200">
                {Math.round(conditions.temperature)}° summit
              </span>
              <span className="mt-0.5 flex items-center justify-end gap-1 text-slate-400">
                <Snowflake size={9} /> {conditions.snowfall.toFixed(1)} cm/h
              </span>
            </>
          ) : (
            <span>Live forecast</span>
          )}
        </div>

        <div className="absolute inset-x-3 bottom-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {FEATURED_RESORTS.map(resort => (
              <button
                key={resort.slug}
                type="button"
                onClick={() => setSelected(resort)}
                aria-pressed={selected.slug === resort.slug}
                className={`rounded-md border px-2 py-1 font-mono text-[8px] uppercase tracking-[0.1em] backdrop-blur-md transition ${
                  selected.slug === resort.slug
                    ? "border-cyan-300/60 bg-cyan-300/20 text-cyan-100"
                    : "border-white/15 bg-[#07101b]/75 text-slate-300 hover:bg-white/15 hover:text-white"
                }`}
              >
                {resort.name}
              </button>
            ))}
          </div>
          <div className="flex items-end justify-between gap-3 text-white">
            <span>
              <span className="flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.16em] text-slate-400">
                <MapPinned size={10} /> {selected.region} · {selected.state}
              </span>
              <span className="mt-0.5 block text-sm font-semibold">
                {selected.baseElevation}–{selected.summitElevation} m
              </span>
            </span>
            <Link
              href="/snow"
              className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-100"
            >
              Open explorer <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-700 px-4 py-3">
        <p className="text-xs text-slate-400">
          16 Australian alpine areas · 168-hour forecasts
        </p>
        <Link
          href="/snow"
          className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-cyan-300 transition hover:text-cyan-100"
        >
          Explore all <ArrowUpRight size={15} />
        </Link>
      </div>
    </div>
  );
}
