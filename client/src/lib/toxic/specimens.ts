// The /toxic catalogue: dangerous pathogens, allergenic pollens, and human
// reference specimens. Each entry carries the data needed by all three views —
// the 3D model builder, the microscope / Petri renderer, and the powers-of-ten
// scale ruler — plus the "disease detective" story behind it.
//
// `sizeM` is the characteristic real-world size in metres (used only by the
// Scale view); the 3D and microscope views normalise each specimen to fit.

export type SpecimenKind =
  | "bacterium"
  | "virus"
  | "prion"
  | "fungus"
  | "pollen"
  | "human";

export interface Specimen {
  id: string;
  name: string;
  latin?: string;
  kind: SpecimenKind;
  sizeM: number; // characteristic size, metres
  sizeLabel: string; // human-readable, e.g. "0.8 µm"
  color: string; // primary surface colour
  color2: string; // accent colour
  tagline: string;
  danger: string; // what it does to the body
  spread: string; // how it gets around
  detective: string; // how it's traced / contained
}

export const KIND_LABEL: Record<SpecimenKind, string> = {
  bacterium: "Bacterium",
  virus: "Virus",
  prion: "Prion",
  fungus: "Fungus",
  pollen: "Pollen",
  human: "You",
};

// Order groups them: bacteria, viruses, prion, fungus, pollens, then human.
export const SPECIMENS: Specimen[] = [
  // ---------------- bacteria ----------------
  {
    id: "meningococcus",
    name: "Meningococcus",
    latin: "Neisseria meningitidis",
    kind: "bacterium",
    sizeM: 0.8e-6,
    sizeLabel: "0.8 µm",
    color: "#e7b3c2",
    color2: "#8d2f4d",
    tagline: "Paired 'coffee-bean' cocci — meningitis & septicaemia",
    danger:
      "Colonises the throat harmlessly in many people, but when it crosses into the blood and the lining of the brain it causes meningococcal disease — meningitis and septicaemia that can kill a healthy person within hours.",
    spread:
      "Respiratory droplets and close contact — coughing, kissing, crowded living. Outbreaks cluster in dormitories and barracks.",
    detective:
      "The classic public-health detective case: swab the throat, culture the diplococci on chocolate agar, serogroup them (A, B, C, W, Y), then ring-fence the outbreak with contact tracing and prophylactic antibiotics before it spreads. This was the kind of organism Tim's father grew, identified, and chased back to its source.",
  },
  {
    id: "anthrax",
    name: "Anthrax",
    latin: "Bacillus anthracis",
    kind: "bacterium",
    sizeM: 4e-6,
    sizeLabel: "1 × 4 µm",
    color: "#cdd6df",
    color2: "#6b7785",
    tagline: "Spore-forming rods in chains — anthrax",
    danger:
      "Forms tough endospores that survive decades in soil. Inhaled spores germinate in the lungs and release toxins that flood the body — inhalational anthrax is frequently fatal.",
    spread:
      "Contact with infected livestock or contaminated hides/wool; spores can be weaponised as a fine powder (the 2001 letters).",
    detective:
      "Robert Koch built the germ theory itself on this organism — the first proof a specific microbe causes a specific disease. Tracing it means following spores back through animal hides, soil, and supply chains.",
  },
  {
    id: "plague",
    name: "Plague bacillus",
    latin: "Yersinia pestis",
    kind: "bacterium",
    sizeM: 1.5e-6,
    sizeLabel: "1.5 µm",
    color: "#d9c7a3",
    color2: "#4a3b22",
    tagline: "'Safety-pin' bipolar rods — the Black Death",
    danger:
      "Causes bubonic, septicaemic and pneumonic plague. Pneumonic plague spreads person-to-person and is almost always fatal untreated. It reshaped human history.",
    spread:
      "Bites from infected fleas carried by rodents; pneumonic form spreads by respiratory droplets.",
    detective:
      "A textbook zoonosis hunt: trace fleas to rats to humans, watch for die-offs in rodent populations as an early warning, and break the chain with rodent control and antibiotics.",
  },
  {
    id: "cholera",
    name: "Cholera",
    latin: "Vibrio cholerae",
    kind: "bacterium",
    sizeM: 2e-6,
    sizeLabel: "2–3 µm",
    color: "#bfe3d0",
    color2: "#1f6b53",
    tagline: "Comma-shaped, single flagellum — cholera",
    danger:
      "Its toxin makes the gut pour out litres of water; victims can die of dehydration in a day. Cholera epidemics still sweep through places with unsafe water.",
    spread:
      "The faecal–oral route — contaminated drinking water and food.",
    detective:
      "The birth of epidemiology: in 1854 John Snow mapped cholera deaths around a single Soho water pump and removed its handle — proving water, not 'bad air', carried the disease. The original trace-it-to-the-source story.",
  },
  {
    id: "botulinum",
    name: "Botulinum",
    latin: "Clostridium botulinum",
    kind: "bacterium",
    sizeM: 5e-6,
    sizeLabel: "1 × 5 µm",
    color: "#e6dcc0",
    color2: "#7a5a2e",
    tagline: "'Tennis-racket' spore rods — botulism",
    danger:
      "Makes botulinum toxin, the most poisonous substance known — a few hundred nanograms can kill by paralysing every muscle, including those you breathe with.",
    spread:
      "Spores grow in improperly canned or preserved food and in wounds, releasing the toxin.",
    detective:
      "Outbreak investigation at its sharpest: trace every case back to a shared meal or tin, pull the product, and give antitoxin fast. The same toxin, purified and micro-dosed, is Botox.",
  },
  // ---------------- viruses ----------------
  {
    id: "sarscov2",
    name: "SARS-CoV-2",
    latin: "Severe acute respiratory syndrome coronavirus 2",
    kind: "virus",
    sizeM: 120e-9,
    sizeLabel: "120 nm",
    color: "#9fb6e8",
    color2: "#c0392b",
    tagline: "Spike-studded 'corona' — COVID-19",
    danger:
      "The spike protein latches onto ACE2 receptors in your airways; the virus hijacks your cells to copy itself. Caused the COVID-19 pandemic and millions of deaths.",
    spread:
      "Airborne respiratory aerosols and droplets, especially indoors.",
    detective:
      "Genomic detective work in real time: sequence the virus, track mutations into named variants, and trace transmission chains worldwide within days of a new case.",
  },
  {
    id: "ebola",
    name: "Ebola virus",
    latin: "Zaire ebolavirus",
    kind: "virus",
    sizeM: 970e-9,
    sizeLabel: "~1 µm long",
    color: "#cfd3d6",
    color2: "#7d1d1d",
    tagline: "Filamentous 'shepherd's crook' — haemorrhagic fever",
    danger:
      "Causes severe haemorrhagic fever — high fevers, internal bleeding, organ failure — with case-fatality rates up to ~90% in outbreaks.",
    spread:
      "Direct contact with the blood and body fluids of the infected (and with the bodies of the dead).",
    detective:
      "Outbreak teams trace every contact of every case, map the chains, and break them with isolation and safe burials — fieldwork in full protective suits.",
  },
  {
    id: "smallpox",
    name: "Smallpox",
    latin: "Variola virus",
    kind: "virus",
    sizeM: 300e-9,
    sizeLabel: "300 nm",
    color: "#d8c9b0",
    color2: "#5a4326",
    tagline: "Brick-shaped poxvirus — eradicated 1980",
    danger:
      "Killed roughly a third of those it infected and scarred or blinded survivors for millennia.",
    spread:
      "Respiratory droplets and contact with scabs/fluids of the rash.",
    detective:
      "Humanity's greatest disease-detective victory: ring vaccination — vaccinate everyone around each new case — drove smallpox to extinction in the wild, the only human disease ever eradicated.",
  },
  {
    id: "rabies",
    name: "Rabies virus",
    latin: "Lyssavirus rabies",
    kind: "virus",
    sizeM: 180e-9,
    sizeLabel: "180 × 75 nm",
    color: "#c9b6dd",
    color2: "#3d2a5a",
    tagline: "Bullet-shaped neurotropic virus — rabies",
    danger:
      "Travels up the nerves to the brain. Once symptoms appear it is almost universally fatal — one of the deadliest infections known.",
    spread:
      "The bite of an infected mammal (dogs, bats, foxes) carries it in saliva.",
    detective:
      "Pasteur's triumph: a vaccine given after exposure but before symptoms still saves lives. Surveillance traces animal reservoirs to head off human cases.",
  },
  {
    id: "hiv",
    name: "HIV",
    latin: "Human immunodeficiency virus",
    kind: "virus",
    sizeM: 120e-9,
    sizeLabel: "120 nm",
    color: "#bcd0c4",
    color2: "#9b6a1f",
    tagline: "Knobbed retrovirus with a cone capsid — AIDS",
    danger:
      "Infects and destroys the immune system's CD4 T-cells; untreated it progresses to AIDS, leaving the body open to other infections.",
    spread:
      "Blood, sexual contact, and mother-to-child transmission.",
    detective:
      "Epidemiologists traced a mysterious cluster of immune collapse in the early 1980s to a new retrovirus — turning a fatal diagnosis into a manageable condition with antiretroviral therapy.",
  },
  // ---------------- prion ----------------
  {
    id: "prion",
    name: "BSE prion",
    latin: "PrP^Sc (misfolded prion protein)",
    kind: "prion",
    sizeM: 20e-9,
    sizeLabel: "~20 nm",
    color: "#e0cf9a",
    color2: "#8a5a16",
    tagline: "A misfolded protein — 'mad cow' disease",
    danger:
      "Not even alive — a misfolded protein that forces normal brain proteins to misfold too, riddling the brain with holes. Causes BSE in cattle and fatal vCJD in humans. Resists heat, radiation and disinfectant.",
    spread:
      "Eating infected nervous tissue; medical instruments that survived ordinary sterilisation.",
    detective:
      "A genuine detective mystery — an infectious agent with no genes. Tracing mad cow disease meant following contaminated cattle feed through the entire food chain and banning it.",
  },
  // ---------------- fungus ----------------
  {
    id: "deathcap",
    name: "Death cap spores",
    latin: "Amanita phalloides",
    kind: "fungus",
    sizeM: 9e-6,
    sizeLabel: "~9 µm",
    color: "#dfe6cf",
    color2: "#566b35",
    tagline: "Innocent-looking spores — the deadliest mushroom",
    danger:
      "Responsible for most fatal mushroom poisonings. Its amatoxins shut down the liver; symptoms arrive only after the damage is done.",
    spread:
      "Spores released from the gills; poisoning comes from eating the (deceptively ordinary-looking) mushroom.",
    detective:
      "A forensic-toxicology trace: identify the spores and toxin, find the foraging spot, and race antidotes against a poison with a delayed, deceptive onset.",
  },
  // ---------------- pollens ----------------
  {
    id: "ragweed",
    name: "Ragweed pollen",
    latin: "Ambrosia",
    kind: "pollen",
    sizeM: 20e-6,
    sizeLabel: "~20 µm",
    color: "#f2d98a",
    color2: "#a9791a",
    tagline: "Spiky 'echinate' grain — hay-fever heavyweight",
    danger:
      "Not an infection — an allergen. Its proteins trigger the immune system into sneezing, itching and asthma. A single plant puffs out a billion grains.",
    spread:
      "Wind-borne for hundreds of kilometres each autumn.",
    detective:
      "Aerobiologists run pollen traps and forecast counts so sufferers know when the air is thick with it — environmental detective work for the sneezing season.",
  },
  {
    id: "grasspollen",
    name: "Grass pollen",
    latin: "Poaceae",
    kind: "pollen",
    sizeM: 30e-6,
    sizeLabel: "~30 µm",
    color: "#e9e1a6",
    color2: "#8c7a1e",
    tagline: "Smooth single-pored grain — spring hay fever",
    danger:
      "The most common hay-fever trigger worldwide — itchy eyes, runny nose, and asthma flares through late spring and summer.",
    spread:
      "Released in vast clouds on warm, breezy days.",
    detective:
      "Pollen-count monitoring stations track the daily load so allergy seasons can be predicted and managed.",
  },
  {
    id: "birchpollen",
    name: "Birch pollen",
    latin: "Betula",
    kind: "pollen",
    sizeM: 22e-6,
    sizeLabel: "~22 µm",
    color: "#f0e6c8",
    color2: "#9a7b3a",
    tagline: "Three-pored grain — spring tree allergy",
    danger:
      "A major spring allergen; its main protein also cross-reacts with some foods (apples, hazelnuts), causing oral-allergy syndrome.",
    spread:
      "Wind-pollinated trees release it in early spring.",
    detective:
      "Tracked alongside other tree pollens in seasonal forecasts; the cross-reactivity is a neat bit of immunological detective work.",
  },
  // ---------------- human (you) ----------------
  {
    id: "dna",
    name: "Your DNA",
    latin: "Deoxyribonucleic acid",
    kind: "human",
    sizeM: 2e-9,
    sizeLabel: "2 nm wide",
    color: "#8fd3ff",
    color2: "#e85d9c",
    tagline: "The double helix — the code that is you",
    danger:
      "No threat — the opposite. Two metres of this, coiled into every one of your cells, is the instruction set that builds and runs you. The same chemistry of life that the pathogens here hijack or imitate.",
    spread:
      "Copied faithfully every time a cell divides, and passed half-and-half to your children.",
    detective:
      "The ultimate identification tool: DNA fingerprinting traces people, pathogens and outbreaks to their exact source — the molecular evidence at the heart of modern disease detection.",
  },
  {
    id: "cell",
    name: "Your cell",
    latin: "Human eukaryotic cell",
    kind: "human",
    sizeM: 10e-6,
    sizeLabel: "~10 µm",
    color: "#bfe0ff",
    color2: "#5a86b8",
    tagline: "One of your ~37 trillion cells",
    danger:
      "The basic unit of you — a membrane-bound world with a nucleus holding your DNA, mitochondria making energy, and machinery the viruses on this page evolved to hijack.",
    spread:
      "Divides to grow and heal you; specialised into every tissue in your body.",
    detective:
      "Comparing a healthy cell to an infected one is how pathologists spot disease down the microscope.",
  },
  {
    id: "human",
    name: "You",
    latin: "Homo sapiens",
    kind: "human",
    sizeM: 1.7,
    sizeLabel: "~1.7 m",
    color: "#d8c2a8",
    color2: "#1B3F6B",
    tagline: "The whole organism — for scale",
    danger:
      "The host. Everything else on this page is measured against you: a virus is to you roughly what you are to a continent. You are made of the same organic matter — just arranged, for now, in your favour.",
    spread:
      "Walks around, builds things, and occasionally carries the rest of this catalogue with it.",
    detective:
      "Tim's father spent his life on the other side of this fight — growing these organisms in a Petri dish, identifying them, and tracing communicable diseases back to their source to stop them spreading. This page is for him.",
  },
];

export function specimenById(id: string): Specimen {
  return SPECIMENS.find(s => s.id === id) || SPECIMENS[0];
}
