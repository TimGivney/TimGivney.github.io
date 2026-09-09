import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import maplibregl, {
  type Map as MapLibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CloudRain,
  Eye,
  EyeOff,
  Gauge,
  Layers3,
  MapPinned,
  Maximize,
  MountainSnow,
  Pause,
  Play,
  RotateCw,
  Search,
  Snowflake,
  Thermometer,
  Wind,
} from "lucide-react";
import {
  AUSTRALIAN_SNOW_RESORTS,
  POWDER_RESORTS,
  SNOW_RESORTS,
  findSnowResort,
  type ResortContinent,
  type SnowResort,
} from "@/lib/snowResorts";

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

type ResortProperties = Record<
  string,
  string | number | boolean | null | undefined
>;
type Position = [number, number];

interface ResortFeature<Geometry> {
  type: "Feature";
  id?: string | number;
  properties: ResortProperties;
  geometry: Geometry;
}

interface ResortFeatureCollection<Geometry> {
  type: "FeatureCollection";
  features: Array<ResortFeature<Geometry>>;
}

interface ResortLineGeometry {
  type: "LineString";
  coordinates: Position[];
}

interface ResortPolygonGeometry {
  type: "Polygon";
  coordinates: Position[][];
}

interface ResortPointGeometry {
  type: "Point";
  coordinates: Position;
}

function getFallbackMarkerPoints(
  structures: ResortFeatureCollection<ResortPolygonGeometry>,
  hasFeaturedLine: boolean
): ResortFeatureCollection<ResortPointGeometry> {
  if (hasFeaturedLine) {
    return { type: "FeatureCollection", features: [] };
  }

  const markers = structures.features.filter(
    feature =>
      feature.properties?.kind === "marker" &&
      feature.properties.markerType === "featured-run"
  );
  const fallbackMarkers = markers.length
    ? markers
    : structures.features
        .filter(
          feature =>
            feature.properties?.kind === "marker" &&
            feature.properties.markerType === "summit"
        )
        .slice(0, 1);

  return {
    type: "FeatureCollection",
    features: fallbackMarkers.flatMap(feature => {
      const ring = feature.geometry.coordinates[0];
      if (!ring?.length) return [];
      const [longitude, latitude] = ring.reduce<[number, number]>(
        (total, coordinate) => [
          total[0] + coordinate[0],
          total[1] + coordinate[1],
        ],
        [0, 0]
      );
      return [
        {
          type: "Feature" as const,
          id: feature.id,
          properties: feature.properties,
          geometry: {
            type: "Point" as const,
            coordinates: [longitude / ring.length, latitude / ring.length],
          },
        },
      ];
    }),
  };
}

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
}

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

