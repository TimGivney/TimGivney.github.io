// The /ausengine catalogue: engines designed and/or built in Australia — the
// road-car sixes and V8s, the Repco V8 that won a Formula 1 World Championship,
// home-grown aero and radial engines, the stationary engines that ran the bush,
// and Ralph Sarich's orbital oddity. Each entry carries what the 3D model
// builder needs (archetype + cylinder count + a few knobs) plus the specs and
// the story.

export type EngineCategory =
  | "six"
  | "v8"
  | "racing"
  | "aero"
  | "stationary"
  | "novel"
  | "v6";

export type EngineArchetype =
  | "inline"
  | "vee"
  | "flat"
  | "radial"
  | "turbojet"
  | "stationary"
  | "orbital";

export interface EngineModelSpec {
  archetype: EngineArchetype;
  cylinders: number;
  veeAngle?: number; // vee only, degrees
  turbo?: boolean; // inline: add a turbo snail
  dohc?: boolean; // wider twin-cam covers / velocity stacks
  twinFlywheel?: boolean; // stationary: flywheel on both ends
}

export interface Engine {
  id: string;
  name: string;
  maker: string;
  origin: string; // where it was made
  years: string;
  category: EngineCategory;
  model: EngineModelSpec;
  layout: string; // e.g. "OHV inline-six"
  displacement: string;
  power: string;
  color: string; // primary block colour
  color2: string; // accent (covers / manifolds)
  tagline: string;
  story: string; // why it matters
  spec: string; // technical detail
  legacy: string; // where it ran / what it left behind
}

export const CATEGORY_LABEL: Record<EngineCategory, string> = {
  six: "Straight sixes",
  v8: "V8s",
  racing: "Racing",
  aero: "Aero engines",
  stationary: "Stationary & farm",
  novel: "Rotary & novel",
  v6: "Modern V6",
};

export const CATEGORY_ORDER: EngineCategory[] = [
  "six",
  "v8",
  "racing",
  "aero",
  "stationary",
  "novel",
  "v6",
];

