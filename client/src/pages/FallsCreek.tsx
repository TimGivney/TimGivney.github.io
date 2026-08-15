import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import maplibregl, {
  type Map as MapLibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CloudRain,
  Eye,
  EyeOff,
  Gauge,
  Layers3,
  Maximize,
  MountainSnow,
  Pause,
  Play,
  RotateCw,
  Snowflake,
  Thermometer,
  Wind,
} from "lucide-react";

const FALLS_CREEK = {
  lat: -36.8702999,
  lon: 147.2737331,
  baseElevation: 1522,
  summitElevation: 1773,
  topElevation: 1873,
};

const HOURLY_FIELDS = [
  "temperature_2m",
  "apparent_temperature",
  "precipitation",
  "rain",
  "snowfall",
  "snow_depth",
  "freezing_level_height",
  "weather_code",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
].join(",");

interface ForecastResponse {
  hourly: {
    time: string[];
    temperature_2m: number[];
    apparent_temperature: number[];
    precipitation: number[];
    rain: number[];
    snowfall: number[];
    snow_depth: number[];
    freezing_level_height: number[];
    weather_code: number[];
    wind_speed_10m: number[];
    wind_direction_10m: number[];
    wind_gusts_10m: number[];
  };
}

interface ForecastHour {
  time: string;
  summitTemp: number;
  baseTemp: number;
  feelsLike: number;
  precipitation: number;
  rain: number;
  snowfall: number;
  summitDepth: number;
  baseDepth: number;
  freezingLevel: number;
  snowLine: number;
  sleetLine: number;
  weatherCode: number;
  windSpeed: number;
  windDirection: number;
  windGust: number;
}

type SnowMode = "coverage" | "hourly" | "accum";

const MAP_STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
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
      attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics",
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#0c1723" },
    },
    {
      id: "satellite",
      type: "raster",
      source: "satellite",
      paint: {
        "raster-opacity": 1,
        "raster-saturation": -0.08,
        "raster-contrast": 0.12,
        "raster-brightness-min": 0.05,
      },
    },
    {
      id: "depth-shade",
      type: "hillshade",
      source: "terrain",
      paint: {
        "hillshade-shadow-color": "rgba(2, 10, 28, 0.82)",
        "hillshade-highlight-color": "rgba(224, 243, 255, 0.22)",
        "hillshade-accent-color": "rgba(37, 73, 112, 0.48)",
        "hillshade-illumination-direction": 310,
        "hillshade-exaggeration": 0.95,
      },
    },
    {
      id: "snow-forecast",
      type: "color-relief",
      source: "terrain",
      paint: {
        "color-relief-color": [
          "interpolate",
          ["linear"],
          ["elevation"],
          0,
          "rgba(255,255,255,0)",
          2200,
          "rgba(255,255,255,0)",
        ],
      },
    },
  ],
  terrain: { source: "terrain", exaggeration: 1.8 },
};

