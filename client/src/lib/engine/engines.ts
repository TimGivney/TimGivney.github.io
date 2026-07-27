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
  lore: string; // workshop stories and cultural memory
}

export interface EngineMediaImage {
  src: string;
  alt: string;
  caption: string;
  sourceUrl: string;
  credit: string;
  license: string;
  kind?: "photo" | "archive";
}

export interface EnginePerson {
  name: string;
  role: string;
  contribution: string;
  portrait?: EngineMediaImage;
}

export interface EngineMedia {
  images: EngineMediaImage[];
  people: EnginePerson[];
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
    spec: "Cast-iron OHV six with a three-bearing crank, single Stromberg carburettor and a reputation for running forever. Bored out from 132 to 138 cu in for the FB in 1960.",
    legacy:
      "The starting point for Australian volume engine manufacturing at Fishermans Bend — and, tuned by the likes of Waggott and Repco, a giant-killer in early Australian motor racing.",
    lore: "Old racers called the early Holden body a 'humpy', and its grey six became the backyard engineer's blank canvas: shaved heads, twin carburettors and home-made extractors turned the family sedan into a club-racing weapon.",
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
    spec: "Seven-bearing crank, cast-iron block and head, from a 138 baby-six up to the beloved 202. The twin-carb 186S and 202 X2 were Holden's first factory performance sixes.",
    legacy:
      "Twenty-four years of service in cars, Bedford vans and forklifts, and a cornerstone of Australian street-machine culture before the smooth Nissan RB30 took over.",
    lore: "Its paint became a family tree: Red, then Blue, then Black. Australians still identify a whole generation of Holden engineering by the colour on the block, with '186' and '202' spoken more like nicknames than capacities.",
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
    spec: "Thin-wall cast-iron block, hemi combustion chambers, 245 and 265 cu in performance versions with three twin-choke Weber carbs on the legendary E38/E49 Chargers.",
    legacy:
      "Proof Australia could engineer a world-class engine of its own — and a muscle-car icon that still commands six figures today.",
    lore: "The Charger E49's 'Six Pack' badge meant three Weber carburettors, not six cylinders. Its standing-quarter reputation became folklore because the lighter Hemi-six could embarrass larger V8s without pretending to be one.",
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
    spec: "Cast-iron block with the Australian crossflow head (200 and 250 cu in), later an alloy head and Bosch EFI. Shared its bore centres with every Falcon six back to 1960 — and forward to the Barra.",
    legacy:
      "The direct ancestor of the Barra, and the engine that kept the Falcon competitive against the Holden six for two decades.",
    lore: "Crossflows earned their mythology in taxis, utes and paddock cars rather than showrooms. A worn-looking Falcon could have already circled the continent in kilometres and still be expected to tow home another project.",
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
    spec: "4.0-litre DOHC I6, variable cam timing, cast-iron block (same bore centres as the 1960 Falcon six). Factory turbo outputs to 310 kW in the FG F6; the aftermarket reliably doubles that.",
    legacy:
      "Ford Australia's engineering high-water mark — built in Geelong until the last Falcon in 2016, and now fitted to everything from Holdens to hot-rods.",
    lore: "The Barra's cult grew after production ended: wrecking-yard taxi engines became swap material, unopened factory bottom ends made startling power, and 'Barra the world' became both a joke and a serious build plan.",
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
    spec: "Cast-iron 90° V8, 4.2 and 5.0-litre capacities, single cam-in-block. The EFI 5000i and the HSV-fettled versions were the final, strongest evolutions.",
    legacy:
      "Retired in 2000 when the imported Chevrolet LS1 took over — but the '308' remains shorthand for Australian V8 muscle.",
    lore: "The capacity badges changed from 253 and 308 cubic inches to 4.2 and 5.0 litres, but the old numbers never left the language. A lumpy 308 idle remains an instant audio signature at burnout pads and country car shows.",
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
    spec: "335-series Cleveland V8, locally cast from 1975, 302 and 351 cu in. Over 250,000 built at Geelong; the last one went into a 4WD Bronco in 1985.",
    legacy:
      "So respected that De Tomaso and Bolwell turned to Geelong for Clevelands once US supply dried up.",
    lore: "The GTHO Phase III made the 351 Cleveland inseparable from Bathurst folklore. Ford Australia's decision to keep casting blocks after America stopped also made Geelong an unlikely lifeline for exotic-car makers and racers overseas.",
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
    spec: "All-alloy OHV V8, bored and stroked to 4.4 litres with an Australian intake and twin-throat Stromberg. Famously roomy engine bay — the boot could swallow a 44-gallon drum.",
    legacy:
      "The car flopped and took Leyland's local manufacturing with it, but the alloy V8 remains a cult favourite and a proof-of-concept ahead of its time.",
    lore: "The P76's famous 44-gallon-drum boot became the punchline that outlived the car, yet owners remember the engine's real party trick: V8 torque without a cast-iron V8's weight over the nose.",
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
    spec: "3.0-litre 90° V8, aluminium block, chain-driven single overhead cams, two valves per cylinder, Lucas fuel injection, dry-sump. Just ~160 kg and ~310 bhp — reliability, not power, won it the title.",
    legacy:
      "The high-water mark of Australian engine-building, and one of the great David-and-Goliath stories in world motorsport.",
    lore: "The RB620 was deliberately unfashionable: an off-the-shelf alloy block, modest revs and fewer camshafts than its rivals. Brabham and Repco bet that finishing races would beat dazzling dyno figures — and won both world titles.",
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
    spec: "3.0-litre DOHC 32-valve V8 with a purpose-cast Repco block, Lucas injection and dry-sump lubrication. A genuine grand-prix engine designed and built in suburban Melbourne.",
    legacy:
      "The end of Repco's F1 adventure, but a remarkable demonstration of a small Australian team building state-of-the-art racing engines.",
    lore: "The RB740 tells the other half of the Repco story: after simplicity conquered Formula 1, the pressure to match the new Cosworth DFV pulled Melbourne's team toward a far more ambitious engine whose speed could not repay its fragility.",
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
    spec: "Twin-overhead-cam, four-valves-per-cylinder head of Waggott's own design, three twin-choke Webers or fuel injection, 1600 and 2000 cc. From ~62 bhp stock to 275 bhp.",
    legacy:
      "A one-man-band engineering triumph — Waggott Cams still operates today under Merv's son.",
    lore: "Waggott's workshop bridged hot-rodding and grand-prix engineering: a clever cylinder head could turn a familiar production block into something that sounded and performed like an exotic imported racing engine.",
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
    spec: "Direct-drive, air-cooled horizontally-opposed six, solid-lifter OHV, dual ignition, ~60 kg. The 2200 flat-four makes 85 hp; the 3300 flat-six makes 120 hp.",
    legacy:
      "One of very few clean-sheet aero engines ever certified and mass-produced in Australia.",
    lore: "Jabiru's answer to a failed supplier was unusually Australian: do not wait for another overseas catalogue — design the engine beside the aeroplane, machine it in Bundaberg and support builders directly from the factory.",
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
    spec: "Single-row air-cooled radial, 7 cylinders (R2800, 110 hp) or 9 cylinders (R3600, 150 hp), with Rotec's own throttle-body injection. Craftsmanship of a bygone era, made new.",
    legacy:
      "Australia's answer to the golden age of aviation — genuine radials for vintage repros and homebuilts around the world.",
    lore: "A Rotec gives a newly built aircraft the slow propeller cadence, exposed rocker gear and circular silhouette people associate with interwar aviation — theatre backed by a modern engine that can still be ordered new.",
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
    spec: "Axial-flow turbojet, ~7,500 lbf at sea level (Mk 26 for the CAC Sabre; Mk 109 for the GAF Canberra). The first axial jet Rolls-Royce designed, built under licence in Melbourne.",
    legacy:
      "Put Australia into the jet age with a domestically-built engine — a capability few nations of its size ever had.",
    lore: "Fitting the Avon transformed the Sabre so thoroughly that CAC widened and redesigned much of the fuselage. It was not simply an American fighter assembled locally, but an Australian re-engineering built around a British engine made in Melbourne.",
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
    spec: "R-1830 Twin Wasp: 14-cylinder, twin-row, air-cooled radial, ~1,200 hp. Built in Australia for the DAP Beaufort; the smaller R-1340 Wasp powered CAC's own Wirraway trainer.",
    legacy:
      "Aircraft-engine manufacturing at scale under wartime pressure — the industrial foundation CAC later built its jet engines on.",
    lore: "The Twin Wasp programme was industrial insurance: drawings, tooling, foundries and workers had to become a domestic supply chain while shipping lanes were threatened. The achievement was as much factory-making as engine-making.",
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
    spec: "Slow-revving single-cylinder, hopper (evaporative) cooling, huge exposed flywheels, hit-and-miss or throttle governing. Ran on kerosene or crude oil; later diesels too.",
    legacy:
      "Thousands survive and still chug at vintage rallies — the soundtrack of rural Australia before mains power reached the bush.",
    lore: "Austral engines worked at walking pace with flywheels in full view, each power stroke separated by a patient mechanical breath. Collectors preserve not only the machines but the distinctive chuff that once marked a working farm.",
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
    spec: "Single-cylinder stationary engines across petrol, kerosene and diesel. Southern Cross's diesels pioneered oil-primed starting and internal oil filtration — innovations later copied at home and abroad.",
    legacy:
      "Over a century of the Southern Cross name across engines, windmills and pumps — an enduring icon of the Darling Downs.",
    lore: "On remote stations the windmill and engine were a team: free wind when it came, a dependable single-cylinder backup when it did not. Keeping water moving mattered more than elegance, which is why repairable Southern Cross machinery travelled so far.",
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
    spec: "The original orbital ran a 3.5-litre four-stroke; the company later pivoted to the 'Orbital Combustion Process' — a clean, direct-injection two-stroke whose fuel-injection technology found real success in outboards and small engines.",
    legacy:
      "The engine itself never reached mass production, but Orbital's direct-injection IP was licensed worldwide — a genuinely Australian contribution to engine technology.",
    lore: "Sarich became a household name before the orbital engine became a product. The original mechanism faded, but the company's air-assisted direct injection escaped the prototype and quietly appeared in practical marine and small-engine applications.",
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
    spec: "All-alloy 60° V6, DOHC, 24 valves, variable cam timing, 2.8–3.6 litres. Over 200,000 engineering hours and 143 experimental engines went into localising it.",
    legacy:
      "More than 10 million engines built at Port Melbourne before the plant closed in 2016 — nearly half of them exported. The end of Australian volume engine manufacturing.",
    lore: "Crates of Fishermans Bend V6s left Australia wearing no Holden badge at all, bound for global GM brands. The final engine in 2016 closed a manufacturing lineage that had begun with the Grey Motor sixty-eight years earlier.",
  },
];

