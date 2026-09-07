import { POWDER_SNOW_RESORTS } from "@/lib/powderSnowResorts";

export type ResortState = "ACT" | "NSW" | "TAS" | "VIC";
export type ResortContinent =
  | "Asia"
  | "Europe"
  | "North America"
  | "Oceania"
  | "South America";
export type ResortKind =
  | "Alpine resort"
  | "Backcountry zone"
  | "Cross-country resort"
  | "Expedition descent"
  | "Historic ski area"
  | "Ski area"
  | "Snow-play resort"
  | "Volcanic ski area";

export interface SnowResort {
  slug: string;
  name: string;
  state?: ResortState;
  country: string;
  continent: ResortContinent;
  region: string;
  kind: ResortKind;
  description: string;
  featuredRun?: string;
  powderEntry?: boolean;
  lat: number;
  lon: number;
  baseElevation: number;
  summitElevation: number;
  topElevation: number;
  zoom: number;
  bearing: number;
  assetBase: string;
}

type AustralianSnowResort = Omit<SnowResort, "continent" | "country"> & {
  state: ResortState;
};

const AUSTRALIAN_RESORTS = [
  {
    slug: "falls-creek",
    name: "Falls Creek",
    state: "VIC",
    region: "Victorian Alps",
    kind: "Alpine resort",
    description:
      "Victoria's largest ski area, built across the Bogong High Plains with a ski-in, ski-out alpine village.",
    lat: -36.8702999,
    lon: 147.2737331,
    baseElevation: 1522,
    summitElevation: 1773,
    topElevation: 1873,
    zoom: 13.35,
    bearing: -28,
    assetBase: "/falls-creek",
  },
  {
    slug: "mount-hotham",
    name: "Mount Hotham",
    state: "VIC",
    region: "Victorian Alps",
    kind: "Alpine resort",
    description:
      "A ridge-top village above steep valleys, with much of the skiing beginning by descending from the summit road.",
    lat: -36.978,
    lon: 147.1324,
    baseElevation: 1450,
    summitElevation: 1845,
    topElevation: 1861,
    zoom: 12.75,
    bearing: 28,
    assetBase: "/ski-resorts/mount-hotham",
    featuredRun: "Mary's Slide",
    powderEntry: true,
  },
  {
    slug: "mount-buller",
    name: "Mount Buller",
    state: "VIC",
    region: "Victorian Alps",
    kind: "Alpine resort",
    description:
      "Melbourne's closest major downhill resort, wrapping a broad lift network around a compact summit village.",
    lat: -37.1456,
    lon: 146.4482,
    baseElevation: 1380,
    summitElevation: 1805,
    topElevation: 1805,
    zoom: 13,
    bearing: -32,
    assetBase: "/ski-resorts/mount-buller",
  },
  {
    slug: "mount-baw-baw",
    name: "Mount Baw Baw",
    state: "VIC",
    region: "Baw Baw Plateau",
    kind: "Alpine resort",
    description:
      "A compact family resort among snow gums on the southern edge of Victoria's alpine country.",
    lat: -37.8384,
    lon: 146.2747,
    baseElevation: 1450,
    summitElevation: 1567,
    topElevation: 1567,
    zoom: 13.65,
    bearing: 24,
    assetBase: "/ski-resorts/mount-baw-baw",
  },
  {
    slug: "dinner-plain",
    name: "Dinner Plain",
    state: "VIC",
    region: "Victorian Alps",
    kind: "Snow-play resort",
    description:
      "An alpine village with a short beginner slope, snow play and trails linking into the Hotham high country.",
    lat: -37.0231,
    lon: 147.2412,
    baseElevation: 1515,
    summitElevation: 1535,
    topElevation: 1545,
    zoom: 14.25,
    bearing: -18,
    assetBase: "/ski-resorts/dinner-plain",
  },
  {
    slug: "lake-mountain",
    name: "Lake Mountain",
    state: "VIC",
    region: "Yarra Ranges",
    kind: "Cross-country resort",
    description:
      "Australia's most visited cross-country snow resort, with a large groomed trail network close to Melbourne.",
    lat: -37.4957,
    lon: 145.8753,
    baseElevation: 1340,
    summitElevation: 1480,
    topElevation: 1480,
    zoom: 12.45,
    bearing: -20,
    assetBase: "/ski-resorts/lake-mountain",
  },
  {
    slug: "mount-stirling",
    name: "Mount Stirling",
    state: "VIC",
    region: "Victorian Alps",
    kind: "Cross-country resort",
    description:
      "An undeveloped alpine mountain known for cross-country trails, touring and a broad summit panorama.",
    lat: -37.1279,
    lon: 146.498,
    baseElevation: 1230,
    summitElevation: 1749,
    topElevation: 1749,
    zoom: 12.35,
    bearing: 24,
    assetBase: "/ski-resorts/mount-stirling",
  },
  {
    slug: "mount-st-gwinear",
    name: "Mount St Gwinear",
    state: "VIC",
    region: "Baw Baw National Park",
    kind: "Cross-country resort",
    description:
      "A small, quiet snowfield for cross-country skiing and snowshoeing on the eastern Baw Baw plateau.",
    lat: -37.8358,
    lon: 146.3214,
    baseElevation: 1310,
    summitElevation: 1509,
    topElevation: 1509,
    zoom: 12.8,
    bearing: -24,
    assetBase: "/ski-resorts/mount-st-gwinear",
  },
  {
    slug: "mount-buffalo",
    name: "Mount Buffalo",
    state: "VIC",
    region: "Mount Buffalo Plateau",
    kind: "Historic ski area",
    description:
      "A foundational Australian ski destination whose former lift areas now remain as a dramatic snow-covered plateau.",
    lat: -36.7296,
    lon: 146.7796,
    baseElevation: 1350,
    summitElevation: 1723,
    topElevation: 1723,
    zoom: 12.25,
    bearing: 20,
    assetBase: "/ski-resorts/mount-buffalo",
  },
  {
    slug: "perisher",
    name: "Perisher",
    state: "NSW",
    region: "Snowy Mountains",
    kind: "Alpine resort",
    description:
      "Australia's largest ski resort, joining Perisher Valley, Blue Cow, Smiggin Holes and Guthega across a vast area.",
    lat: -36.4055,
    lon: 148.4112,
    baseElevation: 1605,
    summitElevation: 2054,
    topElevation: 2054,
    zoom: 11.75,
    bearing: -28,
    assetBase: "/ski-resorts/perisher",
  },
  {
    slug: "thredbo",
    name: "Thredbo",
    state: "NSW",
    region: "Snowy Mountains",
    kind: "Alpine resort",
    description:
      "Australia's greatest lift-served vertical, rising from the Thredbo River village toward the Main Range.",
    lat: -36.504,
    lon: 148.3035,
    baseElevation: 1365,
    summitElevation: 2037,
    topElevation: 2037,
    zoom: 12.65,
    bearing: 28,
    assetBase: "/ski-resorts/thredbo",
  },
  {
    slug: "charlotte-pass",
    name: "Charlotte Pass",
    state: "NSW",
    region: "Snowy Mountains",
    kind: "Alpine resort",
    description:
      "Australia's highest resort village, snowbound in winter beneath the country's highest alpine peaks.",
    lat: -36.4317,
    lon: 148.3327,
    baseElevation: 1755,
    summitElevation: 1964,
    topElevation: 1964,
    zoom: 13.25,
    bearing: -32,
    assetBase: "/ski-resorts/charlotte-pass",
  },
  {
    slug: "selwyn",
    name: "Selwyn Snow Resort",
    state: "NSW",
    region: "Northern Snowy Mountains",
    kind: "Alpine resort",
    description:
      "A rebuilt family snow resort with approachable beginner and intermediate terrain in Kosciuszko National Park.",
    lat: -35.9058,
    lon: 148.4496,
    baseElevation: 1492,
    summitElevation: 1614,
    topElevation: 1614,
    zoom: 13.55,
    bearing: 24,
    assetBase: "/ski-resorts/selwyn",
  },
  {
    slug: "corin-forest",
    name: "Corin Forest",
    state: "ACT",
    region: "Brindabella Ranges",
    kind: "Snow-play resort",
    description:
      "Canberra's local mountain recreation area, using snowmaking for a compact beginner slope and snow play.",
    lat: -35.5274,
    lon: 148.9125,
    baseElevation: 1205,
    summitElevation: 1217,
    topElevation: 1228,
    zoom: 14.1,
    bearing: -24,
    assetBase: "/ski-resorts/corin-forest",
  },
  {
    slug: "ben-lomond",
    name: "Ben Lomond",
    state: "TAS",
    region: "Ben Lomond Plateau",
    kind: "Alpine resort",
    description:
      "Tasmania's principal lift-served ski field, perched above the spectacular switchbacks of Jacobs Ladder.",
    lat: -41.5333,
    lon: 147.6654,
    baseElevation: 1460,
    summitElevation: 1572,
    topElevation: 1572,
    zoom: 13.2,
    bearing: 30,
    assetBase: "/ski-resorts/ben-lomond",
  },
  {
    slug: "mount-mawson",
    name: "Mount Mawson",
    state: "TAS",
    region: "Mount Field National Park",
    kind: "Alpine resort",
    description:
      "A volunteer-operated club field with historic rope tows above the alpine tarns of Mount Field National Park.",
    lat: -42.682,
    lon: 146.5828,
    baseElevation: 1215,
    summitElevation: 1287,
    topElevation: 1320,
    zoom: 13.1,
    bearing: -28,
    assetBase: "/ski-resorts/mount-mawson",
  },
] as const satisfies readonly AustralianSnowResort[];

export const AUSTRALIAN_SNOW_RESORTS: readonly SnowResort[] =
  AUSTRALIAN_RESORTS.map(resort => ({
    ...resort,
    country: "Australia",
    continent: "Oceania",
  }));

export const SNOW_RESORTS: readonly SnowResort[] = [
  ...AUSTRALIAN_SNOW_RESORTS,
  ...POWDER_SNOW_RESORTS,
];

export const POWDER_RESORTS: readonly SnowResort[] = [
  ...POWDER_SNOW_RESORTS.slice(0, 48),
  ...AUSTRALIAN_SNOW_RESORTS.filter(resort => resort.slug === "mount-hotham"),
  ...POWDER_SNOW_RESORTS.slice(48),
];
export const DEFAULT_RESORT = AUSTRALIAN_SNOW_RESORTS[0];

export function findSnowResort(slug: string | null) {
  return SNOW_RESORTS.find(resort => resort.slug === slug) ?? DEFAULT_RESORT;
}
