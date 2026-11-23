// Real deep-space objects for Explore. Positions: RA/Dec (deg, J2000) + distance (pc).
// Nebula radius: pc (visual extent). Black hole mass: solar masses. Facts shown in HUD labels.

export const nebulae = [
  {
    key: 'orion',
    name: 'Oriontåken (M42)',
    type: 'emission',
    ra: 83.822, dec: -5.391, dist: 412, radius: 3.7, seed: 11, clusterStars: 6,
    facts: ['Avstand: ~1 344 lysår', 'Diameter: ~24 lysår', 'Nærmeste store stjernefødested', 'Synlig med blotte øye i Orions sverd'],
  },
  {
    key: 'eagle',
    name: 'Ørnetåken (M16)',
    type: 'emission',
    ra: 274.7, dec: -13.807, dist: 1740, radius: 9, seed: 23, clusterStars: 8,
    facts: ['Avstand: ~5 700 lysår', 'Hjem til «Skapelsens søyler»', 'Ung stjernehop NGC 6611', 'Alder: ~1–2 millioner år'],
  },
  {
    key: 'lagoon',
    name: 'Lagunetåken (M8)',
    type: 'emission',
    ra: 270.925, dec: -24.38, dist: 1250, radius: 14, seed: 37, clusterStars: 7,
    facts: ['Avstand: ~4 100 lysår', 'Størrelse: ~110 × 50 lysår', 'Mørke globuler med nye stjerner', 'Synlig med blotte øye'],
  },
  {
    key: 'carina',
    name: 'Carinatåken',
    type: 'emission',
    ra: 161.265, dec: -59.867, dist: 2300, radius: 45, seed: 41, clusterStars: 12, scale: 1.7,
    facts: ['Avstand: ~7 500 lysår', 'Diameter: ~460 lysår', 'Inneholder Eta Carinae', 'En av Melkeveiens største tåker'],
  },
  {
    key: 'rosette',
    name: 'Rosettåken',
    type: 'emission',
    ra: 97.98, dec: 4.95, dist: 1600, radius: 20, seed: 53, clusterStars: 6, hollow: true,
    facts: ['Avstand: ~5 200 lysår', 'Diameter: ~130 lysår', 'Hulrom blåst ut av hop NGC 2244', 'Formet som en rose'],
  },
  {
    key: 'crab',
    name: 'Krabbetåken (M1)',
    type: 'snr',
    ra: 83.633, dec: 22.0145, dist: 2000, radius: 1.7, seed: 61, fill: true,
    facts: ['Supernovarest fra år 1054', 'Avstand: ~6 500 lysår', 'Pulsar i sentrum: 30 omløp/s', 'Ekspanderer med ~1 500 km/s'],
  },
  {
    key: 'veil',
    name: 'Slørtåken',
    type: 'snr',
    ra: 312.75, dec: 30.67, dist: 735, radius: 18, seed: 67,
    facts: ['Supernovarest, ~10–20 000 år', 'Avstand: ~2 400 lysår', 'Diameter: ~110 lysår', 'Tynne, glødende filamenter'],
  },
  {
    key: 'ring',
    name: 'Ringtåken (M57)',
    type: 'planetary',
    ra: 283.396, dec: 33.029, dist: 790, radius: 0.25, seed: 71,
    facts: ['Planetarisk tåke', 'Avstand: ~2 600 lysår', 'Døende stjerne kaster av ytre lag', 'Hvit dverg i sentrum'],
  },
  {
    key: 'helix',
    name: 'Helixtåken',
    type: 'planetary',
    ra: 337.411, dec: -20.837, dist: 200, radius: 0.45, seed: 79,
    facts: ['Planetarisk tåke', 'Avstand: ~650 lysår', 'Kalt «Guds øye»', 'Slik kan Solen ende om ~5 mrd. år'],
  },
]

// galacticCenter: true → placed at Sgr A* (frame constant), ra/dec ignored.
export const blackHoles = [
  {
    key: 'sgra',
    name: 'Sagittarius A*',
    galacticCenter: true,
    mass: 4.3e6, disk: true, tilt: [1.2, 0.4], seed: 3, portal: true, // horizon → wormhole home
    facts: ['Supermassivt sort hull', 'Masse: ~4,3 millioner × Solen', 'Melkeveiens sentrum, ~26 700 lysår unna', 'Avbildet av Event Horizon Telescope 2022'],
  },
  {
    key: 'cygx1',
    name: 'Cygnus X-1',
    ra: 299.59, dec: 35.2, dist: 2220,
    mass: 21, disk: true, tilt: [1.3, -0.3], seed: 5,
    facts: ['Første bekreftede sorte hull (1971)', 'Masse: ~21 × Solen', 'Spiser av blå superkjempe', 'Avstand: ~7 200 lysår'],
  },
  {
    key: 'v404',
    name: 'V404 Cygni',
    ra: 306.016, dec: 33.867, dist: 2390,
    mass: 9, disk: true, tilt: [0.9, 0.6], seed: 7,
    facts: ['Røntgendobbeltstjerne', 'Masse: ~9 × Solen', 'Kraftige utbrudd 1989 og 2015', 'Avstand: ~7 800 lysår'],
  },
  {
    key: 'gaiabh1',
    name: 'Gaia BH1',
    ra: 262.172, dec: -0.581, dist: 480,
    mass: 9.6, disk: false, seed: 9,
    facts: ['Nærmeste kjente sorte hull', 'Masse: ~9,6 × Solen', 'Sovende — ingen akkresjonsskive', 'Avstand: ~1 560 lysår'],
  },
  {
    key: 'gaiabh3',
    name: 'Gaia BH3',
    ra: 294.83, dec: 14.93, dist: 590,
    mass: 33, disk: false, seed: 13,
    facts: ['Tyngste stjernemassive i Melkeveien', 'Masse: ~33 × Solen', 'Funnet av Gaia 2024', 'Avstand: ~1 930 lysår'],
  },
]
