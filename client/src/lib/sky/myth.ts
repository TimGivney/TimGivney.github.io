// Constellation mythology / lore, keyed by the IAU 3-letter abbreviation, plus
// a handful of famous naked-eye asterisms. Kept deliberately short — a sentence
// or two of story you'd actually tell someone lying on the beach.

export interface Myth {
  name: string;
  story: string;
}

export const CONSTELLATION_MYTH: Record<string, Myth> = {
  Ori: {
    name: "Orion",
    story:
      "The Hunter, one of the most striking figures in the sky. In Greek myth Orion boasted he could kill any beast on Earth, so Gaia sent a scorpion (Scorpius) to humble him — the two are placed on opposite sides of the sky so they never appear together. His Belt of three bright stars points to Sirius one way and Aldebaran the other.",
  },
  CMa: {
    name: "Canis Major",
    story:
      "The Greater Dog, one of Orion's two hunting dogs, forever chasing Lepus the hare across the sky. It holds Sirius, the brightest star in the night — the 'Dog Star' whose dawn rising once marked the scorching 'dog days' of summer for the ancient Egyptians and Greeks.",
  },
  CMi: {
    name: "Canis Minor",
    story:
      "The Lesser Dog, Orion's smaller hound, marked by the bright star Procyon — Greek for 'before the dog', because it rises just ahead of Sirius.",
  },
  Tau: {
    name: "Taurus",
    story:
      "The Bull — the form Zeus took to carry off the princess Europa. Its face is the V-shaped Hyades cluster anchored by red Aldebaran, and riding on its shoulder are the Pleiades, the Seven Sisters.",
  },
  Sco: {
    name: "Scorpius",
    story:
      "The Scorpion that slew Orion. Its heart is the red supergiant Antares — 'rival of Mars' — and its curving tail and stinger are unmistakable low in the southern winter sky.",
  },
  Sgr: {
    name: "Sagittarius",
    story:
      "The Archer, a centaur drawing his bow at Scorpius. Its bright stars form the 'Teapot', and steam from its spout is the glowing centre of the Milky Way — the direction of our galaxy's core.",
  },
  Cru: {
    name: "Crux",
    story:
      "The Southern Cross — the smallest constellation but a southern icon, blazoned on flags across the hemisphere. Its long axis points toward the south celestial pole, and beside it lies the dark Coalsack Nebula. To many Aboriginal Australian peoples its stars and the surrounding dark clouds form the head of the great Emu in the Sky.",
  },
  Cen: {
    name: "Centaurus",
    story:
      "The Centaur, often identified with wise Chiron. It carries Alpha Centauri — the closest star system to the Sun — and the two 'Pointer' stars that aim straight at the Southern Cross.",
  },
  UMa: {
    name: "Ursa Major",
    story:
      "The Great Bear, containing the Big Dipper (the Plough). Callisto, loved by Zeus, was turned into a bear and set among the stars. The two stars at the end of its bowl point the way to Polaris, the North Star.",
  },
  UMi: {
    name: "Ursa Minor",
    story:
      "The Little Bear, whose tail-tip is Polaris — the Pole Star that sits almost exactly above Earth's north pole, the one star that barely moves all night (and never rises from southern Australia).",
  },
  Leo: {
    name: "Leo",
    story:
      "The Lion — the Nemean lion slain by Heracles as the first of his twelve labours. Its mane is the backwards-question-mark 'Sickle', led by the bright star Regulus, 'the little king'.",
  },
  Cyg: {
    name: "Cygnus",
    story:
      "The Swan, flying down the Milky Way — said to be Zeus in disguise, or the grieving friend of Phaethon. Its bright stars form the 'Northern Cross', tipped by brilliant Deneb.",
  },
  Lyr: {
    name: "Lyra",
    story:
      "The Lyre of Orpheus, whose music could charm the dead. It is crowned by Vega, one of the brightest stars in the sky and a former (and future) pole star.",
  },
  Aql: {
    name: "Aquila",
    story:
      "The Eagle that carried Zeus's thunderbolts. Its bright star Altair forms one corner of the 'Summer Triangle' with Vega and Deneb.",
  },
  Gem: {
    name: "Gemini",
    story:
      "The Twins, Castor and Pollux — inseparable brothers. When mortal Castor died, Pollux begged to share his immortality, so Zeus set them together in the sky forever.",
  },
  Boo: {
    name: "Boötes",
    story:
      "The Herdsman, driving the bears around the pole. Its leading light is Arcturus, 'the bear-guard', a golden-orange giant and the brightest star of the northern sky.",
  },
  Per: {
    name: "Perseus",
    story:
      "The hero who slew the Gorgon Medusa. The star Algol — the 'Demon Star' — marks her severed head and visibly winks every few days as a companion star eclipses it.",
  },
  And: {
    name: "Andromeda",
    story:
      "The chained princess, set out as a sacrifice to the sea-monster Cetus and rescued by Perseus. She points the way to the Andromeda Galaxy, the most distant thing visible to the naked eye.",
  },
  Cas: {
    name: "Cassiopeia",
    story:
      "The vain queen, Andromeda's mother, bound to her throne and wheeling around the pole — her distinctive 'W' (or 'M') of five bright stars.",
  },
  Car: {
    name: "Carina",
    story:
      "The Keel of the great ship Argo. It holds Canopus, the second-brightest star in the sky, and the vast Carina Nebula — one of the southern sky's deep-sky jewels.",
  },
  Eri: {
    name: "Eridanus",
    story:
      "The celestial River, winding from Orion's foot down toward the southern horizon, ending at the bright star Achernar — 'the river's end'.",
  },
  Aur: {
    name: "Auriga",
    story:
      "The Charioteer, cradling a goat and her kids. Its brilliant star Capella — 'the little she-goat' — is one of the brightest in the northern sky.",
  },
  Vir: {
    name: "Virgo",
    story:
      "The Maiden, often the harvest goddess holding an ear of wheat — the bright blue-white star Spica. Behind her lies a vast cluster of galaxies.",
  },
  PsA: {
    name: "Piscis Austrinus",
    story:
      "The Southern Fish, drinking the water poured by Aquarius. Its solitary bright star Fomalhaut shines alone in an empty patch of southern sky.",
  },
  Pav: {
    name: "Pavo",
    story:
      "The Peacock — a southern constellation named by 16th-century navigators, its lead star simply called 'Peacock'.",
  },
  Gru: {
    name: "Grus",
    story:
      "The Crane, one of the 'southern birds' charted by Dutch explorers Keyser and de Houtman from the decks of their ships.",
  },
};

