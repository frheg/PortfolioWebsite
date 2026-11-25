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

// Neighbor galaxies. dist + radius: pc. inclination: disk tilt vs line of sight (0 = face-on),
// pa: position angle of major axis on sky (N→E), deg. type: spiral | barred | irregular.
export const galaxies = [
  {
    key: 'm31',
    name: 'Andromedagalaksen (M31)',
    type: 'spiral',
    ra: 10.6847, dec: 41.2687, dist: 765_000, radius: 30_000,
    inclination: 77, pa: 38, arms: 2, pitch: 10, ring: 0.42, seed: 31, weight: 1,
    facts: ['Nærmeste store spiralgalakse', 'Avstand: ~2,5 millioner lysår', '~1 billion stjerner', 'Kolliderer med Melkeveien om ~4,5 mrd. år'],
  },
  {
    key: 'm33',
    name: 'Triangelgalaksen (M33)',
    type: 'spiral',
    ra: 23.4621, dec: 30.6599, dist: 869_000, radius: 9_000,
    inclination: 55, pa: 23, arms: 2, pitch: 24, seed: 33, weight: 0.45,
    facts: ['Tredje største i Den lokale gruppen', 'Avstand: ~2,7 millioner lysår', '~40 milliarder stjerner'],
  },
  {
    key: 'lmc',
    name: 'Den store magellanske sky',
    type: 'barred',
    ra: 80.894, dec: -69.756, dist: 49_970, radius: 5_500,
    inclination: 35, pa: 170, seed: 50, weight: 0.6, tarantula: [0.3, 0.2],
    facts: ['Satellittgalakse til Melkeveien', 'Avstand: ~163 000 lysår', 'Hjem til Taranteltåken (30 Doradus)', 'Supernova 1987A eksploderte her'],
  },
  {
    key: 'smc',
    name: 'Den lille magellanske sky',
    type: 'irregular',
    ra: 13.187, dec: -72.829, dist: 62_100, radius: 3_200,
    inclination: 60, pa: 45, seed: 62, weight: 0.35,
    facts: ['Dverggalakse, satellitt til Melkeveien', 'Avstand: ~200 000 lysår', '~7 milliarder stjerner'],
  },
]

// Beyond the Local Group's big three: scale context (intro flight + explore). ra/dec deg, dist + radius pc.
// type: s spiral (blue-white) | e elliptical/dwarf spheroidal (warm) | i irregular (blue).
// Dwarfs: real Local Group members (McConnachie 2012, rounded). M31/M33/LMC/SMC live in `galaxies`.
export const localDwarfs = [
  ['M32', 10.674, 40.865, 785_000, 1_000, 'e'], ['M110', 10.092, 41.685, 824_000, 2_500, 'e'],
  ['NGC 185', 9.741, 48.337, 617_000, 1_500, 'e'], ['NGC 147', 8.3, 48.509, 676_000, 1_500, 'e'],
  ['Andromeda I', 11.415, 38.04, 727_000, 700, 'e'], ['Andromeda II', 19.124, 33.419, 652_000, 1_000, 'e'],
  ['NGC 6822', 296.236, -14.803, 459_000, 1_500, 'i'], ['IC 1613', 16.199, 2.118, 755_000, 1_800, 'i'],
  ['IC 10', 5.072, 59.304, 794_000, 1_000, 'i'], ['WLM', 0.492, -15.461, 933_000, 1_500, 'i'],
  ['Leo A', 149.86, 30.746, 798_000, 600, 'i'], ['Sextans A', 152.753, -4.693, 1_432_000, 1_200, 'i'],
  ['Sextans B', 150.0, 5.333, 1_426_000, 1_000, 'i'], ['NGC 3109', 150.78, -26.16, 1_300_000, 3_000, 'i'],
  ['Pegasus dIrr', 352.151, 14.743, 920_000, 800, 'i'], ['Phoenix', 27.776, -44.445, 415_000, 400, 'i'],
  ['Tucana', 340.457, -64.419, 887_000, 300, 'e'], ['Fornax dSph', 39.997, -34.449, 147_000, 1_000, 'e'],
  ['Sculptor dSph', 15.039, -33.709, 86_000, 500, 'e'], ['Leo I', 152.117, 12.307, 254_000, 400, 'e'],
  ['Leo II', 168.37, 22.152, 233_000, 250, 'e'], ['Carina', 100.403, -50.966, 105_000, 400, 'e'],
  ['Draco', 260.052, 57.915, 76_000, 300, 'e'], ['Ursa Minor', 227.285, 67.222, 76_000, 400, 'e'],
  ['Sextans dSph', 153.262, -1.615, 86_000, 700, 'e'],
]

