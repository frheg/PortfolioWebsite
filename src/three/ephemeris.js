// Real planetary positions/rotations, computed from the browser's clock —
// used only in Explore mode (see useSolarSystem.js). Orbital elements are
// JPL's standard "Keplerian Elements for Approximate Positions of the Major
// Planets" (Standish 1992), valid 1800-2050 AD, accurate to a fraction of a
// degree over that range — far more precision than a visual scene needs.
// Source: https://ssd.jpl.nasa.gov/planets/approx_pos.html
//
// Units: a in AU, angles in degrees, rates are per Julian century (36525
// days). Pluto isn't in JPL's 8-planet table; its elements are the J2000
// osculating set (a, e, i, node, argument of perihelion, mean anomaly) from
// standard references, with no secular rates (it drifts slowly enough that a
// fixed epoch is a reasonable approximation here) and a mean motion derived
// from Kepler's third law (T = a^1.5 years).
const ELEMENTS = {
  mercury: { a: 0.38709927, aDot: 0.00000037, e: 0.20563593, eDot: 0.00001906, i: 7.00497902, iDot: -0.00594749, L: 252.25032350, LDot: 149472.67411175, peri: 77.45779628, periDot: 0.16047689, node: 48.33076593, nodeDot: -0.12534081 },
  venus: { a: 0.72333566, aDot: 0.00000390, e: 0.00677672, eDot: -0.00004107, i: 3.39467605, iDot: -0.00078890, L: 181.97909950, LDot: 58517.81538729, peri: 131.60246718, periDot: 0.00268329, node: 76.67984255, nodeDot: -0.27769418 },
  earth: { a: 1.00000261, aDot: 0.00000562, e: 0.01671123, eDot: -0.00004392, i: -0.00001531, iDot: -0.01294668, L: 100.46457166, LDot: 35999.37244981, peri: 102.93768193, periDot: 0.32327364, node: 0.0, nodeDot: 0.0 },
  mars: { a: 1.52371034, aDot: 0.00001847, e: 0.09339410, eDot: 0.00007882, i: 1.84969142, iDot: -0.00813131, L: -4.55343205, LDot: 19140.30268499, peri: -23.94362959, periDot: 0.44441088, node: 49.55953891, nodeDot: -0.29257343 },
  jupiter: { a: 5.20288700, aDot: -0.00011607, e: 0.04838624, eDot: -0.00013253, i: 1.30439695, iDot: -0.00183714, L: 34.39644051, LDot: 3034.74612775, peri: 14.72847983, periDot: 0.21252668, node: 100.47390909, nodeDot: 0.20469106 },
  saturn: { a: 9.53667594, aDot: -0.00125060, e: 0.05386179, eDot: -0.00050991, i: 2.48599187, iDot: 0.00193609, L: 49.95424423, LDot: 1222.49362201, peri: 92.59887831, periDot: -0.41897216, node: 113.66242448, nodeDot: -0.28867794 },
  uranus: { a: 19.18916464, aDot: -0.00196176, e: 0.04725744, eDot: -0.00004397, i: 0.77263783, iDot: -0.00242939, L: 313.23810451, LDot: 428.48202785, peri: 170.95427630, periDot: 0.40805281, node: 74.01692503, nodeDot: 0.04240589 },
  neptune: { a: 30.06992276, aDot: 0.00026291, e: 0.00859048, eDot: 0.00005105, i: 1.77004347, iDot: 0.00035372, L: -55.12002969, LDot: 218.45945325, peri: 44.96476227, periDot: -0.32241464, node: 131.78422574, nodeDot: -0.00508664 },
  // J2000 osculating elements (a=39.482 AU, e=0.2488, i=17.16°, node=110.299°,
  // argPeri=113.834°, M0=14.53°); L/peri below are the equivalent
  // longitude-of-perihelion form (peri = node + argPeri, L = M0 + peri) so
  // Pluto can reuse the same formula as the real planets. LDot derived from
  // Kepler's third law: T = a^1.5 years.
  pluto: { a: 39.482, aDot: 0, e: 0.2488, eDot: 0, i: 17.16, iDot: 0, L: 238.663, LDot: 145.12, peri: 224.133, periDot: 0, node: 110.299, nodeDot: 0 },
}

