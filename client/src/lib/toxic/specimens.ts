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
  | "protozoan"
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
  protozoan: "Protozoan / amoeba",
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
      "The classic public-health detective case: swab the throat, culture the diplococci on chocolate agar, serogroup them (A, B, C, W, Y), then ring-fence the outbreak with contact tracing and prophylactic antibiotics before it spreads.",
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
    spread: "The faecal–oral route — contaminated drinking water and food.",
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
  {
    id: "tuberculosis",
    name: "Tuberculosis",
    latin: "Mycobacterium tuberculosis",
    kind: "bacterium",
    sizeM: 3e-6,
    sizeLabel: "2–4 µm",
    color: "#f08b72",
    color2: "#7b261f",
    tagline: "Acid-fast waxy rods — tuberculosis",
    danger:
      "Usually attacks the lungs but can spread through the body. Untreated active TB can be fatal, and drug-resistant strains remain one of the world's hardest infectious killers to control.",
    spread:
      "Airborne particles released when a person with active pulmonary TB coughs, speaks or sings; prolonged indoor exposure carries the greatest risk.",
    detective:
      "Contact tracing works outward from an infectious case, combining chest imaging, sputum microscopy, culture and rapid molecular resistance tests to find both active and latent infection.",
  },
  {
    id: "pneumococcus",
    name: "Pneumococcus",
    latin: "Streptococcus pneumoniae",
    kind: "bacterium",
    sizeM: 0.8e-6,
    sizeLabel: "0.5–1.2 µm",
    color: "#b7b2f0",
    color2: "#514a9b",
    tagline: "Lance-shaped diplococci — pneumonia & meningitis",
    danger:
      "Often carried harmlessly in the nose, but invasive pneumococcal disease can cause pneumonia, meningitis and bloodstream infection — severe illness can be fatal.",
    spread:
      "Respiratory droplets and close contact, especially where children or vulnerable adults share indoor spaces.",
    detective:
      "Culture, antigen and molecular typing connect cases, while capsule serotyping shows whether a vaccine-covered strain is moving through a community.",
  },
  {
    id: "tetanus",
    name: "Tetanus",
    latin: "Clostridium tetani",
    kind: "bacterium",
    sizeM: 4e-6,
    sizeLabel: "2–5 µm",
    color: "#c7d69a",
    color2: "#4c6322",
    tagline: "Terminal-spore rods — lockjaw",
    danger:
      "Its neurotoxin blocks inhibitory nerve signals, causing rigid spasms, lockjaw and respiratory failure. Tetanus can be fatal even with intensive care.",
    spread:
      "Dormant spores in soil, dust and manure enter cuts or puncture wounds. It is not normally transmitted person-to-person.",
    detective:
      "The source is usually environmental rather than another patient: inspect the wound and vaccination history, treat immediately, and prevent the next case with immunisation and safe wound care.",
  },
  {
    id: "ecoli",
    name: "E. coli",
    latin: "Escherichia coli",
    kind: "bacterium",
    sizeM: 2e-6,
    sizeLabel: "1–3 µm",
    color: "#e4a0bc",
    color2: "#7d2850",
    tagline: "Flagellated gut rods — harmless neighbours and dangerous strains",
    danger:
      "Most strains are part of a healthy gut, but toxin-producing E. coli can cause bloody diarrhoea and haemolytic uraemic syndrome, including kidney failure.",
    spread:
      "Contaminated food or water, livestock contact, surfaces and person-to-person faecal–oral transmission.",
    detective:
      "Investigators compare genetic fingerprints from patients, food, farms and processing lines to locate a shared source and remove it from the supply chain.",
  },
  {
    id: "salmonella",
    name: "Salmonella",
    latin: "Salmonella enterica",
    kind: "bacterium",
    sizeM: 3e-6,
    sizeLabel: "2–5 µm",
    color: "#efb68b",
    color2: "#8d3b1f",
    tagline: "Motile food-borne rods — gastroenteritis & enteric fever",
    danger:
      "Usually causes fever, cramps and diarrhoea, but infection can enter the bloodstream and become fatal in infants, older adults and immunocompromised people.",
    spread:
      "Food, reptiles and other animals, contaminated surfaces, and faecal–oral transmission.",
    detective:
      "Whole-genome sequencing links scattered cases to the same food factory, farm, restaurant or animal source — often before the product trail is obvious.",
  },
  {
    id: "listeria",
    name: "Listeria",
    latin: "Listeria monocytogenes",
    kind: "bacterium",
    sizeM: 1.5e-6,
    sizeLabel: "1–2 µm",
    color: "#a8c9d9",
    color2: "#2d647c",
    tagline: "Cold-tolerant food-borne rods — invasive listeriosis",
    danger:
      "Can invade the bloodstream and brain. It is especially dangerous during pregnancy and for newborns, older adults and people with weakened immunity.",
    spread:
      "Ready-to-eat refrigerated foods, unpasteurised dairy and contaminated processing environments; unlike many bacteria it can multiply in the fridge.",
    detective:
      "Long incubation makes the trail difficult: patient genomes are matched to food and factory isolates, then investigators work backwards through months of shopping and production records.",
  },
  {
    id: "cdiff",
    name: "C. difficile",
    latin: "Clostridioides difficile",
    kind: "bacterium",
    sizeM: 4e-6,
    sizeLabel: "3–5 µm",
    color: "#d9c27a",
    color2: "#6f5313",
    tagline: "Hardy spores — healthcare-associated colitis",
    danger:
      "Antibiotics can clear protective gut bacteria and let C. difficile toxins inflame the colon. Severe disease can cause toxic megacolon, sepsis and death.",
    spread:
      "Microscopic faecal spores persist for months on hands, toilets, bed rails and hospital surfaces; ordinary alcohol rub does not reliably kill them.",
    detective:
      "Hospitals trace room movements, antibiotic exposure and strain genomes, then break transmission with soap-and-water handwashing, sporicidal cleaning and isolation.",
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
      "The spike protein latches onto ACE2 receptors in your airways; the virus hijacks your cells to copy itself. COVID-19 severity ranges from no symptoms to fatal multi-organ disease.",
    spread: "Airborne respiratory aerosols and droplets, especially indoors.",
    detective:
      "Genomic detective work in real time: sequence the virus, track mutations into named variants, and trace transmission chains worldwide within days of a new case.",
  },
  {
    id: "influenza",
    name: "Influenza",
    latin: "Influenza A virus",
    kind: "virus",
    sizeM: 100e-9,
    sizeLabel: "80–120 nm",
    color: "#a8c5e8",
    color2: "#315d91",
    tagline: "A shifting envelope of spikes — seasonal and pandemic flu",
    danger:
      "Most infections are self-limited, but influenza can cause fatal viral or secondary bacterial pneumonia, especially in older people, infants, pregnant people and those with chronic illness.",
    spread:
      "Airborne particles, respiratory droplets and contaminated hands or surfaces, with rapid spread in crowded indoor settings.",
    detective:
      "Laboratories sample circulating strains year-round, map antigenic drift and watch animal reservoirs for reassortment — the evidence used to update each season's vaccine.",
  },
  {
    id: "hepatitis-b",
    name: "Hepatitis B",
    latin: "Hepatitis B virus",
    kind: "virus",
    sizeM: 42e-9,
    sizeLabel: "42 nm",
    color: "#d3b7e8",
    color2: "#63368c",
    tagline: "The tiny Dane particle — chronic liver infection",
    danger:
      "Acute infection can be severe; chronic infection silently scars the liver for years and can lead to cirrhosis, liver failure and liver cancer.",
    spread:
      "Blood, sexual contact, shared needles and from mother to baby during birth.",
    detective:
      "Antigen and antibody patterns reveal whether infection is new, chronic, resolved or vaccine-derived; contact tracing and birth-dose vaccination close the chain.",
  },
  {
    id: "hepatitis-c",
    name: "Hepatitis C",
    latin: "Hepatitis C virus",
    kind: "virus",
    sizeM: 55e-9,
    sizeLabel: "50–60 nm",
    color: "#d8c79d",
    color2: "#806018",
    tagline: "An enveloped liver virus — often silent for decades",
    danger:
      "Most infections become chronic. Untreated hepatitis C can progress to cirrhosis, liver failure and liver cancer, although modern antiviral tablets cure most cases.",
    spread:
      "Blood-to-blood contact, especially shared injecting equipment or inadequately sterilised medical equipment.",
    detective:
      "Antibody screening finds exposure; PCR proves active infection. Investigators trace unsafe equipment and blood networks while treatment removes people from the transmission chain.",
  },
  {
    id: "dengue",
    name: "Dengue virus",
    latin: "Dengue virus",
    kind: "virus",
    sizeM: 50e-9,
    sizeLabel: "~50 nm",
    color: "#d2b76f",
    color2: "#6f4d0e",
    tagline: "An icosahedral flavivirus — breakbone fever",
    danger:
      "Most infections recover, but severe dengue can make blood vessels leak, causing bleeding, shock and organ failure. A second infection with another serotype can raise the risk.",
    spread:
      "Bites from infected Aedes mosquitoes, particularly Aedes aegypti in tropical and subtropical towns.",
    detective:
      "Teams map cases against mosquito breeding sites, identify the viral serotype, and target containers and neighbourhoods before the next generation of mosquitoes emerges.",
  },
  {
    id: "mers",
    name: "MERS coronavirus",
    latin: "Middle East respiratory syndrome coronavirus",
    kind: "virus",
    sizeM: 125e-9,
    sizeLabel: "~125 nm",
    color: "#a5c6cf",
    color2: "#a14d31",
    tagline: "A camel-linked coronavirus — severe respiratory disease",
    danger:
      "Can cause pneumonia, respiratory failure and death, particularly in older people or those with underlying illness.",
    spread:
      "Close contact with infected dromedary camels and limited person-to-person respiratory spread, especially in healthcare settings.",
    detective:
      "Investigators connect hospital clusters with camel exposure using interviews and viral genomes, then strengthen isolation and infection control around each chain.",
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
    id: "marburg",
    name: "Marburg virus",
    latin: "Marburg marburgvirus",
    kind: "virus",
    sizeM: 900e-9,
    sizeLabel: "~0.9 µm long",
    color: "#c6d3bd",
    color2: "#663525",
    tagline: "A filamentous filovirus — Marburg virus disease",
    danger:
      "Causes a severe haemorrhagic fever with shock and organ failure. Fatality varies by outbreak and can be very high.",
    spread:
      "Initial exposure can involve Egyptian fruit bats; human transmission follows through direct contact with blood and other body fluids.",
    detective:
      "The first recognised outbreak followed infected laboratory monkeys in 1967. Modern teams trace cave, funeral, household and healthcare contacts around every case.",
  },
  {
    id: "nipah",
    name: "Nipah virus",
    latin: "Nipah henipavirus",
    kind: "virus",
    sizeM: 160e-9,
    sizeLabel: "150–190 nm",
    color: "#b6cbbd",
    color2: "#5b315f",
    tagline: "A bat-borne paramyxovirus — encephalitis",
    danger:
      "Can cause rapidly progressive brain inflammation and severe respiratory disease. Reported outbreak fatality has ranged roughly from 40% to 75%.",
    spread:
      "Fruit bats, contaminated raw date-palm sap or fruit, infected animals, and close person-to-person contact.",
    detective:
      "Outbreak teams connect encephalitis cases to shared sap, farms, hospitals and bat feeding sites, then monitor every close contact through the incubation period.",
  },
  {
    id: "hantavirus",
    name: "Hantavirus",
    latin: "Sin Nombre orthohantavirus",
    kind: "virus",
    sizeM: 100e-9,
    sizeLabel: "80–120 nm",
    color: "#c8b59b",
    color2: "#6b3f2b",
    tagline: "A rodent-borne envelope — pulmonary syndrome",
    danger:
      "Hantavirus pulmonary syndrome can begin like flu and then rapidly flood the lungs, causing respiratory failure and death.",
    spread:
      "Breathing dust contaminated with infected rodent urine, droppings or saliva; person-to-person spread is unusual for most hantaviruses.",
    detective:
      "The trail runs through cabins, sheds and rodent infestations: investigators pair exposure histories with rodent trapping and viral testing to identify the reservoir.",
  },
  {
    id: "lassa",
    name: "Lassa virus",
    latin: "Lassa mammarenavirus",
    kind: "virus",
    sizeM: 120e-9,
    sizeLabel: "80–150 nm",
    color: "#b6b8c4",
    color2: "#5a323b",
    tagline: "A grainy arenavirus — Lassa fever",
    danger:
      "Many infections are mild, but severe Lassa fever can cause bleeding, shock, organ failure and permanent hearing loss; pregnancy carries particular risk.",
    spread:
      "Food or household items contaminated by multimammate-rat urine or faeces, and direct contact with infected body fluids.",
    detective:
      "Teams inspect grain storage and rodent exposure while tracing household and healthcare contacts, with laboratory confirmation separating Lassa from malaria and other fevers.",
  },
  {
    id: "cchf",
    name: "Crimean-Congo fever",
    latin: "Crimean-Congo haemorrhagic fever virus",
    kind: "virus",
    sizeM: 95e-9,
    sizeLabel: "80–120 nm",
    color: "#b9c7a2",
    color2: "#6d281f",
    tagline: "A tick-borne nairovirus — haemorrhagic fever",
    danger:
      "Can progress from fever to widespread bleeding, shock and organ failure. Fatality can be high and healthcare outbreaks are a serious risk.",
    spread:
      "Hyalomma ticks, blood or tissues from infected livestock, and direct contact with an infected person's body fluids.",
    detective:
      "Investigators map tick exposure, abattoirs, farms and hospital contacts while using protective isolation to stop the virus moving from livestock into care teams.",
  },
  {
    id: "mpox",
    name: "Mpox",
    latin: "Monkeypox virus",
    kind: "virus",
    sizeM: 250e-9,
    sizeLabel: "200–250 nm",
    color: "#cfb9a1",
    color2: "#70462e",
    tagline: "A brick-shaped poxvirus — mpox",
    danger:
      "Usually resolves, but painful lesions, secondary infection and severe disease can occur, particularly with immune suppression or more virulent strains.",
    spread:
      "Direct skin-to-skin contact, lesions and body fluids, respiratory secretions during close contact, and contaminated fabrics or objects.",
    detective:
      "Lesion swabs and sequencing confirm the virus; contact tracing follows intimate, household and event networks while vaccination can protect close contacts.",
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
      "Historically spread through respiratory droplets, direct contact with rash material, and contaminated bedding or clothing. It no longer circulates naturally.",
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
    spread: "Blood, sexual contact, and mother-to-child transmission.",
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
  {
    id: "cjd",
    name: "Creutzfeldt-Jakob disease",
    latin: "Sporadic CJD prion",
    kind: "prion",
    sizeM: 20e-9,
    sizeLabel: "~20 nm aggregate",
    color: "#d8c592",
    color2: "#765014",
    tagline: "A self-copying protein fold — rapidly fatal dementia",
    danger:
      "CJD destroys brain tissue, causing rapidly progressive dementia, loss of coordination and death. It is nearly always fatal, usually within a year of onset.",
    spread:
      "Most cases arise sporadically and are not contagious through ordinary contact; rare transmission has involved contaminated tissue, instruments or inherited mutations.",
    detective:
      "Diagnosis combines clinical progression, MRI, spinal-fluid protein-seeding tests and infection-control history — investigating an agent that leaves no DNA or RNA to sequence.",
  },
  {
    id: "kuru",
    name: "Kuru",
    latin: "Transmissible spongiform encephalopathy",
    kind: "prion",
    sizeM: 20e-9,
    sizeLabel: "~20 nm aggregate",
    color: "#cbbd8b",
    color2: "#6d4318",
    tagline: "A historical human prion epidemic — now essentially extinct",
    danger:
      "Kuru caused tremor, loss of coordination, emotional changes and inevitable death among the Fore people of Papua New Guinea.",
    spread:
      "Historically transmitted through mortuary cannibalism involving infected brain tissue; the practice ended and the disease has almost disappeared.",
    detective:
      "Its decades-long incubation helped prove that a non-living protein could transmit disease, and showed how changing one cultural practice could end an epidemic years later.",
  },
  // ---------------- protozoa & amoebae ----------------
  {
    id: "malaria",
    name: "Malaria parasite",
    latin: "Plasmodium falciparum",
    kind: "protozoan",
    sizeM: 1.5e-6,
    sizeLabel: "~1–2 µm ring stage",
    color: "#d85a58",
    color2: "#51202e",
    tagline: "A parasite inside red blood cells — severe malaria",
    danger:
      "P. falciparum multiplies inside red blood cells and can block small vessels in the brain and organs. Severe malaria can kill quickly, especially in young children and pregnancy.",
    spread:
      "Bites from infected female Anopheles mosquitoes; the parasite cycles between human liver, blood and mosquito.",
    detective:
      "Blood films and rapid antigen tests find the parasite, while case maps, mosquito surveillance and travel histories reveal where transmission is still active.",
  },
  {
    id: "balamuthia",
    name: "Balamuthia amoeba",
    latin: "Balamuthia mandrillaris",
    kind: "protozoan",
    sizeM: 35e-6,
    sizeLabel: "15–60 µm",
    color: "#cda879",
    color2: "#6d3f24",
    tagline: "A soil amoeba — rare granulomatous brain infection",
    danger:
      "Can cause granulomatous amoebic encephalitis, a slow but often fatal infection of the brain. Early symptoms are vague, making diagnosis difficult.",
    spread:
      "Probably enters through broken skin or inhaled dust from soil; it does not normally spread person-to-person.",
    detective:
      "Because cases are exceptionally rare, diagnosis relies on tissue microscopy and molecular tests, often after ordinary bacterial and viral causes have been excluded.",
  },
  {
    id: "naegleria",
    name: "Naegleria fowleri",
    latin: "Naegleria fowleri",
    kind: "protozoan",
    sizeM: 18e-6,
    sizeLabel: "10–35 µm",
    color: "#9bc6b2",
    color2: "#285e55",
    tagline: "A warm-water amoeba — primary amoebic meningitis",
    danger:
      "Once it reaches the brain it causes a rapidly destructive meningitis that is almost always fatal, although infection itself is extraordinarily rare.",
    spread:
      "Warm fresh water forced up the nose during swimming or nasal rinsing; swallowing the water does not cause infection and it is not spread person-to-person.",
    detective:
      "The crucial clue is recent freshwater exposure. Rapid microscopy and molecular testing distinguish it from bacterial meningitis while water systems are checked for heat and disinfection failures.",
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
    spread: "Wind-borne for hundreds of kilometres each autumn.",
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
    spread: "Released in vast clouds on warm, breezy days.",
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
    spread: "Wind-pollinated trees release it in early spring.",
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
      "Disease detectives spend their lives on the other side of this fight — growing these organisms in a Petri dish, identifying them, and tracing communicable diseases back to their source to stop them spreading.",
  },
];

export function specimenById(id: string): Specimen {
  return SPECIMENS.find(s => s.id === id) || SPECIMENS[0];
}