const commons = (
  file: string,
  alt: string,
  caption: string,
  sourceUrl: string,
  credit: string,
  license: string,
  kind: "photo" | "archive" = "photo"
): EngineMediaImage => ({
  src: `/ausengine/media/${file}.webp`,
  alt,
  caption,
  sourceUrl,
  credit,
  license,
  kind,
});

const BRABHAM_PORTRAIT = commons(
  "person-brabham",
  "Jack Brabham in 1966",
  "Jack Brabham during the Repco-powered 1966 championship season.",
  "https://commons.wikimedia.org/wiki/File:BrabhamJack1966B.jpg",
  "Lothar Spurzem",
  "CC BY-SA 2.0 de"
);

const WACKETT_PORTRAIT = commons(
  "person-wackett",
  "Portrait of Lawrence Wackett",
  "Sir Lawrence Wackett, founder and long-serving manager of CAC.",
  "https://commons.wikimedia.org/wiki/File:Portrait_of_Lawrence_Wackett.jpg",
  "E. A. Crome collection",
  "Public domain"
);

export const ENGINE_MEDIA: Record<string, EngineMedia> = {
  "holden-grey": {
    images: [
      commons(
        "holden-grey-history",
        "1948 launch of the Holden 48-215",
        "The 1948 Holden 48-215 launch. Every first Holden carried the 2.2-litre Grey Motor.",
        "https://commons.wikimedia.org/wiki/File:Queensland_launch_of_the_Holden_48-215_at_Eagers_Motors,_Brisbane,_1948.jpg",
        "State Library Queensland",
        "Public domain",
        "archive"
      ),
    ],
    people: [
      {
        name: "Sir Laurence Hartnett",
        role: "GM-Holden managing director",
        contribution:
          "Championed the all-Australian car programme that became the 48-215 and its locally manufactured Grey Motor.",
      },
    ],
  },
  "holden-red": {
    images: [
      commons(
        "holden-red",
        "Holden 149 cubic-inch Red Motor",
        "A 149 cu in Red Motor, the first capacity offered in the 1963 EH Holden.",
        "https://commons.wikimedia.org/wiki/File:Holden_149_Red_motor.jpg",
        "NJM2010",
        "CC BY 3.0"
      ),
    ],
    people: [
      {
        name: "Ed Silins",
        role: "GM-Holden engine project engineer",
        contribution:
          "Led the clean-sheet Red Motor design, replacing the Grey with seven main bearings and a modern oiling system.",
      },
    ],
  },
  "chrysler-hemi6": {
    images: [
      commons(
        "chrysler-hemi6",
        "Chrysler Australia Hemi-6 engine",
        "The Australian Hemi-6, with its US Slant-Six predecessor visible behind it.",
        "https://commons.wikimedia.org/wiki/File:Chrysler_Australia_Hemi_six_cylinder_engine_(5053237639).jpg",
        "sv1ambo",
        "CC BY 2.0"
      ),
    ],
    people: [
      {
        name: "Maurice Harcus and team",
        role: "Chrysler Australia engineers",
        contribution:
          "A five-person Adelaide team led by Harcus turned Chrysler's abandoned D-engine programme into the production Hemi-6.",
      },
    ],
  },
  "ford-crossflow": {
    images: [],
    people: [
      {
        name: "Ford Australia powertrain team",
        role: "Geelong engine engineering",
        contribution:
          "Reworked the long-running Falcon six around an Australian crossflow cylinder head, then developed alloy-head and EFI versions.",
      },
    ],
  },
  "ford-barra": {
    images: [
      commons(
        "ford-barra",
        "Ford Barra 245T turbo engine",
        "A Barra 245T installed in a BF Falcon XR6 Turbo.",
        "https://commons.wikimedia.org/wiki/File:Barra_245T_Engine.JPG",
        "Redback",
        "Public domain"
      ),
      commons(
        "ford-barra-270t",
        "Ford Barra 270T turbo engine",
        "The higher-output Barra 270T installed in an FPV F6 Typhoon.",
        "https://commons.wikimedia.org/wiki/File:Barra_270T.jpg",
        "RB30DE",
        "CC BY-SA 3.0"
      ),
      commons(
        "ford-barra-190",
        "Ford Barra 190 naturally aspirated engine",
        "A naturally aspirated Barra 190 in a BF Falcon XL Series II ute.",
        "https://commons.wikimedia.org/wiki/File:Ford_Barra_190_inline-six_engine.jpg",
        "Zzrbiker",
        "CC BY-SA 4.0"
      ),
    ],
    people: [
      {
        name: "Ford Australia and Tickford engineers",
        role: "Barra development team",
        contribution:
          "Modernised the Falcon six with a 24-valve twin-cam head; Gordon Barfield led the small Tickford group behind the landmark turbo version.",
      },
    ],
  },
  "holden-v8": {
    images: [
      commons(
        "holden-v8",
        "Holden 308 V8 engine",
        "A Holden 308 at the National Holden Motor Museum in Echuca.",
        "https://commons.wikimedia.org/wiki/File:308_cu_in_Holden_V8_engine_(2015-08-29)_01.jpg",
        "OSX",
        "Public domain"
      ),
      commons(
        "holden-v8-02",
        "Holden 308 V8 from the front quarter",
        "A second museum view showing the 308's front dress and intake layout.",
        "https://commons.wikimedia.org/wiki/File:308_cu_in_Holden_V8_engine_(2015-08-29)_02.jpg",
        "OSX",
        "Public domain"
      ),
      commons(
        "holden-v8-03",
        "Holden 308 V8 from the rear quarter",
        "The same Holden-built 308 viewed from the opposite side.",
        "https://commons.wikimedia.org/wiki/File:308_cu_in_Holden_V8_engine_(2015-08-29)_03.jpg",
        "OSX",
        "Public domain"
      ),
    ],
    people: [
      {
        name: "Fred James and Ed Silins",
        role: "GM-Holden engine designers",
        contribution:
          "Led the local design programme from 1965, combining the best lessons from contemporary GM V8s into Holden's own lighter engine.",
      },
    ],
  },
  "ford-cleveland": {
    images: [
      commons(
        "ford-cleveland",
        "Ford 351 Cleveland bare engine block",
        "A bare 351 Cleveland block showing its cylinder banks and deep-skirt casting.",
        "https://commons.wikimedia.org/wiki/File:Clevelandblock.jpg",
        "Nick Johns",
        "Public domain"
      ),
    ],
    people: [
      {
        name: "Ford Australia powertrain team",
        role: "Geelong foundry and engine plant",
        contribution:
          "Kept the Cleveland family alive after US production ended, casting Australian 302C and 351C blocks for local and export use.",
      },
    ],
  },
  "leyland-p76-v8": {
    images: [
      commons(
        "leyland-p76-v8",
        "Leyland P76 V8 engine bay",
        "The Australian 4.4-litre alloy V8 installed in a Leyland P76.",
        "https://commons.wikimedia.org/wiki/File:Leyland_P76_at_BVRC_Australia_day_rally.JPG",
        "NJM2010",
        "GFDL"
      ),
    ],
    people: [
      {
        name: "Leyland Australia engineering team",
        role: "Zetland vehicle and powertrain engineers",
        contribution:
          "Raised the deck and lengthened the stroke of the Rover-derived alloy V8 to create the P76's uniquely Australian 4.4-litre version.",
      },
    ],
  },
  "repco-rb620": {
    images: [
      commons(
        "repco-rb620",
        "Repco V8 in a Brabham BT24",
        "A Repco V8 installed in the rear of a Brabham BT24 grand-prix car.",
        "https://commons.wikimedia.org/wiki/File:Repco_engine_in_the_back_of_the_Brabham_BT24_(14665364245).jpg",
        "Ben Sutherland",
        "CC BY 2.0"
      ),
    ],
    people: [
      {
        name: "Phil Irving",
        role: "Engine designer",
        contribution:
          "Designed the light, reliable SOHC Repco V8 around the Oldsmobile alloy block — the pragmatic engine that won 1966.",
      },
      {
        name: "Sir Jack Brabham",
        role: "Driver, constructor and programme instigator",
        contribution:
          "Saw the opportunity in the new 3-litre rules, brought Repco into the project and won the title in the car bearing his name.",
        portrait: BRABHAM_PORTRAIT,
      },
    ],
  },
  "repco-rb740": {
    images: [
      commons(
        "repco-quadcam",
        "Repco-Brabham 760-series quad-cam V8",
        "A closely related Repco 760-series quad-cam V8; no verified reusable RB740 photograph was available.",
        "https://commons.wikimedia.org/wiki/File:Repco_Brabham_760_series_V8.JPG",
        "GTHO",
        "CC BY-SA 3.0",
        "archive"
      ),
    ],
    people: [
      {
        name: "Repco-Brabham engine team",
        role: "Maidstone design and development",
        contribution:
          "Advanced the championship V8 into a purpose-cast, four-cam, 32-valve engine as Formula One's power race accelerated.",
      },
    ],
  },
  "waggott-tc4v": {
    images: [],
    people: [
      {
        name: "Merv Waggott",
        role: "Designer and engine builder",
        contribution:
          "Designed and built the TC-4V's twin-cam four-valve head and developed the complete racing engine in Sydney.",
      },
    ],
  },
  "jabiru-3300": {
    images: [
      commons(
        "jabiru-3300",
        "Jabiru 3300 flat-six aircraft engine",
        "A Jabiru 3300: compact, direct-drive and machined for small-batch production.",
        "https://commons.wikimedia.org/wiki/File:Jabiru3300.jpg",
        "FlugKerl2",
        "CC BY-SA 3.0"
      ),
      commons(
        "jabiru-3300-bottom",
        "Underside of a Jabiru 3300 aircraft engine",
        "The 3300 from below, exposing its opposed cylinders, exhausts and compact crankcase.",
        "https://commons.wikimedia.org/wiki/File:Jabiru3300bottom.jpg",
        "FlugKerl2",
        "CC BY-SA 3.0"
      ),
    ],
    people: [
      {
        name: "Rod Stiff",
        role: "Jabiru founder and designer",
        contribution:
          "Led Jabiru's aircraft and engine design from Bundaberg, creating the 2200 and modular six-cylinder 3300 after imported supplies disappeared.",
      },
    ],
  },
  "rotec-r3600": {
    images: [],
    people: [
      {
        name: "Matthew and Paul Chernikeeff",
        role: "Rotec founders and engine designers",
        contribution:
          "Designed the modern R2800 and R3600 radial engines and returned new-production radial craftsmanship to Australian aviation.",
      },
    ],
  },
  "cac-avon": {
    images: [
      commons(
        "cac-avon",
        "Rolls-Royce Avon turbojet at Temora Aviation Museum",
        "An Avon turbojet displayed at Temora — the engine type CAC licence-built in Melbourne.",
        "https://commons.wikimedia.org/wiki/File:Rolls-Royce_Avon_jet_engine_(Temora).jpg",
        "Peter Ellis",
        "CC BY-SA 3.0"
      ),
      commons(
        "cac-avon-mk203",
        "Rolls-Royce Avon Mk 203 turbojet",
        "A preserved Avon Mk 203 showing the long axial-compressor casing shared by the engine family.",
        "https://commons.wikimedia.org/wiki/File:Rolls_Royce_Avon_Mk203_Jet_Engine._(48827497941).jpg",
        "Mohit S",
        "CC BY 2.0"
      ),
    ],
    people: [
      {
        name: "Sir Lawrence Wackett",
        role: "CAC founder and manager",
        contribution:
          "Built the Australian aircraft-manufacturing institution that later produced Avon turbojets under licence at Fishermans Bend.",
        portrait: WACKETT_PORTRAIT,
      },
    ],
  },
  "cac-twin-wasp": {
    images: [
      commons(
        "cac-twin-wasp",
        "Pratt and Whitney R-1830 Twin Wasp engine",
        "An R-1830 Twin Wasp of the same type licence-built in Australia for wartime Beaufort production.",
        "https://commons.wikimedia.org/wiki/File:Pratt_%26_Whitney_R-1830_S1C3G_Twin_Wasp_2009-07-03.jpg",
        "Myllyre",
        "CC BY-SA 3.0"
      ),
      commons(
        "cac-twin-wasp-side",
        "Side view of an R-1830 Twin Wasp",
        "A side view revealing the Twin Wasp's two cylinder rows and dense cooling-fin geometry.",
        "https://commons.wikimedia.org/wiki/File:Pratt_and_Whitney_R1830_Twin_Wasp_side.jpg",
        "Wikimedia Commons contributor",
        "CC BY-SA 3.0"
      ),
      commons(
        "cac-twin-wasp-detail",
        "R-1830 Twin Wasp cylinder detail",
        "A close view of the R-1830-36's cylinder heads, pushrods and ignition leads.",
        "https://commons.wikimedia.org/wiki/File:Pratt_%26_Whitney_R-1830-36_Twin_Wasp_(detail).jpg",
        "Alex Layzell",
        "CC BY 2.0"
      ),
    ],
    people: [
      {
        name: "Sir Lawrence Wackett",
        role: "CAC founder and manager",
        contribution:
          "Led CAC as it established Australian radial-engine manufacturing capability under wartime pressure.",
        portrait: WACKETT_PORTRAIT,
      },
    ],
  },
  "ronaldson-austral": {
    images: [],
    people: [
      {
        name: "William Ronaldson and Alfred Tippett",
        role: "Company founders",
        contribution:
          "Built Ronaldson Bros. & Tippett into one of the southern hemisphere's largest makers of agricultural and stationary engines.",
      },
    ],
  },
  "southern-cross": {
    images: [],
    people: [
      {
        name: "Toowoomba Foundry engineers",
        role: "Southern Cross design and manufacturing team",
        contribution:
          "Developed petrol, kerosene and diesel engines alongside the firm's windmills, pumps and other rural machinery.",
      },
    ],
  },
  "sarich-orbital": {
    images: [
      commons(
        "sarich-patent",
        "Patent drawing of the Sarich orbital engine",
        "Ralph Sarich's public-domain US patent drawing — an archival view of the real orbital mechanism.",
        "https://commons.wikimedia.org/wiki/File:Sarich_orbital_engine_patent_drawing.jpeg",
        "United States Patent and Trademark Office",
        "Public domain",
        "archive"
      ),
      commons(
        "sarich-patent-fig3",
        "Sarich orbital engine patent figure 3",
        "A second patent figure showing the orbital mechanism in a sectional engineering view.",
        "https://commons.wikimedia.org/wiki/File:US3787150-3.png",
        "Ralph Sarich",
        "Public domain",
        "archive"
      ),
    ],
    people: [
      {
        name: "Ralph Sarich",
        role: "Inventor and Orbital Engine Company founder",
        contribution:
          "Invented the orbital engine and led its development before the company pivoted its work into successful direct-injection technology.",
      },
    ],
  },
  "holden-alloytec": {
    images: [
      commons(
        "holden-alloytec",
        "Holden Alloytec V6 in a VZ Commodore",
        "A 3.6-litre Alloytec V6 installed in a 2006 VZ Commodore.",
        "https://commons.wikimedia.org/wiki/File:Alloytec_V6_engine_of_a_2006_Holden_VZ_Commodore_SVZ_01.jpg",
        "Senators at English Wikipedia",
        "Public domain"
      ),
      commons(
        "holden-alloytec-lpg",
        "LPG Holden Alloytec V6",
        "An LPG-fuelled Alloytec installation in a VE Commodore.",
        "https://commons.wikimedia.org/wiki/File:Alloytec_V6_(LPG)_engine_of_a_2006-2008_Holden_VE_Commodore_1.jpg",
        "PoweredByCNG",
        "CC BY-SA 3.0"
      ),
      commons(
        "holden-alloytec-powertrain",
        "Holden Alloytec 190 V6 and automatic transmission",
        "A museum display pairing the Alloytec 190 with GM's five-speed automatic transmission.",
        "https://commons.wikimedia.org/wiki/File:3564_cc_Holden_Alloytec_190_V6_engine_with_5-speed_GM_5L40-E_automatic_transmission_(2015-08-29)_02.jpg",
        "OSX",
        "Public domain"
      ),
    ],
    people: [
      {
        name: "GM Holden Powertrain engineers",
        role: "Fishermans Bend development and manufacturing team",
        contribution:
          "Co-developed, localised and mass-produced GM's High Feature V6 for Australian vehicles and a worldwide export programme.",
      },
    ],
  },
};

export function engineById(id: string): Engine {
  return ENGINES.find(e => e.id === id) || ENGINES[0];
}

export function engineMediaById(id: string): EngineMedia {
  return ENGINE_MEDIA[id] || { images: [], people: [] };
}