export const ENGINES: Engine[] = [
  // ------------------------------- straight sixes -------------------------------
  {
    id: "holden-grey",
    name: "Holden Grey Motor",
    maker: "General Motors–Holden",
    origin: "Port Melbourne, VIC",
    years: "1948–1963",
    category: "six",
    model: { archetype: "inline", cylinders: 6 },
    layout: "OHV inline-six",
    displacement: "2.15–2.26 L (132–138 cu in)",
    power: "45–57 kW (60–76 bhp)",
    color: "#8a9098",
    color2: "#5c6169",
    tagline: "Australia's first mass-produced car engine",
    story:
      "The engine that powered '48-215 (the FX) — the first 'Australia's Own Car'. Grey-painted and Buick-derived, it was a low-stress, easy-to-fix six that put a nation on wheels and defined the Holden character for a generation.",
    spec:
      "Cast-iron OHV six with a three-bearing crank, single Stromberg carburettor and a reputation for running forever. Bored out from 132 to 138 cu in for the FB in 1960.",
    legacy:
      "The starting point for Australian volume engine manufacturing at Fishermans Bend — and, tuned by the likes of Waggott and Repco, a giant-killer in early Australian motor racing.",
  },
  {
    id: "holden-red",
    name: "Holden Red Motor",
    maker: "General Motors–Holden",
    origin: "Fishermans Bend, VIC",
    years: "1963–1986",
    category: "six",
    model: { archetype: "inline", cylinders: 6 },
    layout: "OHV inline-six (Red / Blue / Black)",
    displacement: "2.45–3.31 L (149–202 cu in)",
    power: "70–121 kW",
    color: "#b3201d",
    color2: "#7a1512",
    tagline: "The six that half of Australia learned to drive on",
    story:
      "Ed Silins' clean-sheet 'Red' six replaced the Grey with the EH of 1963 and defined the Holden for a generation — from Kingswoods to Toranas to the first Commodores. Later 'Blue' and Bosch-injected 'Black' versions carried it to 1986.",
    spec:
      "Seven-bearing crank, cast-iron block and head, from a 138 baby-six up to the beloved 202. The twin-carb 186S and 202 X2 were Holden's first factory performance sixes.",
    legacy:
      "Twenty-four years of service in cars, Bedford vans and forklifts, and a cornerstone of Australian street-machine culture before the smooth Nissan RB30 took over.",
  },
  {
    id: "chrysler-hemi6",
    name: "Chrysler Hemi-6",
    maker: "Chrysler Australia",
    origin: "Tonsley Park, SA",
    years: "1970–1981",
    category: "six",
    model: { archetype: "inline", cylinders: 6 },
    layout: "OHV hemi-head inline-six",
    displacement: "3.5–4.3 L (215–265 cu in)",
    power: "up to 225 kW (302 bhp)",
    color: "#c96a1e",
    color2: "#7c3d0f",
    tagline: "The Aussie hemi that scared the V8s",
    story:
      "Chrysler USA handed its abandoned 'D-engine' to a five-man team in Adelaide, who turned it into the Hemi-6 — a hemispherical-head straight-six for the Valiant. In triple-Weber 'Six Pack' E49 Charger form it made 302 bhp: for a time the quickest-accelerating Australian car built.",
    spec:
      "Thin-wall cast-iron block, hemi combustion chambers, 245 and 265 cu in performance versions with three twin-choke Weber carbs on the legendary E38/E49 Chargers.",
    legacy:
      "Proof Australia could engineer a world-class engine of its own — and a muscle-car icon that still commands six figures today.",
  },
  {
    id: "ford-crossflow",
    name: "Ford Falcon Crossflow Six",
    maker: "Ford Australia",
    origin: "Geelong, VIC",
    years: "1976–1993",
    category: "six",
    model: { archetype: "inline", cylinders: 6 },
    layout: "OHV crossflow inline-six",
    displacement: "3.3–4.1 L (200–250 cu in)",
    power: "88–120 kW",
    color: "#2a4d86",
    color2: "#16305a",
    tagline: "The Falcon workhorse, reinvented in Geelong",
    story:
      "Ford Australia reworked the American Falcon six into a locally developed crossflow — intake on one side, exhaust on the other — for better breathing. The alloy-head, EFI versions of the late 1980s made it smooth and strong enough to see out the carburettor era.",
    spec:
      "Cast-iron block with the Australian crossflow head (200 and 250 cu in), later an alloy head and Bosch EFI. Shared its bore centres with every Falcon six back to 1960 — and forward to the Barra.",
    legacy:
      "The direct ancestor of the Barra, and the engine that kept the Falcon competitive against the Holden six for two decades.",
  },
  {
    id: "ford-barra",
    name: "Ford Barra",
    maker: "Ford Australia",
    origin: "Geelong, VIC",
    years: "2002–2016",
    category: "six",
    model: { archetype: "inline", cylinders: 6, dohc: true, turbo: true },
    layout: "DOHC 24-valve inline-six (+ turbo)",
    displacement: "4.0 L",
    power: "182–310 kW factory",
    color: "#1c2430",
    color2: "#3d4756",
    tagline: "The turbo six that became a tuning legend",
    story:
      "Named after the barramundi, the Barra gave the old Falcon six a modern twin-cam, 24-valve alloy head and — crucially — a turbocharged variant. The XR6 Turbo out-punched the V8s beside it, and the Barra's cast-iron block made it almost unbreakable: tuners now chase four-figure horsepower.",
    spec:
      "4.0-litre DOHC I6, variable cam timing, cast-iron block (same bore centres as the 1960 Falcon six). Factory turbo outputs to 310 kW in the FG F6; the aftermarket reliably doubles that.",
    legacy:
      "Ford Australia's engineering high-water mark — built in Geelong until the last Falcon in 2016, and now fitted to everything from Holdens to hot-rods.",
  },

  // ------------------------------- V8s -------------------------------
  {
    id: "holden-v8",
    name: "Holden V8 'Iron Lion'",
    maker: "General Motors–Holden",
    origin: "Fishermans Bend, VIC",
    years: "1969–2000",
    category: "v8",
    model: { archetype: "vee", cylinders: 8, veeAngle: 90 },
    layout: "OHV 90° V8",
    displacement: "4.2 L (253) / 5.0 L (308)",
    power: "132–185 kW",
    color: "#204a86",
    color2: "#12305c",
    tagline: "The homegrown V8 in every Aussie muscle car",
    story:
      "Holden's own OHV V8 — the 253 and the immortal 308 — powered Monaros, Toranas, Kingswoods and Commodores for three decades. Fuel-injected and stroked to a full 5.0 litres, it became the heartbeat of Group A touring-car racing and the Aussie V8 legend.",
    spec:
      "Cast-iron 90° V8, 4.2 and 5.0-litre capacities, single cam-in-block. The EFI 5000i and the HSV-fettled versions were the final, strongest evolutions.",
    legacy:
      "Retired in 2000 when the imported Chevrolet LS1 took over — but the '308' remains shorthand for Australian V8 muscle.",
  },
  {
    id: "ford-cleveland",
    name: "Ford Cleveland V8",
    maker: "Ford Australia",
    origin: "Geelong, VIC",
    years: "1971–1982",
    category: "v8",
    model: { archetype: "vee", cylinders: 8, veeAngle: 90 },
    layout: "OHV 90° V8 (302C / 351C)",
    displacement: "4.9 L (302) / 5.8 L (351)",
    power: "up to ~224 kW (300 bhp)",
    color: "#1f5aa0",
    color2: "#123863",
    tagline: "The Cleveland that only Australia kept building",
    story:
      "When Ford USA killed the 351 Cleveland after 1974, Ford Australia kept casting it at Geelong — even ordering 60,000 blocks to bridge the gap. The 351 Clevo powered the fearsome XY GTHO Phase III, and a uniquely-Australian short-stroke 302C ran alongside it.",
    spec:
      "335-series Cleveland V8, locally cast from 1975, 302 and 351 cu in. Over 250,000 built at Geelong; the last one went into a 4WD Bronco in 1985.",
    legacy:
      "So respected that De Tomaso and Bolwell turned to Geelong for Clevelands once US supply dried up.",
  },
  {
    id: "leyland-p76-v8",
    name: "Leyland P76 V8",
    maker: "Leyland Australia",
    origin: "Zetland, NSW",
    years: "1973–1975",
    category: "v8",
    model: { archetype: "vee", cylinders: 8, veeAngle: 90 },
    layout: "OHV 90° all-alloy V8",
    displacement: "4.4 L",
    power: "144 kW (192 bhp)",
    color: "#b9bcc0",
    color2: "#82868c",
    tagline: "The all-alloy V8 in Australia's great might-have-been",
    story:
      "The P76 was the only car designed, built and sold by Leyland Australia — and its light, all-aluminium 4.4-litre V8 was genuinely good. Sydney engineers took the ex-GM/Rover 3.5 alloy V8, gave it a taller block and longer stroke, and made it punch well above its weight.",
    spec:
      "All-alloy OHV V8, bored and stroked to 4.4 litres with an Australian intake and twin-throat Stromberg. Famously roomy engine bay — the boot could swallow a 44-gallon drum.",
    legacy:
      "The car flopped and took Leyland's local manufacturing with it, but the alloy V8 remains a cult favourite and a proof-of-concept ahead of its time.",
  },

  // ------------------------------- racing -------------------------------
  {
    id: "repco-rb620",
    name: "Repco-Brabham RB620 V8",
    maker: "Repco-Brabham Engines",
    origin: "Maidstone / Richmond, VIC",
    years: "1966",
    category: "racing",
    model: { archetype: "vee", cylinders: 8, veeAngle: 90 },
    layout: "SOHC 90° V8, dry sump",
    displacement: "3.0 L",
    power: "~231 kW (310 bhp) @ 8000",
    color: "#b98b2e",
    color2: "#6e4f14",
    tagline: "The Australian engine that won the F1 World Championship",
    story:
      "Australia's crown jewel. When F1 doubled to 3.0 litres for 1966, Jack Brabham and Repco's Phil Irving built a light, simple SOHC V8 on an abandoned GM Oldsmobile alloy block. Brabham won the 1966 Drivers' and Constructors' titles with it — still the only man to win F1 in a car bearing his own name.",
    spec:
      "3.0-litre 90° V8, aluminium block, chain-driven single overhead cams, two valves per cylinder, Lucas fuel injection, dry-sump. Just ~160 kg and ~310 bhp — reliability, not power, won it the title.",
    legacy:
      "The high-water mark of Australian engine-building, and one of the great David-and-Goliath stories in world motorsport.",
  },
  {
    id: "repco-rb740",
    name: "Repco RB740 V8",
    maker: "Repco-Brabham Engines",
    origin: "Maidstone, VIC",
    years: "1968",
    category: "racing",
    model: { archetype: "vee", cylinders: 8, veeAngle: 90, dohc: true },
    layout: "DOHC 4-valve 90° V8",
    displacement: "3.0 L",
    power: "~280–300 kW",
    color: "#c69a3c",
    color2: "#6e4f14",
    tagline: "The quad-cam follow-up to a champion",
    story:
      "Repco chased more power for 1968 with the '740': four valves per cylinder and twin overhead cams per bank. It made big numbers but lost the reliability that had won 1966 — the year the Cosworth DFV arrived and rewrote the rules.",
    spec:
      "3.0-litre DOHC 32-valve V8 with a purpose-cast Repco block, Lucas injection and dry-sump lubrication. A genuine grand-prix engine designed and built in suburban Melbourne.",
    legacy:
      "The end of Repco's F1 adventure, but a remarkable demonstration of a small Australian team building state-of-the-art racing engines.",
  },
  {
    id: "waggott-tc4v",
    name: "Waggott TC-4V",
    maker: "Waggott Engineering",
    origin: "Sydney, NSW",
    years: "1968–1974",
    category: "racing",
    model: { archetype: "inline", cylinders: 4, dohc: true },
    layout: "DOHC 16-valve inline-four",
    displacement: "1.6–2.0 L",
    power: "~205 kW (275 bhp)",
    color: "#8f9298",
    color2: "#a3352f",
    tagline: "Merv Waggott's championship twin-cams",
    story:
      "Merv Waggott started with a twin-cam head on the humble Holden Grey six, then built the TC-4V — a twin-cam, four-valve racing four on a Cortina block. In 2.0-litre form it won the 1971 Australian Drivers' Championship, beating imported Formula 5000 machinery.",
    spec:
      "Twin-overhead-cam, four-valves-per-cylinder head of Waggott's own design, three twin-choke Webers or fuel injection, 1600 and 2000 cc. From ~62 bhp stock to 275 bhp.",
    legacy:
      "A one-man-band engineering triumph — Waggott Cams still operates today under Merv's son.",
  },

  // ------------------------------- aero -------------------------------
  {
    id: "jabiru-3300",
    name: "Jabiru 3300",
    maker: "Jabiru Aircraft",
    origin: "Bundaberg, QLD",
    years: "1990s–present",
    category: "aero",
    model: { archetype: "flat", cylinders: 6 },
    layout: "Air-cooled flat-six aero engine",
    displacement: "3.3 L",
    power: "89 kW (120 hp)",
    color: "#26292e",
    color2: "#b8bcc2",
    tagline: "A clean-sheet Australian aircraft engine",
    story:
      "When their engine supplier folded, Jabiru simply designed and built their own. The result is a genuinely Australian aero engine — a compact, air-cooled flat-six (and flat-four 2200) that powers Jabiru's own light aircraft and thousands of homebuilts worldwide, made entirely in Bundaberg.",
    spec:
      "Direct-drive, air-cooled horizontally-opposed six, solid-lifter OHV, dual ignition, ~60 kg. The 2200 flat-four makes 85 hp; the 3300 flat-six makes 120 hp.",
    legacy:
      "One of very few clean-sheet aero engines ever certified and mass-produced in Australia.",
  },
  {
    id: "rotec-r3600",
    name: "Rotec R3600 Radial",
    maker: "Rotec Aerosport",
    origin: "Melbourne, VIC",
    years: "2005–present",
    category: "aero",
    model: { archetype: "radial", cylinders: 9 },
    layout: "9-cylinder air-cooled radial",
    displacement: "3.6 L",
    power: "112 kW (150 hp)",
    color: "#c8ccd2",
    color2: "#4a4e55",
    tagline: "A brand-new radial, built in Melbourne",
    story:
      "Rotec makes something almost no-one else does anymore: brand-new radial engines. The nine-cylinder R3600 (and seven-cylinder R2800) bring the look and sound of a 1920s rotary-era engine to modern reproductions of the Fokker Triplane, Sopwith Camel and Nieuport 17.",
    spec:
      "Single-row air-cooled radial, 7 cylinders (R2800, 110 hp) or 9 cylinders (R3600, 150 hp), with Rotec's own throttle-body injection. Craftsmanship of a bygone era, made new.",
    legacy:
      "Australia's answer to the golden age of aviation — genuine radials for vintage repros and homebuilts around the world.",
  },
  {
    id: "cac-avon",
    name: "CAC Rolls-Royce Avon",
    maker: "Commonwealth Aircraft Corporation",
    origin: "Fishermans Bend, VIC",
    years: "1950s",
    category: "aero",
    model: { archetype: "turbojet", cylinders: 0 },
    layout: "Axial-flow turbojet (licence-built)",
    displacement: "—",
    power: "33 kN (7,500 lbf) thrust",
    color: "#9aa0a8",
    color2: "#5a5f66",
    tagline: "Australia's home-built jet age",
    story:
      "When Australia built its own Sabre jet fighter and Canberra bomber, it built the engines too. CAC produced 218 Rolls-Royce Avon axial-flow turbojets under licence at Fishermans Bend — the Avon Sabre's uprated engine gave it more thrust than the American original.",
    spec:
      "Axial-flow turbojet, ~7,500 lbf at sea level (Mk 26 for the CAC Sabre; Mk 109 for the GAF Canberra). The first axial jet Rolls-Royce designed, built under licence in Melbourne.",
    legacy:
      "Put Australia into the jet age with a domestically-built engine — a capability few nations of its size ever had.",
  },
  {
    id: "cac-twin-wasp",
    name: "CAC Pratt & Whitney Twin Wasp",
    maker: "Commonwealth Aircraft Corporation",
    origin: "Lidcombe / Fishermans Bend",
    years: "1939–1945",
    category: "aero",
    model: { archetype: "radial", cylinders: 14 },
    layout: "14-cyl twin-row radial (licence-built)",
    displacement: "30 L (1,830 cu in)",
    power: "~895 kW (1,200 hp)",
    color: "#8b9199",
    color2: "#33373d",
    tagline: "The radial that armed a wartime nation",
    story:
      "During WWII, CAC licence-built the Pratt & Whitney Twin Wasp so Australia could power its own Beaufort bombers without relying on imports. The nine-cylinder Wasp went into the Wirraway and Boomerang — home-built radials for home-built warplanes.",
    spec:
      "R-1830 Twin Wasp: 14-cylinder, twin-row, air-cooled radial, ~1,200 hp. Built in Australia for the DAP Beaufort; the smaller R-1340 Wasp powered CAC's own Wirraway trainer.",
    legacy:
      "Aircraft-engine manufacturing at scale under wartime pressure — the industrial foundation CAC later built its jet engines on.",
  },

  // ------------------------------- stationary & farm -------------------------------
  {
    id: "ronaldson-austral",
    name: "Ronaldson-Tippett 'Austral'",
    maker: "Ronaldson Bros. & Tippett",
    origin: "Ballarat, VIC",
    years: "1905–1972",
    category: "stationary",
    model: { archetype: "stationary", cylinders: 1, twinFlywheel: true },
    layout: "Single-cyl hopper-cooled oil engine",
    displacement: "various (1.5–20 hp)",
    power: "1.1–15 kW",
    color: "#2f5d3a",
    color2: "#1d3b25",
    tagline: "The engine that ran the Australian farm",
    story:
      "For nearly 70 years, Ronaldson Bros. & Tippett of Ballarat built the 'Austral' oil engine and its successors — rugged single-cylinder stationary engines that pumped water, ground chaff, sawed wood and generated power on farms right across Australia. One of the largest engine makers in the southern hemisphere.",
    spec:
      "Slow-revving single-cylinder, hopper (evaporative) cooling, huge exposed flywheels, hit-and-miss or throttle governing. Ran on kerosene or crude oil; later diesels too.",
    legacy:
      "Thousands survive and still chug at vintage rallies — the soundtrack of rural Australia before mains power reached the bush.",
  },
  {
    id: "southern-cross",
    name: "Southern Cross Engine",
    maker: "Toowoomba Foundry",
    origin: "Toowoomba, QLD",
    years: "1900s–1980s",
    category: "stationary",
    model: { archetype: "stationary", cylinders: 1, twinFlywheel: false },
    layout: "Single-cyl petrol / kerosene / diesel",
    displacement: "various",
    power: "1–75 kW",
    color: "#243b6e",
    color2: "#16264a",
    tagline: "Partner to the windmill on every Aussie station",
    story:
      "The Toowoomba Foundry is famous for the Southern Cross windmill — but when the wind didn't blow, its Southern Cross engines pumped the water instead. From a 1½-horsepower farm pump to big diesels, they were known worldwide for ruggedness and reliability.",
    spec:
      "Single-cylinder stationary engines across petrol, kerosene and diesel. Southern Cross's diesels pioneered oil-primed starting and internal oil filtration — innovations later copied at home and abroad.",
    legacy:
      "Over a century of the Southern Cross name across engines, windmills and pumps — an enduring icon of the Darling Downs.",
  },

  // ------------------------------- rotary & novel -------------------------------
  {
    id: "sarich-orbital",
    name: "Sarich Orbital Engine",
    maker: "Orbital Engine Company",
    origin: "Balcatta, WA",
    years: "1972–1990s",
    category: "novel",
    model: { archetype: "orbital", cylinders: 3 },
    layout: "Orbital-motion IC engine / OCP two-stroke",
    displacement: "1.2–3.5 L",
    power: "concept / prototype",
    color: "#a53228",
    color2: "#5f1a14",
    tagline: "Australia's audacious reinvention of the engine",
    story:
      "Perth engineer Ralph Sarich set out to reinvent the internal-combustion engine. His orbital engine used a prismatic piston that orbited — rather than reciprocated — promising more power from less bulk. It captivated the nation in the 1970s and drew BHP and government backing.",
    spec:
      "The original orbital ran a 3.5-litre four-stroke; the company later pivoted to the 'Orbital Combustion Process' — a clean, direct-injection two-stroke whose fuel-injection technology found real success in outboards and small engines.",
    legacy:
      "The engine itself never reached mass production, but Orbital's direct-injection IP was licensed worldwide — a genuinely Australian contribution to engine technology.",
  },

  // ------------------------------- modern V6 -------------------------------
  {
    id: "holden-alloytec",
    name: "Holden HFV6 'Alloytec'",
    maker: "GM Holden",
    origin: "Fishermans Bend, VIC",
    years: "2003–2016",
    category: "v6",
    model: { archetype: "vee", cylinders: 6, veeAngle: 60, dohc: true },
    layout: "DOHC 24-valve 60° V6",
    displacement: "3.6 L",
    power: "190–210 kW",
    color: "#aab0b8",
    color2: "#5a6068",
    tagline: "Ten million engines, exported to the world",
    story:
      "Holden's last great engine story wasn't a V8 but a V6. The Fishermans Bend plant co-developed and built GM's High-Feature V6 — the 'Alloytec' — for Commodores and, remarkably, for export to Cadillac, Saab, Alfa Romeo and more across every continent but Antarctica.",
    spec:
      "All-alloy 60° V6, DOHC, 24 valves, variable cam timing, 2.8–3.6 litres. Over 200,000 engineering hours and 143 experimental engines went into localising it.",
    legacy:
      "More than 10 million engines built at Port Melbourne before the plant closed in 2016 — nearly half of them exported. The end of Australian volume engine manufacturing.",
  },
];

export function engineById(id: string): Engine {
  return ENGINES.find(e => e.id === id) || ENGINES[0];
}