// Nearby groups: real main members (rounded), + `extra` generated dwarfs within `spread` pc of the first member.
export const nearbyGroups = [
  {
    key: 'm81', name: 'M81-gruppen', spread: 350_000, extra: 20,
    members: [['M81', 148.888, 69.065, 3_600_000, 14_000, 's'], ['M82', 148.968, 69.68, 3_500_000, 6_000, 'i'], ['NGC 2403', 114.214, 65.603, 3_200_000, 9_000, 's'], ['NGC 3077', 150.83, 68.734, 3_800_000, 3_000, 'i']],
    facts: ['Nærmeste gruppe utenfor vår egen', 'Avstand: ~12 millioner lysår'],
  },
  {
    key: 'sculptor', name: 'Skulptørgruppen', spread: 800_000, extra: 15,
    members: [['NGC 253', 11.888, -25.288, 3_500_000, 13_000, 's'], ['NGC 300', 13.723, -37.684, 2_000_000, 7_000, 's'], ['NGC 55', 3.723, -39.197, 2_100_000, 8_000, 'i'], ['NGC 7793', 359.458, -32.591, 3_900_000, 5_000, 's']],
    facts: ['Løs gruppe rett bak Den lokale gruppen', 'Avstand: ~7–13 millioner lysår'],
  },
  {
    key: 'cena', name: 'Centaurus A-gruppen', spread: 500_000, extra: 25,
    members: [['Centaurus A', 201.365, -43.019, 3_800_000, 15_000, 'e'], ['M83', 204.254, -29.866, 4_700_000, 12_000, 's'], ['NGC 4945', 196.364, -49.468, 3_700_000, 12_000, 's'], ['NGC 5102', 199.733, -36.63, 3_400_000, 4_000, 'e']],
    facts: ['Rundt radiogalaksen Centaurus A', 'Avstand: ~12–15 millioner lysår'],
  },
  {
    key: 'ic342', name: 'IC 342-gruppen', spread: 400_000, extra: 10,
    members: [['IC 342', 56.702, 68.096, 3_300_000, 12_000, 's'], ['Maffei 1', 39.148, 59.655, 3_000_000, 8_000, 'e'], ['Maffei 2', 40.479, 59.604, 3_400_000, 7_000, 's']],
    facts: ['Delvis skjult bak Melkeveiens støv', 'Avstand: ~10 millioner lysår'],
  },
]

// Clusters: real centre + distance + rough size/count; members generated (seeded), ellipticals toward the core.
export const galaxyClusters = [
  { key: 'virgo', name: 'Virgohopen', ra: 187.706, dec: 12.391, dist: 16_500_000, coreRadius: 400_000, radius: 2_200_000, count: 1300, seed: 87, facts: ['~1 300–2 000 galakser', 'Avstand: ~54 millioner lysår', 'Kjempegalaksen M87 i sentrum', 'Trekker Den lokale gruppen mot seg'] },
  { key: 'fornax', name: 'Fornaxhopen', ra: 54.621, dec: -35.45, dist: 19_000_000, coreRadius: 200_000, radius: 1_000_000, count: 250, seed: 1399, facts: ['~60 store galakser + dverger', 'Avstand: ~62 millioner lysår'] },
]

// Field galaxies between groups: generated, ~real mean density of bright galaxies.
export const fieldGalaxies = { count: 1400, minDist: 5_000_000, maxDist: 45_000_000, seed: 4242 }