function forecastUrl(elevation: number) {
  const params = new URLSearchParams({
    latitude: String(FALLS_CREEK.lat),
    longitude: String(FALLS_CREEK.lon),
    elevation: String(elevation),
    hourly: HOURLY_FIELDS,
    forecast_hours: "168",
    timezone: "Australia/Melbourne",
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

function formatHour(iso: string, compact = false) {
  const [datePart, timePart] = iso.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const hour = Number(timePart.slice(0, 2));
  const clockHour = hour % 12 || 12;
  const clock = `${clockHour}${hour >= 12 ? "pm" : "am"}`;
  if (compact) return clock;
  const weekday = new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
  const monthLabel = new Intl.DateTimeFormat("en-AU", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
  return `${weekday} ${day} ${monthLabel} · ${clock}`;
}

function cardinal(degrees: number) {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(degrees / 45) % 8];
}

function weatherLabel(code: number) {
  if (code >= 95) return "Thunderstorms";
  if (code >= 85) return "Snow showers";
  if (code >= 71) return "Snow";
  if (code >= 61) return "Rain";
  if (code >= 51) return "Drizzle";
  if (code >= 45) return "Fog";
  if (code >= 3) return "Overcast";
  if (code >= 1) return "Cloudy";
  return "Clear";
}

function alpha(value: number) {
  return Math.max(0, Math.min(0.88, value));
}

function snowRamp(hour: ForecastHour, mode: SnowMode, accumulated: number) {
  if (mode === "coverage") {
    const baseAlpha = alpha(hour.baseDepth / 45);
    const summitAlpha = alpha(hour.summitDepth / 60);
    return [
      "interpolate",
      ["linear"],
      ["elevation"],
      1200,
      "rgba(215,235,250,0)",
      FALLS_CREEK.baseElevation - 80,
      `rgba(205,229,247,${baseAlpha * 0.2})`,
      FALLS_CREEK.baseElevation,
      `rgba(220,240,253,${baseAlpha * 0.68})`,
      FALLS_CREEK.summitElevation,
      `rgba(247,252,255,${summitAlpha})`,
      2200,
      `rgba(255,255,255,${summitAlpha})`,
    ];
  }

  const amount = mode === "hourly" ? hour.snowfall : accumulated;
  const strength = alpha(0.1 + amount / (mode === "hourly" ? 2.5 : 18));
  const snowLine = Math.max(900, Math.min(2100, hour.snowLine));
  const lower = Math.max(700, snowLine - 220);
  return [
    "interpolate",
    ["linear"],
    ["elevation"],
    0,
    "rgba(170,205,230,0)",
    lower,
    "rgba(170,205,230,0)",
    snowLine,
    `rgba(190,226,250,${strength * 0.32})`,
    Math.max(snowLine + 1, FALLS_CREEK.summitElevation),
    `rgba(242,250,255,${strength})`,
    2200,
    `rgba(255,255,255,${strength})`,
  ];
}

export default function FallsCreek() {
  const pageRef = useRef<HTMLDivElement>(null);
  const mapNodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const playingTimerRef = useRef<number | null>(null);

  const [forecast, setForecast] = useState<ForecastHour[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<SnowMode>("coverage");
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [uiHidden, setUiHidden] = useState(false);
  const [is3D, setIs3D] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);

  const selected = forecast[selectedIndex] ?? null;
  const accumulated = useMemo(
    () =>
      forecast
        .slice(0, selectedIndex + 1)
        .reduce((sum, hour) => sum + hour.snowfall, 0),
    [forecast, selectedIndex]
  );
  const sevenDaySnow = useMemo(
    () => forecast.reduce((sum, hour) => sum + hour.snowfall, 0),
    [forecast]
  );

  useEffect(() => {
    document.title = "Falls Creek Snow Map — Tim Givney";
    return () => {
      document.title = "Tim Givney — Mechanical Engineer";
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch(forecastUrl(FALLS_CREEK.summitElevation), {
        signal: controller.signal,
      }).then(response => {
        if (!response.ok) throw new Error("Summit forecast unavailable");
        return response.json() as Promise<ForecastResponse>;
      }),
      fetch(forecastUrl(FALLS_CREEK.baseElevation), {
        signal: controller.signal,
      }).then(response => {
        if (!response.ok) throw new Error("Base forecast unavailable");
        return response.json() as Promise<ForecastResponse>;
      }),
    ])
      .then(([summit, base]) => {
        const rows = summit.hourly.time.map((time, index) => {
          const freezingLevel = summit.hourly.freezing_level_height[index] ?? 0;
          return {
            time,
            summitTemp: summit.hourly.temperature_2m[index] ?? 0,
            baseTemp: base.hourly.temperature_2m[index] ?? 0,
            feelsLike: summit.hourly.apparent_temperature[index] ?? 0,
            precipitation: summit.hourly.precipitation[index] ?? 0,
            rain: summit.hourly.rain[index] ?? 0,
            snowfall: summit.hourly.snowfall[index] ?? 0,
            summitDepth: (summit.hourly.snow_depth[index] ?? 0) * 100,
            baseDepth: (base.hourly.snow_depth[index] ?? 0) * 100,
            freezingLevel,
            snowLine: freezingLevel - 280,
            sleetLine: freezingLevel - 430,
            weatherCode: summit.hourly.weather_code[index] ?? 0,
            windSpeed: summit.hourly.wind_speed_10m[index] ?? 0,
            windDirection: summit.hourly.wind_direction_10m[index] ?? 0,
            windGust: summit.hourly.wind_gusts_10m[index] ?? 0,
          } satisfies ForecastHour;
        });
        setForecast(rows);
        setForecastError(null);
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setForecastError("Open-Meteo forecast is temporarily unavailable.");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapNodeRef.current,
      style: MAP_STYLE,
      center: [FALLS_CREEK.lon, FALLS_CREEK.lat],
      zoom: 13,
      pitch: 52,
      bearing: 0,
      maxPitch: 85,
      minZoom: 9,
      maxZoom: 16.5,
      canvasContextAttributes: { antialias: true },
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      "top-right"
    );
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right"
    );

    map.on("load", async () => {
      try {
        const [lineResponse, structureResponse] = await Promise.all([
          fetch("/falls-creek/resort-lines.geojson"),
          fetch("/falls-creek/structures.geojson"),
        ]);
        if (!lineResponse.ok) throw new Error("Resort line data unavailable");
        const data = await lineResponse.json();
        map.addSource("resort-lines", { type: "geojson", data });

        if (structureResponse.ok) {
          const structures = await structureResponse.json();
          map.addSource("resort-structures", {
            type: "geojson",
            data: structures,
          });
          map.addLayer({
            id: "buildings-3d",
            type: "fill-extrusion",
            source: "resort-structures",
            minzoom: 11.7,
            filter: ["==", ["get", "kind"], "building"],
            paint: {
              "fill-extrusion-color": [
                "interpolate",
                ["linear"],
                ["get", "height"],
                3,
                "#71818b",
                18,
                "#dce6eb",
                35,
                "#f2f7f9",
              ],
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": 0,
              "fill-extrusion-opacity": 0.86,
              "fill-extrusion-vertical-gradient": true,
            },
          });
          map.addLayer({
            id: "lift-towers-3d",
            type: "fill-extrusion",
            source: "resort-structures",
            minzoom: 11.4,
            filter: ["==", ["get", "kind"], "pylon"],
            paint: {
              "fill-extrusion-color": "#ef4b43",
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": 0,
              "fill-extrusion-opacity": 0.94,
              "fill-extrusion-vertical-gradient": true,
            },
          });
          map.addLayer({
            id: "elevation-markers-3d",
            type: "fill-extrusion",
            source: "resort-structures",
            filter: ["==", ["get", "kind"], "marker"],
            paint: {
              "fill-extrusion-color": "#70ddff",
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": 0,
              "fill-extrusion-opacity": 0.9,
            },
          });
          map.addLayer({
            id: "elevation-marker-labels",
            type: "symbol",
            source: "resort-structures",
            filter: ["==", ["get", "kind"], "marker"],
            layout: {
              "text-field": ["get", "name"],
              "text-size": 11,
              "text-font": ["Open Sans Regular"],
              "text-offset": [0, 1.2],
              "text-anchor": "top",
            },
            paint: {
              "text-color": "#dff8ff",
              "text-halo-color": "rgba(4,11,20,0.95)",
              "text-halo-width": 1.8,
            },
          });
        }

        map.addLayer({
          id: "runs-shadow",
          type: "line",
          source: "resort-lines",
          filter: ["==", ["get", "kind"], "run"],
          paint: {
            "line-color": "rgba(4,10,18,0.75)",
            "line-width": ["interpolate", ["linear"], ["zoom"], 11, 1, 15, 4],
            "line-blur": 1.2,
          },
        });
        map.addLayer({
          id: "runs",
          type: "line",
          source: "resort-lines",
          filter: ["==", ["get", "kind"], "run"],
          paint: {
            "line-color": [
              "match",
              ["get", "subtype"],
              "novice",
              "#69d48a",
              "easy",
              "#69d48a",
              "intermediate",
              "#4ea3ff",
              "advanced",
              "#191d28",
              "expert",
              "#db3545",
              "#e5edf4",
            ],
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              11,
              0.8,
              15,
              2.5,
            ],
            "line-opacity": 0.88,
          },
        });
        map.addLayer({
          id: "lifts-shadow",
          type: "line",
          source: "resort-lines",
          filter: ["==", ["get", "kind"], "lift"],
          paint: {
            "line-color": "#10151d",
            "line-width": ["interpolate", ["linear"], ["zoom"], 11, 3, 15, 7],
          },
        });
        map.addLayer({
          id: "lifts",
          type: "line",
          source: "resort-lines",
          filter: ["==", ["get", "kind"], "lift"],
          paint: {
            "line-color": "#f2493e",
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              11,
              1.4,
              15,
              3.5,
            ],
          },
        });
        map.addLayer({
          id: "lift-labels",
          type: "symbol",
          source: "resort-lines",
          filter: ["==", ["get", "kind"], "lift"],
          layout: {
            "symbol-placement": "line-center",
            "text-field": ["get", "name"],
            "text-size": 11,
            "text-font": ["Open Sans Regular"],
            "text-allow-overlap": false,
          },
          paint: {
            "text-color": "#ffffff",
            "text-halo-color": "rgba(5,10,16,0.92)",
            "text-halo-width": 1.6,
          },
        });

        const showFeature = (event: maplibregl.MapLayerMouseEvent) => {
          const feature = event.features?.[0];
          if (!feature) return;
          const kind = feature.properties?.kind === "lift" ? "Lift" : "Ski run";
          const popup = document.createElement("div");
          const name = document.createElement("strong");
          const detail = document.createElement("div");
          name.textContent = feature.properties?.name ?? kind;
          detail.textContent = kind;
          detail.style.opacity = "0.65";
          popup.append(name, detail);
          new maplibregl.Popup({ closeButton: false, offset: 12 })
            .setLngLat(event.lngLat)
            .setDOMContent(popup)
            .addTo(map);
        };
        map.on("click", "lifts", showFeature);
        map.on("click", "runs", showFeature);
        for (const layer of ["lifts", "runs"]) {
          map.on("mouseenter", layer, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", layer, () => {
            map.getCanvas().style.cursor = "";
          });
        }
      } catch {
        // The terrain and forecast remain useful if optional OSM linework fails.
      }
      setMapReady(true);
      map.easeTo({
        pitch: 76,
        bearing: -28,
        zoom: 13.35,
        duration: 1800,
        essential: true,
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !selected || !map.getLayer("snow-forecast"))
      return;
    map.setPaintProperty(
      "snow-forecast",
      "color-relief-color",
      snowRamp(selected, mode, accumulated)
    );
  }, [selected, mode, accumulated, mapReady]);

  useEffect(() => {
    if (!playing || forecast.length === 0) return;
    playingTimerRef.current = window.setInterval(() => {
      setSelectedIndex(index => (index + 1) % forecast.length);
    }, 900 / speed);
    return () => {
      if (playingTimerRef.current !== null) {
        window.clearInterval(playingTimerRef.current);
      }
    };
  }, [playing, speed, forecast.length]);

  useEffect(() => {
    const controls = mapRef.current
      ?.getContainer()
      .querySelectorAll<HTMLElement>(".maplibregl-ctrl");
    controls?.forEach(control => {
      control.style.display = uiHidden ? "none" : "";
    });
  }, [uiHidden, mapReady]);

  useEffect(() => {
    if (!autoRotate) return;
    let frame = 0;
    const rotate = () => {
      const map = mapRef.current;
      if (map && !map.isMoving()) map.setBearing(map.getBearing() + 0.035);
      frame = requestAnimationFrame(rotate);
    };
    frame = requestAnimationFrame(rotate);
    return () => cancelAnimationFrame(frame);
  }, [autoRotate]);

  const selectRelative = useCallback(
    (delta: number) => {
      if (!forecast.length) return;
      setSelectedIndex(index =>
        Math.max(0, Math.min(forecast.length - 1, index + delta))
      );
    },
    [forecast.length]
  );

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await pageRef.current?.requestFullscreen();
    window.setTimeout(() => mapRef.current?.resize(), 100);
  }, []);

  const toggle3D = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const next = !is3D;
    setIs3D(next);
    map.setTerrain(next ? { source: "terrain", exaggeration: 1.8 } : null);
    for (const layer of [
      "buildings-3d",
      "lift-towers-3d",
      "elevation-markers-3d",
      "elevation-marker-labels",
    ]) {
      if (map.getLayer(layer)) {
        map.setLayoutProperty(layer, "visibility", next ? "visible" : "none");
      }
    }
    map.easeTo({
      pitch: next ? 76 : 0,
      bearing: next ? -28 : 0,
      zoom: next ? 13.35 : 13,
      duration: 1200,
      essential: true,
    });
  }, [is3D]);

  const graphPoints = useMemo(() => {
    if (!forecast.length) return "";
    const min = 700;
    const max = 3000;
    return forecast
      .map((hour, index) => {
        const x = (index / Math.max(1, forecast.length - 1)) * 1000;
        const y = 120 - ((hour.freezingLevel - min) / (max - min)) * 100;
        return `${x},${Math.max(8, Math.min(118, y))}`;
      })
      .join(" ");
  }, [forecast]);

  return (
    <div
      ref={pageRef}
      className="relative h-[100dvh] w-full overflow-hidden bg-[#0a111a] text-white"
    >
      <div className="absolute inset-0">
        <div
          ref={mapNodeRef}
          className="h-full w-full"
          aria-label="Falls Creek 3D snow map"
        />
      </div>

      {!mapReady && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-[#0a111a]">
          <div className="text-center font-mono text-xs uppercase tracking-[0.22em] text-slate-400">
            <MountainSnow
              className="mx-auto mb-4 animate-pulse text-cyan-300"
              size={34}
            />
            Loading alpine terrain
          </div>
        </div>
      )}

      {!uiHidden && (
        <>
          <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 md:p-5">
            <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-white/15 bg-[#07101b]/88 p-1.5 shadow-2xl backdrop-blur-xl">
              <Link
                href="/"
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white"
                aria-label="Back to homepage"
              >
                <ArrowLeft size={17} />
              </Link>
              <div className="border-l border-white/10 px-3 py-1">
                <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-cyan-300">
                  Victorian Alps · interactive 3D terrain
                </p>
                <h1 className="text-base font-semibold leading-tight md:text-lg">
                  Falls Creek
                </h1>
              </div>
            </div>

            <div className="pointer-events-auto flex gap-2 pr-11 md:pr-12">
              <button
                onClick={() => setAutoRotate(value => !value)}
                className={`grid h-10 w-10 place-items-center rounded-xl border backdrop-blur-xl transition ${
                  autoRotate
                    ? "border-cyan-300/60 bg-cyan-300/20 text-cyan-100"
                    : "border-white/15 bg-[#07101b]/88 text-slate-300 hover:bg-white/10"
                }`}
                title="Auto-rotate map"
              >
                <RotateCw size={16} />
              </button>
              <button
                onClick={toggleFullscreen}
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-[#07101b]/88 text-slate-300 backdrop-blur-xl transition hover:bg-white/10 hover:text-white"
                title="Fullscreen"
              >
                <Maximize size={16} />
              </button>
              <button
                onClick={() => setUiHidden(true)}
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-[#07101b]/88 text-slate-300 backdrop-blur-xl transition hover:bg-white/10 hover:text-white"
                title="Hide interface"
              >
                <EyeOff size={16} />
              </button>
            </div>
          </header>

          <div className="absolute left-3 top-[76px] z-20 md:left-5 md:top-[88px]">
            <div className="flex rounded-xl border border-white/15 bg-[#07101b]/88 p-1 shadow-2xl backdrop-blur-xl">
              {(
                [
                  ["coverage", "Coverage"],
                  ["hourly", "Hourly"],
                  ["accum", "Accum."],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setMode(value)}
                  className={`rounded-lg px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] transition md:px-4 ${
                    mode === value
                      ? "bg-white text-slate-950"
                      : "text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                onClick={toggle3D}
                aria-pressed={is3D}
                className={`flex items-center gap-1.5 rounded-lg border-l border-white/10 px-2.5 py-2 font-mono text-[10px] uppercase tracking-[0.12em] transition md:px-3 ${
                  is3D
                    ? "bg-cyan-300/20 text-cyan-100"
                    : "text-slate-300 hover:bg-white/10"
                }`}
                title="Toggle between 3D terrain and a flat map"
              >
                <Layers3 size={12} /> 3D
              </button>
            </div>
            <p className="mt-2 hidden rounded-lg bg-[#07101b]/72 px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.14em] text-slate-400 backdrop-blur md:block">
              1.8× terrain relief · 146 buildings · 85 lift towers
            </p>
          </div>

          {forecastError && !selected && (
            <div className="absolute left-3 top-[132px] z-20 max-w-xs rounded-xl border border-amber-300/25 bg-[#15120b]/92 p-3 text-xs text-amber-100 shadow-2xl backdrop-blur-xl md:left-5">
              {forecastError} The 3D terrain and resort map are still available.
            </div>
          )}

          {selected && (
            <aside className="absolute bottom-[126px] left-3 z-20 w-[min(19rem,calc(100%-1.5rem))] rounded-2xl border border-white/15 bg-[#07101b]/90 p-4 shadow-2xl backdrop-blur-xl md:bottom-36 md:left-5 md:w-[20rem]">
              <div className="mb-3 flex items-start justify-between gap-4 border-b border-white/10 pb-3">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-300">
                    Selected forecast hour
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatHour(selected.time)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {weatherLabel(selected.weatherCode)}
                  </p>
                </div>
                <Snowflake className="mt-1 text-cyan-200" size={22} />
              </div>

              <div className="grid grid-cols-2 gap-x-5 gap-y-2.5 text-xs">
                <Metric
                  icon={<Thermometer size={13} />}
                  label="Summit"
                  value={`${selected.summitTemp.toFixed(1)}°C`}
                />
                <Metric
                  icon={<Gauge size={13} />}
                  label="Feels like"
                  value={`${selected.feelsLike.toFixed(1)}°C`}
                />
                <Metric
                  icon={<MountainSnow size={13} />}
                  label="Snow line"
                  value={`${Math.round(selected.snowLine)} m`}
                />
                <Metric
                  icon={<Layers3 size={13} />}
                  label="Snow depth"
                  value={`${selected.summitDepth.toFixed(0)} cm`}
                />
                <Metric
                  icon={<Snowflake size={13} />}
                  label={mode === "accum" ? "Accum. snow" : "Snowfall (1h)"}
                  value={`${(mode === "accum" ? accumulated : selected.snowfall).toFixed(1)} cm`}
                />
                <Metric
                  icon={<CloudRain size={13} />}
                  label="Rain (1h)"
                  value={`${selected.rain.toFixed(1)} mm`}
                />
                <div className="col-span-2">
                  <Metric
                    icon={<Wind size={13} />}
                    label="Summit wind"
                    value={`${selected.windSpeed.toFixed(0)} km/h ${cardinal(selected.windDirection)} · gust ${selected.windGust.toFixed(0)}`}
                  />
                </div>
              </div>
              {forecastError && (
                <p className="mt-3 border-t border-white/10 pt-3 text-xs text-amber-200">
                  {forecastError}
                </p>
              )}
            </aside>
          )}

          <section className="absolute inset-x-3 bottom-3 z-20 rounded-2xl border border-white/15 bg-[#07101b]/92 p-3 shadow-2xl backdrop-blur-xl md:inset-x-5 md:bottom-5 md:px-5 md:py-4">
            <div className="pointer-events-none absolute inset-x-14 top-1 h-[42px] opacity-65 md:inset-x-28 md:top-2 md:h-[52px]">
              <svg
                viewBox="0 0 1000 130"
                preserveAspectRatio="none"
                className="h-full w-full"
              >
                <line
                  x1="0"
                  x2="1000"
                  y1="84"
                  y2="84"
                  stroke="rgba(255,255,255,.13)"
                  strokeDasharray="7 8"
                />
                <line
                  x1="0"
                  x2="1000"
                  y1="73"
                  y2="73"
                  stroke="rgba(103,232,249,.22)"
                />
                <polyline
                  points={graphPoints}
                  fill="none"
                  stroke="#8bdcff"
                  strokeWidth="4"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>

            <div className="relative flex items-center gap-2 md:gap-4">
              <button
                onClick={() => setPlaying(value => !value)}
                disabled={!forecast.length}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-slate-950 transition hover:scale-105 disabled:opacity-40"
              >
                {playing ? (
                  <Pause size={16} fill="currentColor" />
                ) : (
                  <Play size={16} fill="currentColor" />
                )}
              </button>
              <button
                onClick={() => selectRelative(-1)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-300 hover:bg-white/10"
                aria-label="Previous hour"
              >
                <ChevronLeft size={18} />
              </button>
              <input
                type="range"
                min={0}
                max={Math.max(0, forecast.length - 1)}
                value={selectedIndex}
                onChange={event => setSelectedIndex(Number(event.target.value))}
                className="relative z-10 h-1 min-w-0 flex-1 cursor-pointer accent-cyan-300"
                aria-label="Forecast hour"
              />
              <button
                onClick={() => selectRelative(1)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-300 hover:bg-white/10"
                aria-label="Next hour"
              >
                <ChevronRight size={18} />
              </button>
              <button
                onClick={() =>
                  setSpeed(value => (value === 1 ? 3 : value === 3 ? 6 : 1))
                }
                className="hidden h-8 min-w-10 rounded-lg border border-white/15 px-2 font-mono text-[10px] text-slate-300 hover:bg-white/10 sm:block"
              >
                {speed}×
              </button>
              <div className="hidden w-32 text-right md:block">
                <p className="text-xs font-semibold">
                  {selected ? formatHour(selected.time) : "Loading…"}
                </p>
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">
                  {sevenDaySnow.toFixed(1)} cm / 7 days
                </p>
              </div>
            </div>
          </section>

          <div className="absolute bottom-[102px] right-3 z-10 max-w-[calc(100%-1.5rem)] rounded-lg bg-[#07101b]/78 px-2.5 py-1.5 text-right font-mono text-[7px] leading-relaxed text-slate-400 backdrop-blur md:bottom-[108px] md:right-5 md:text-[9px]">
            Current forecast over 3D DEM terrain · archived satellite mosaic ·
            Weather: Open-Meteo · imagery: Esri · DEM: Mapterhorn ·
            structures/trails: © OpenStreetMap contributors
          </div>
        </>
      )}

      {uiHidden && (
        <button
          onClick={() => setUiHidden(false)}
          className="absolute right-4 top-4 z-30 grid h-11 w-11 place-items-center rounded-xl border border-white/20 bg-[#07101b]/85 text-white backdrop-blur-xl"
          title="Show interface"
        >
          <Eye size={17} />
        </button>
      )}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-slate-400">
        <span className="text-cyan-300">{icon}</span>
        {label}
      </span>
      <strong className="whitespace-nowrap font-mono text-[11px] font-medium text-slate-100">
        {value}
      </strong>
    </div>
  );
}