function forecastUrl(resort: SnowResort, elevation: number) {
  const params = new URLSearchParams({
    latitude: String(resort.lat),
    longitude: String(resort.lon),
    elevation: String(elevation),
    hourly: HOURLY_FIELDS,
    forecast_hours: "168",
    timezone: "auto",
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

function snowRamp(
  resort: SnowResort,
  hour: ForecastHour,
  mode: SnowMode,
  accumulated: number,
  illustrativeCover: boolean
) {
  if (mode === "coverage") {
    const lowerElevation = Math.max(0, resort.baseElevation - 450);
    const baseApproach = Math.max(
      lowerElevation + 1,
      resort.baseElevation - 100
    );
    const baseStop = Math.max(baseApproach + 1, resort.baseElevation);
    const summitStop = Math.max(baseStop + 1, resort.summitElevation);
    const upperElevation = Math.max(summitStop + 1, resort.topElevation + 180);
    const baseAlpha =
      hour.baseDepth > 0.1
        ? alpha(0.18 + hour.baseDepth / 42)
        : illustrativeCover
          ? 0.5
          : 0;
    const summitAlpha =
      hour.summitDepth > 0.1
        ? alpha(0.28 + hour.summitDepth / 46)
        : illustrativeCover
          ? 0.82
          : 0;
    return [
      "interpolate",
      ["linear"],
      ["elevation"],
      lowerElevation,
      "rgba(215,235,250,0)",
      baseApproach,
      `rgba(190,219,239,${baseAlpha * 0.16})`,
      baseStop,
      `rgba(218,239,252,${baseAlpha * 0.74})`,
      summitStop,
      `rgba(248,253,255,${summitAlpha})`,
      upperElevation,
      `rgba(255,255,255,${summitAlpha})`,
    ];
  }

  const amount = mode === "hourly" ? hour.snowfall : accumulated;
  const strength = alpha(0.1 + amount / (mode === "hourly" ? 2.5 : 18));
  const snowLine = Math.max(
    resort.baseElevation - 500,
    Math.min(resort.topElevation + 500, hour.snowLine)
  );
  const lower = Math.max(1, snowLine - 220);
  const snowStart = Math.max(lower + 1, snowLine);
  const summitStop = Math.max(snowStart + 1, resort.summitElevation);
  const upperStop = Math.max(summitStop + 1, resort.topElevation + 300);
  return [
    "interpolate",
    ["linear"],
    ["elevation"],
    0,
    "rgba(170,205,230,0)",
    lower,
    "rgba(170,205,230,0)",
    snowStart,
    `rgba(190,226,250,${strength * 0.32})`,
    summitStop,
    `rgba(242,250,255,${strength})`,
    upperStop,
    `rgba(255,255,255,${strength})`,
  ];
}

export default function FallsCreek() {
  const pageRef = useRef<HTMLDivElement>(null);
  const mapNodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const playingTimerRef = useRef<number | null>(null);

  const [resort, setResort] = useState(() =>
    findSnowResort(new URLSearchParams(window.location.search).get("resort"))
  );
  const [resortPickerOpen, setResortPickerOpen] = useState(false);
  const [forecast, setForecast] = useState<ForecastHour[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<SnowMode>("coverage");
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [uiHidden, setUiHidden] = useState(false);
  const [snowSceneEnabled, setSnowSceneEnabled] = useState(true);
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
  const snowIntensity = useMemo(() => {
    if (!selected) return 0;
    const weatherBoost =
      selected.weatherCode >= 71 && selected.weatherCode <= 86 ? 0.16 : 0;
    const forecastIntensity = Math.min(
      1,
      selected.snowfall / 1.4 + weatherBoost
    );
    return forecastIntensity > 0
      ? forecastIntensity
      : mode === "coverage" && snowSceneEnabled
        ? 0.13
        : 0;
  }, [mode, selected, snowSceneEnabled]);

  useEffect(() => {
    document.title = `${resort.name} Snow Map — Tim Givney`;
    return () => {
      document.title = "Tim Givney — Mechanical Engineer";
    };
  }, [resort.name]);

  useEffect(() => {
    const syncResortFromUrl = () => {
      setResort(
        findSnowResort(
          new URLSearchParams(window.location.search).get("resort")
        )
      );
    };
    window.addEventListener("popstate", syncResortFromUrl);
    return () => window.removeEventListener("popstate", syncResortFromUrl);
  }, []);

  useEffect(() => {
    setPlaying(false);
    setSelectedIndex(0);
    setForecast([]);
    setForecastError(null);
    setMapReady(false);
    setIs3D(true);
  }, [resort.slug]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch(forecastUrl(resort, resort.summitElevation), {
        signal: controller.signal,
      }).then(response => {
        if (!response.ok) throw new Error("Summit forecast unavailable");
        return response.json() as Promise<ForecastResponse>;
      }),
      fetch(forecastUrl(resort, resort.baseElevation), {
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
  }, [resort]);

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return;
    const assetController = new AbortController();
    let disposed = false;
    const map = new maplibregl.Map({
      container: mapNodeRef.current,
      style: structuredClone(MAP_STYLE),
      center: [resort.lon, resort.lat],
      zoom: resort.zoom - 0.35,
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
          fetch(`${resort.assetBase}/resort-lines.geojson`, {
            signal: assetController.signal,
          }),
          fetch(`${resort.assetBase}/structures.geojson`, {
            signal: assetController.signal,
          }),
        ]);
        if (disposed) return;
        if (!lineResponse.ok) throw new Error("Resort line data unavailable");
        const data =
          (await lineResponse.json()) as ResortFeatureCollection<ResortLineGeometry>;
        map.addSource("resort-lines", { type: "geojson", data });

        if (structureResponse.ok) {
          const structures =
            (await structureResponse.json()) as ResortFeatureCollection<ResortPolygonGeometry>;
          map.addSource("resort-structures", {
            type: "geojson",
            data: structures,
          });
          const fallbackMarkerPoints = getFallbackMarkerPoints(
            structures,
            data.features.some(feature => feature.properties?.featured === true)
          );
          if (fallbackMarkerPoints.features.length) {
            map.addSource("fallback-marker-points", {
              type: "geojson",
              data: fallbackMarkerPoints,
            });
            map.addLayer({
              id: "fallback-marker-point",
              type: "circle",
              source: "fallback-marker-points",
              paint: {
                "circle-radius": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  9,
                  5,
                  14,
                  8,
                ],
                "circle-color": "#ffd166",
                "circle-stroke-color": "rgba(5,10,16,0.96)",
                "circle-stroke-width": 2,
              },
            });
            map.addLayer({
              id: "fallback-marker-label",
              type: "symbol",
              source: "fallback-marker-points",
              layout: {
                "text-field": ["get", "name"],
                "text-size": 12,
                "text-font": ["Open Sans Regular"],
                "text-offset": [0, -1.4],
                "text-anchor": "bottom",
                "text-allow-overlap": true,
                "text-ignore-placement": true,
              },
              paint: {
                "text-color": "#fff3c4",
                "text-halo-color": "rgba(5,10,16,0.96)",
                "text-halo-width": 2,
              },
            });
          }
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
          id: "powder-run",
          type: "line",
          source: "resort-lines",
          filter: ["==", ["get", "featured"], true],
          paint: {
            "line-color": "#ffd166",
            "line-width": ["interpolate", ["linear"], ["zoom"], 11, 2.5, 15, 6],
            "line-opacity": 0.96,
          },
        });
        map.addLayer({
          id: "powder-run-label",
          type: "symbol",
          source: "resort-lines",
          filter: ["==", ["get", "featured"], true],
          layout: {
            "symbol-placement": "line-center",
            "text-field": ["concat", "Powder · ", ["get", "name"]],
            "text-size": 11,
            "text-font": ["Open Sans Regular"],
          },
          paint: {
            "text-color": "#fff3c4",
            "text-halo-color": "rgba(5,10,16,0.96)",
            "text-halo-width": 1.8,
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
          popup.style.color = "#07101b";
          name.textContent = feature.properties?.name ?? kind;
          detail.textContent = kind;
          detail.style.color = "#526071";
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
      if (disposed) return;
      setMapReady(true);
      map.easeTo({
        pitch: 76,
        bearing: resort.bearing,
        zoom: resort.zoom,
        duration: 1800,
        essential: true,
      });
    });

    return () => {
      disposed = true;
      assetController.abort();
      map.remove();
      mapRef.current = null;
    };
  }, [resort]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !selected || !map.getLayer("snow-forecast"))
      return;
    map.setPaintProperty(
      "snow-forecast",
      "color-relief-color",
      snowRamp(resort, selected, mode, accumulated, snowSceneEnabled)
    );
  }, [resort, selected, mode, accumulated, mapReady, snowSceneEnabled]);

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

  const selectResort = useCallback(
    (nextResort: SnowResort) => {
      setResortPickerOpen(false);
      if (nextResort.slug === resort.slug) return;
      setPlaying(false);
      setSelectedIndex(0);
      setForecast([]);
      setForecastError(null);
      setMapReady(false);
      setIs3D(true);
      setResort(nextResort);
      window.history.pushState(
        null,
        "",
        `/snow?resort=${encodeURIComponent(nextResort.slug)}`
      );
    },
    [resort.slug]
  );

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
      bearing: next ? resort.bearing : 0,
      zoom: next ? resort.zoom : resort.zoom - 0.35,
      duration: 1200,
      essential: true,
    });
  }, [is3D, resort]);

  const graphPoints = useMemo(() => {
    if (!forecast.length) return "";
    const min = Math.max(0, resort.baseElevation - 500);
    const max = Math.max(min + 1000, resort.topElevation + 500);
    return forecast
      .map((hour, index) => {
        const x = (index / Math.max(1, forecast.length - 1)) * 1000;
        const y = 120 - ((hour.freezingLevel - min) / (max - min)) * 100;
        return `${x},${Math.max(8, Math.min(118, y))}`;
      })
      .join(" ");
  }, [forecast, resort.baseElevation, resort.topElevation]);

  return (
    <div
      ref={pageRef}
      className="relative h-[100dvh] w-full overflow-hidden bg-[#0a111a] text-white"
    >
      <div className="absolute inset-0">
        <div
          ref={mapNodeRef}
          className="h-full w-full"
          aria-label={`${resort.name} 3D snow map`}
        />
      </div>

      <SnowfallEffect
        enabled={snowSceneEnabled}
        intensity={snowIntensity}
        windSpeed={selected?.windSpeed ?? 0}
        windDirection={selected?.windDirection ?? 0}
      />

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
            <div className="pointer-events-auto flex max-w-[calc(100%-4.5rem)] items-center gap-2 rounded-xl border border-white/15 bg-[#07101b]/88 p-1.5 shadow-2xl backdrop-blur-xl sm:max-w-none">
              <Link
                href="/"
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white"
                aria-label="Back to homepage"
              >
                <ArrowLeft size={17} />
              </Link>
              <button
                onClick={() => setResortPickerOpen(value => !value)}
                aria-expanded={resortPickerOpen}
                aria-controls="resort-picker"
                aria-label={`Choose snow resort. Current resort: ${resort.name}`}
                className="flex min-w-0 items-center gap-3 border-l border-white/10 px-3 py-1 text-left transition hover:bg-white/5"
              >
                <span className="min-w-0">
                  <span className="block truncate font-mono text-[9px] uppercase tracking-[0.22em] text-cyan-300">
                    {resort.region} · {resort.country} · interactive 3D terrain
                  </span>
                  <span className="block truncate text-base font-semibold leading-tight md:text-lg">
                    {resort.name}
                  </span>
                  {resort.featuredRun && (
                    <span className="block truncate font-mono text-[8px] uppercase tracking-[0.15em] text-cyan-200/80">
                      Powder run · {resort.featuredRun}
                    </span>
                  )}
                </span>
                <ChevronDown
                  size={15}
                  className={`shrink-0 text-slate-400 transition ${
                    resortPickerOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>

            <div className="pointer-events-none flex gap-2 pr-11 md:pr-12">
              <button
                onClick={() => setAutoRotate(value => !value)}
                className={`pointer-events-auto hidden h-10 w-10 place-items-center rounded-xl border backdrop-blur-xl transition sm:grid ${
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
                className="pointer-events-auto hidden h-10 w-10 place-items-center rounded-xl border border-white/15 bg-[#07101b]/88 text-slate-300 backdrop-blur-xl transition hover:bg-white/10 hover:text-white sm:grid"
                title="Fullscreen"
              >
                <Maximize size={16} />
              </button>
              <button
                onClick={() => {
                  setResortPickerOpen(false);
                  setUiHidden(true);
                }}
                className="pointer-events-auto grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-[#07101b]/88 text-slate-300 backdrop-blur-xl transition hover:bg-white/10 hover:text-white"
                title="Hide interface"
              >
                <EyeOff size={16} />
              </button>
            </div>
          </header>

          {resortPickerOpen && (
            <ResortPicker
              selected={resort}
              onSelect={selectResort}
              onClose={() => setResortPickerOpen(false)}
            />
          )}

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
              <button
                onClick={() => setSnowSceneEnabled(value => !value)}
                aria-pressed={snowSceneEnabled}
                aria-label="Toggle illustrative snow scene"
                className={`grid w-9 place-items-center rounded-lg transition ${
                  snowSceneEnabled
                    ? "bg-sky-200/20 text-sky-100"
                    : "text-slate-400 hover:bg-white/10"
                }`}
                title="Toggle illustrative ground cover and ambient snow"
              >
                <Snowflake size={13} />
              </button>
            </div>
            <p className="mt-2 hidden rounded-lg bg-[#07101b]/72 px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.14em] text-slate-400 backdrop-blur md:block">
              Snow scene: illustrative · forecast values unchanged
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
            {resort.featuredRun ? `Powder run: ${resort.featuredRun} · ` : ""}
            {resort.kind} · illustrative snow scene · forecast values unchanged
            · archived satellite mosaic · Weather: Open-Meteo · imagery: Esri ·
            DEM: Mapterhorn · structures/trails: © OpenStreetMap contributors
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

const STATE_NAMES = {
  NSW: "New South Wales",
  VIC: "Victoria",
  TAS: "Tasmania",
  ACT: "Australian Capital Territory",
} as const;

const CONTINENTS: readonly ResortContinent[] = [
  "North America",
  "Europe",
  "Asia",
  "South America",
  "Oceania",
];

type ResortCollection = "powder" | "australia";

function ResortPicker({
  selected,
  onSelect,
  onClose,
}: {
  selected: SnowResort;
  onSelect: (resort: SnowResort) => void;
  onClose: () => void;
}) {
  const [collection, setCollection] = useState<ResortCollection>(
    selected.powderEntry ? "powder" : "australia"
  );
  const [query, setQuery] = useState("");
  const collectionResorts =
    collection === "powder" ? POWDER_RESORTS : AUSTRALIAN_SNOW_RESORTS;
  const normalizedQuery = normalizeSearchValue(query.trim());
  const filteredResorts = collectionResorts.filter(resort =>
    [
      resort.name,
      resort.featuredRun,
      resort.country,
      resort.region,
      resort.kind,
    ]
      .filter(Boolean)
      .some(value =>
        value ? normalizeSearchValue(value).includes(normalizedQuery) : false
      )
  );
  const groups =
    collection === "powder"
      ? CONTINENTS.map(continent => ({
          key: continent,
          label: continent,
          resorts: filteredResorts.filter(
            resort => resort.continent === continent
          ),
        }))
      : (Object.keys(STATE_NAMES) as Array<keyof typeof STATE_NAMES>).map(
          state => ({
            key: state,
            label: STATE_NAMES[state],
            resorts: filteredResorts.filter(resort => resort.state === state),
          })
        );

  return (
    <aside
      id="resort-picker"
      className="pointer-events-auto absolute left-3 top-[72px] z-30 max-h-[calc(100dvh-9rem)] w-[min(58rem,calc(100%-1.5rem))] overflow-y-auto rounded-2xl border border-white/15 bg-[#07101b]/96 p-4 shadow-2xl backdrop-blur-2xl md:left-5 md:top-[84px] md:p-5"
    >
      <div className="mb-4 flex items-start justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-300/15 text-cyan-200">
            <MapPinned size={18} />
          </span>
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-cyan-300">
              World snow explorer
            </p>
            <h2 className="mt-0.5 text-lg font-semibold">
              {POWDER_RESORTS.length} great runs · {SNOW_RESORTS.length} unique
              alpine locations
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">
              Explore the original Powder book&apos;s 50 featured runs alongside
              every Australian public ski area already mapped here.
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg border border-white/10 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          Close
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-xl border border-white/10 bg-white/[0.04] p-1">
          {(
            [
              ["powder", `Powder · ${POWDER_RESORTS.length}`],
              ["australia", `Australia · ${AUSTRALIAN_SNOW_RESORTS.length}`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setCollection(value)}
              className={`rounded-lg px-3 py-2 font-mono text-[9px] uppercase tracking-[0.12em] transition ${
                collection === value
                  ? "bg-white text-slate-950"
                  : "text-slate-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-slate-400 focus-within:border-cyan-300/45 focus-within:text-cyan-200 sm:w-72">
          <Search size={14} />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search run, resort or country"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-xs text-white outline-none placeholder:text-slate-600"
          />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {groups
          .filter(group => group.resorts.length > 0)
          .map(group => (
            <section key={group.key}>
              <h3 className="mb-2 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">
                {group.label} · {group.resorts.length}
              </h3>
              <div className="space-y-1">
                {group.resorts.map(resort => (
                  <button
                    key={resort.slug}
                    onClick={() => onSelect(resort)}
                    aria-current={
                      selected.slug === resort.slug ? "location" : undefined
                    }
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition ${
                      selected.slug === resort.slug
                        ? "border-cyan-300/45 bg-cyan-300/15 text-white"
                        : "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {resort.name}
                      </span>
                      <span className="block truncate font-mono text-[8px] uppercase tracking-[0.1em] text-slate-500">
                        {collection === "powder" && resort.featuredRun
                          ? resort.featuredRun
                          : resort.kind}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[9px] text-slate-500">
                      {resort.summitElevation} m
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
      </div>

      {filteredResorts.length === 0 && (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-slate-400">
          No run or resort matches “{query}”.
        </p>
      )}

      <div className="mt-4 border-t border-white/10 pt-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-sm font-medium text-slate-100">{selected.name}</p>
          {selected.featuredRun && (
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-cyan-300">
              Powder run · {selected.featuredRun}
            </p>
          )}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          {selected.description}
        </p>
        <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-cyan-300/75">
          {selected.region} · {selected.country} · base {selected.baseElevation}{" "}
          m · ski top {selected.summitElevation} m
        </p>
      </div>
    </aside>
  );
}

interface SnowParticle {
  x: number;
  y: number;
  radius: number;
  fallSpeed: number;
  drift: number;
  opacity: number;
  phase: number;
}

function SnowfallEffect({
  enabled,
  intensity,
  windSpeed,
  windDirection,
}: {
  enabled: boolean;
  intensity: number;
  windSpeed: number;
  windDirection: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let width = 0;
    let height = 0;
    let frame = 0;
    let previous = performance.now();
    const particles: SnowParticle[] = [];
    const count =
      enabled && intensity > 0.01 ? Math.round(60 + intensity * 300) : 0;
    const windRadians = (windDirection * Math.PI) / 180;
    const horizontalWind =
      Math.sin(windRadians) * Math.min(85, windSpeed * 2.2);

    const createParticle = (randomY: boolean): SnowParticle => ({
      x: Math.random() * Math.max(1, width),
      y: randomY ? Math.random() * Math.max(1, height) : -12,
      radius: 0.7 + Math.random() * (1.5 + intensity * 1.8),
      fallSpeed: 34 + Math.random() * 62 + intensity * 85,
      drift: (Math.random() - 0.5) * 20,
      opacity: 0.28 + Math.random() * 0.52,
      phase: Math.random() * Math.PI * 2,
    });

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const ratio = Math.min(window.devicePixelRatio, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (particles.length === 0) {
        for (let index = 0; index < count; index++) {
          particles.push(createParticle(true));
        }
      }
    };

    const draw = (now: number) => {
      const elapsed = Math.min(0.04, (now - previous) / 1000);
      previous = now;
      context.clearRect(0, 0, width, height);
      context.lineCap = "round";
      context.globalCompositeOperation = "screen";

      for (const particle of particles) {
        const flutter = Math.sin(now * 0.0016 + particle.phase) * 16;
        const horizontal = horizontalWind + particle.drift + flutter;
        particle.x += horizontal * elapsed;
        particle.y += particle.fallSpeed * elapsed;

        if (
          particle.y > height + 14 ||
          particle.x < -35 ||
          particle.x > width + 35
        ) {
          Object.assign(particle, createParticle(false));
          if (horizontalWind < 0) particle.x = width + 20;
          if (horizontalWind > 0) particle.x = -20;
        }

        context.strokeStyle = `rgba(240,249,255,${particle.opacity})`;
        context.lineWidth = particle.radius;
        context.beginPath();
        context.moveTo(particle.x, particle.y);
        context.lineTo(
          particle.x - horizontal * 0.035,
          particle.y - particle.fallSpeed * 0.045
        );
        context.stroke();
      }

      frame = requestAnimationFrame(draw);
    };

    resize();
    if (count > 0) frame = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      context.clearRect(0, 0, width, height);
    };
  }, [enabled, intensity, windDirection, windSpeed]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-[8] h-full w-full"
      aria-hidden="true"
    />
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