export interface Asterism {
  name: string;
  note: string;
  // member star proper names used to draw / locate the asterism
  stars: string[];
}

export const ASTERISMS: Asterism[] = [
  {
    name: "Orion's Belt",
    note: "Three bright stars in a near-perfect line — Alnitak, Alnilam and Mintaka — the most famous asterism in the sky. Also called the 'Three Kings' or the 'Saucepan' handle in Australia.",
    stars: ["Alnitak", "Alnilam", "Mintaka"],
  },
  {
    name: "The Southern Cross",
    note: "The four (or five) stars of Crux — Acrux, Mimosa, Gacrux and Imai — used for finding due south. A southern-sky icon.",
    stars: ["Acrux", "Mimosa", "Gacrux", "Imai", "Ginan"],
  },
  {
    name: "The Pointers",
    note: "Alpha and Beta Centauri, two brilliant stars that point straight at the Southern Cross — and Alpha Centauri is the nearest star system to the Sun.",
    stars: ["Rigil Kentaurus", "Hadar"],
  },
  {
    name: "The Big Dipper",
    note: "The seven stars of the Plough within Ursa Major. The two stars at the end of the bowl point to Polaris, the North Star.",
    stars: ["Dubhe", "Merak", "Phecda", "Megrez", "Alioth", "Mizar", "Alkaid"],
  },
  {
    name: "The Summer Triangle",
    note: "A huge triangle of three first-magnitude stars from three constellations: Vega (Lyra), Deneb (Cygnus) and Altair (Aquila).",
    stars: ["Vega", "Deneb", "Altair"],
  },
  {
    name: "The Saucepan",
    note: "The Australian nickname for Orion's Belt plus his Sword — looking like a saucepan tipped on its side, high in the northern summer-evening sky.",
    stars: ["Alnitak", "Alnilam", "Mintaka"],
  },
];
