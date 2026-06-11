// Facts shown as HUD labels when the player flies close to each body in Explore mode.
// Keys must match spaceConfig.solarSystem.bodies[].key and the 'ufo' entry.
export const planetFacts = [
  {
    key: 'sun',
    name: 'The Sun',
    facts: [
      'Diameter: 1,391,000 km (109× Earth)',
      'Age: ~4.6 billion years',
      'Surface temp: ~5,500 °C',
      'Rotation: ~25 Earth days (equator)',
      'Contains 99.86 % of all solar-system mass',
    ],
  },
  {
    key: 'mercury',
    name: 'Mercury',
    facts: [
      'Diameter: 4,879 km',
      'Year: 88 Earth days',
      'Day: 59 Earth days',
      'No significant atmosphere',
      'Surface swings: −180 °C to +430 °C',
    ],
  },
  {
    key: 'venus',
    name: 'Venus',
    facts: [
      'Diameter: 12,104 km',
      'Year: 225 Earth days',
      'Day: 243 Earth days — longer than its year',
      'Hottest planet: avg 465 °C',
      'Dense CO₂ atmosphere, crushing pressure',
    ],
  },
  {
    key: 'earth',
    name: 'Earth',
    facts: [
      'Diameter: 12,742 km',
      'Year: 365.25 days',
      'Day: 24 hours',
      '71 % of surface covered in water',
      'Only known planet harboring life',
    ],
  },
  {
    key: 'moon',
    name: 'The Moon',
    facts: [
      'Diameter: 3,474 km',
      'Orbit: 27.3 days around Earth',
      'Tidally locked — same face always toward us',
      'Water ice confirmed at the poles',
      'Distance from Earth: ~384,400 km',
    ],
  },
  {
    key: 'mars',
    name: 'Mars',
    facts: [
      'Diameter: 6,779 km',
      'Year: 687 Earth days',
      'Day: 24 h 37 min',
      'Olympus Mons: tallest volcano (21 km)',
      'Two moons: Phobos & Deimos',
    ],
  },
  {
    key: 'jupiter',
    name: 'Jupiter',
    facts: [
      'Diameter: 139,820 km (11× Earth)',
      'Year: ~12 Earth years',
      'Day: ~10 hours — fastest rotation',
      'Great Red Spot: storm > 350 years old',
      '95 known moons, incl. Ganymede (largest)',
    ],
  },
  {
    key: 'saturn',
    name: 'Saturn',
    facts: [
      'Diameter: 116,460 km',
      'Year: ~29 Earth years',
      'Day: ~10.7 hours',
      'Rings: mostly ice particles & rocky debris',
      'Less dense than liquid water',
    ],
  },
  {
    key: 'uranus',
    name: 'Uranus',
    facts: [
      'Diameter: 50,724 km',
      'Year: ~84 Earth years',
      'Day: ~17 hours',
      'Rotates on its side: 98° axial tilt',
      'Faintest planet visible to the naked eye',
    ],
  },
  {
    key: 'neptune',
    name: 'Neptune',
    facts: [
      'Diameter: 49,244 km',
      'Year: ~165 Earth years',
      'Day: ~16 hours',
      'Strongest winds in solar system: 2,100 km/h',
      'Moon Triton orbits backwards (retrograde)',
    ],
  },
  {
    key: 'pluto',
    name: 'Pluto',
    facts: [
      'Diameter: 2,377 km (1/5 of Earth)',
      'Year: ~248 Earth years',
      'Day: 6.4 Earth days',
      'Reclassified as dwarf planet in 2006',
      '5 moons — largest is Charon (half Pluto\'s size)',
    ],
  },
  {
    key: 'ufo',
    name: 'Unknown Craft',
    facts: [
      'Origin: classified',
      'Propulsion: unknown principle',
      'Crew manifest: redacted',
      'Trajectory: deliberately erratic',
      'Threat assessment: curious',
    ],
  },
]