// Sidereal rotation period in days (sign not encoded here — retrograde
// bodies reuse the site's existing axialTilt convention instead, see
// useSolarSystem.js).
export const ROTATION_PERIOD_DAYS = {
  sun: 25.05,
  mercury: 58.646,
  venus: 243.025,
  earth: 0.99727,
  moon: 27.321661,
  mars: 1.02595,
  jupiter: 0.41354,
  saturn: 0.4440,
  uranus: 0.71833,
  neptune: 0.6713,
  pluto: 6.387222,
}

export const MOON_SIDEREAL_ORBIT_DAYS = 27.321661

const MS_PER_DAY = 86400000
const DAYS_PER_CENTURY = 36525
const DEG2RAD = Math.PI / 180
// JD 2451545.0 = 2000-01-01 12:00 UTC
const J2000_EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0)

export function daysSinceJ2000(dateMs = Date.now()) {
  return (dateMs - J2000_EPOCH_MS) / MS_PER_DAY
}

export function dateMsFromDaysSinceJ2000(days) {
  return J2000_EPOCH_MS + days * MS_PER_DAY
}

function normalizeDeg180(deg) {
  let d = deg % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

function solveKeplerEquation(meanAnomalyRad, eccentricity) {
  let E = meanAnomalyRad
  for (let iter = 0; iter < 8; iter += 1) {
    const delta = (E - eccentricity * Math.sin(E) - meanAnomalyRad) / (1 - eccentricity * Math.cos(E))
    E -= delta
    if (Math.abs(delta) < 1e-8) break
  }
  return E
}

export function hasEphemeris(key) {
  return Boolean(ELEMENTS[key])
}

// Base (J2000) semi-major axis in AU — used to derive a per-body AU-to-scene
// scale factor from the existing (already-compressed, hand-tuned) orbitRadius
// config, so real angles/eccentricity/timing apply within the same navigable
// scene distances rather than true (much larger, unnavigable) AU spacing.
export function baseSemiMajorAxisAU(key) {
  return ELEMENTS[key]?.a ?? null
}

/**
 * Heliocentric ecliptic position in AU for the given body at the given time.
 * z is "north" (out of the ecliptic plane) — callers map this to whichever
 * axis their scene treats as up.
 */
export function heliocentricPositionAU(key, daysSinceJ2000Value) {
  const base = ELEMENTS[key]
  if (!base) return null

  const T = daysSinceJ2000Value / DAYS_PER_CENTURY
  const a = base.a + base.aDot * T
  const e = base.e + base.eDot * T
  const iDeg = base.i + base.iDot * T
  const LDeg = base.L + base.LDot * T
  const periDeg = base.peri + base.periDot * T
  const nodeDeg = base.node + base.nodeDot * T

  const argPeriDeg = periDeg - nodeDeg
  const meanAnomaly = normalizeDeg180(LDeg - periDeg) * DEG2RAD
  const E = solveKeplerEquation(meanAnomaly, e)

  // Perifocal-plane position
  const xOrbit = a * (Math.cos(E) - e)
  const yOrbit = a * Math.sqrt(1 - e * e) * Math.sin(E)

  const argPeri = argPeriDeg * DEG2RAD
  const node = nodeDeg * DEG2RAD
  const i = iDeg * DEG2RAD
  const cosArgPeri = Math.cos(argPeri)
  const sinArgPeri = Math.sin(argPeri)
  const cosNode = Math.cos(node)
  const sinNode = Math.sin(node)
  const cosI = Math.cos(i)
  const sinI = Math.sin(i)

  // Rotate perifocal -> heliocentric ecliptic (standard Keplerian-elements
  // transform, e.g. Meeus, "Astronomical Algorithms")
  const x =
    (cosArgPeri * cosNode - sinArgPeri * sinNode * cosI) * xOrbit +
    (-sinArgPeri * cosNode - cosArgPeri * sinNode * cosI) * yOrbit
  const y =
    (cosArgPeri * sinNode + sinArgPeri * cosNode * cosI) * xOrbit +
    (-sinArgPeri * sinNode + cosArgPeri * cosNode * cosI) * yOrbit
  const z = sinArgPeri * sinI * xOrbit + cosArgPeri * sinI * yOrbit

  return { x, y, z }
}
