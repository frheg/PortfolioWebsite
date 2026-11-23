// Units + reference frames. Pure math, no three → node build scripts + workers can import.
// Scene frame = ecliptic (x, y, z=north) → (x, z, -y). Proper rotation. Sun at 0.
// Galaxy-local frame G (kpc): origin = galactic center, gx → sun (in plane), gz = NGP.
// Right-handed: gy = gz × gx. Galaxy spins clockwise seen from +gz.

export const AU_KM = 149_597_870.7
export const PC_KM = 3.085677581491367e13
export const LY_KM = 9.4607304725808e12
export const SUN_RADIUS_KM = 695_700
export const SUN_RADIUS_PC = SUN_RADIUS_KM / PC_KM
export const SUN_ABS_MAG = 4.83

const DEG = Math.PI / 180
const OBLIQUITY = 23.4392911 * DEG

const normalize = (v) => {
  const l = Math.hypot(v[0], v[1], v[2])
  return [v[0] / l, v[1] / l, v[2] / l]
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

// Equatorial (ICRS-ish, x → vernal equinox, z → NCP) → scene.
export function equatorialToScene(x, y, z) {
  const ye = y * Math.cos(OBLIQUITY) + z * Math.sin(OBLIQUITY)
  const ze = -y * Math.sin(OBLIQUITY) + z * Math.cos(OBLIQUITY)
  return [x, ze, -ye]
}

export function raDecToScene(raDeg, decDeg, dist = 1) {
  const ra = raDeg * DEG
  const dec = decDeg * DEG
  return equatorialToScene(dist * Math.cos(dec) * Math.cos(ra), dist * Math.cos(dec) * Math.sin(ra), dist * Math.sin(dec))
}

// IAU galactic frame (J2000). Sun: R0 = 8178 pc (GRAVITY 2019), 20.8 pc above plane.
export const SUN_GALACTOCENTRIC_PC = 8178
export const SUN_HEIGHT_PC = 20.8

const zGal = normalize(raDecToScene(192.85948, 27.12825))
const toCenterRaw = raDecToScene(266.40499, -28.93617)
const xGal = normalize(toCenterRaw.map((c, i) => c - dot(toCenterRaw, zGal) * zGal[i])) // sun → GC, in plane
const yGal = cross(zGal, xGal) // l = 90°, sun's direction of travel

// Galaxy-local axes expressed in scene coords. 180° about gz from galactic → still right-handed.
export const GALAXY_AXES = {
  x: xGal.map((c) => -c),
  y: yGal.map((c) => -c),
  z: zGal,
}

// Galactic center, scene pc (sun at 0).
export const GALAXY_CENTER_PC = xGal.map((c, i) => c * SUN_GALACTOCENTRIC_PC - zGal[i] * SUN_HEIGHT_PC)

// Scene pc → galaxy-local kpc.
export function sceneToGalaxyKpc(x, y, z) {
  const dx = x - GALAXY_CENTER_PC[0]
  const dy = y - GALAXY_CENTER_PC[1]
  const dz = z - GALAXY_CENTER_PC[2]
  const { x: ax, y: ay, z: az } = GALAXY_AXES
  return [
    (dx * ax[0] + dy * ax[1] + dz * ax[2]) / 1000,
    (dx * ay[0] + dy * ay[1] + dz * ay[2]) / 1000,
    (dx * az[0] + dy * az[1] + dz * az[2]) / 1000,
  ]
}

// Galaxy-local kpc → scene pc.
export function galaxyKpcToScene(gx, gy, gz) {
  const { x: ax, y: ay, z: az } = GALAXY_AXES
  return [0, 1, 2].map((i) => GALAXY_CENTER_PC[i] + (ax[i] * gx + ay[i] * gy + az[i] * gz) * 1000)
}

// ─── Star color ──────────────────────────────────────────────────────────────

// B-V → effective temperature (Ballesteros 2012).
export function bvToTemperature(bv) {
  return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62))
}

// Blackbody → linear RGB, max channel = 1. Fit (Tanner Helland), sRGB-ish → linearized.
export function temperatureToRgb(tempK) {
  const t = Math.min(Math.max(tempK, 1000), 40000) / 100
  let r
  let g
  let b
  if (t <= 66) {
    r = 255
    g = 99.4708025861 * Math.log(t) - 161.1195681661
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592)
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492)
    b = 255
  }
  const lin = (c) => {
    const s = Math.min(Math.max(c, 0), 255) / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const rgb = [lin(r), lin(g), lin(b)]
  const max = Math.max(...rgb)
  return rgb.map((c) => c / max)
}

// Teff → Harvard class letter.
export function spectralClass(temp) {
  if (temp >= 30000) return 'O'
  if (temp >= 10000) return 'B'
  if (temp >= 7500) return 'A'
  if (temp >= 6000) return 'F'
  if (temp >= 5200) return 'G'
  if (temp >= 3700) return 'K'
  return 'M'
}
