// Real comets: Keplerian elements (heliocentric ecliptic J2000) → position at simulated time.
// Look: nucleus beacon + coma glow + ion tail (straight, anti-sunward, blue) + dust tail (curved, lagging, warm).
// Activity ∝ (3 AU / r)² → tails grow toward perihelion. Tails exaggerated in width (readability), real direction.
import * as THREE from 'three'
import { getRenderScale, scaledPoints } from './frameGovernor'
import { trackAnchor, untrackAnchor } from './floatingOrigin'
import { setPoiGroup } from './solarSystemRuntime'
import { AU_KM } from './galaxyFrame'

const DEG = Math.PI / 180
const GAUSS_K = 0.01720209895 // rad/day, n = k / a^1.5

// 2P/Encke (JPL SBDB, perihelion 2023-10-22; next ~2027-02). Shortest-period bright comet (3.3 yr).
export const COMETS = [
  {
    key: 'encke',
    name: 'Komet 2P/Encke',
    a: 2.2152, e: 0.8471, i: 11.78, node: 334.19, peri: 186.54,
    tPeriJ2000: 8695.1, // days since J2000 (2023-10-22.6)
    facts: ['Kortest kjente omløpstid for en lys komet: 3,3 år', 'Perihel 0,34 AU — innenfor Merkurs bane', 'Kilden til Tauridene (meteorsverm)'],
  },
]

/** Heliocentric ecliptic AU → out (Vector3, AU). */
function cometPositionAU(c, days, out) {
  const n = GAUSS_K / Math.pow(c.a, 1.5)
  let M = n * (days - c.tPeriJ2000)
  M = ((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
  let E = c.e < 0.8 ? M : Math.PI
  for (let k = 0; k < 30; k += 1) {
    const d = (E - c.e * Math.sin(E) - M) / (1 - c.e * Math.cos(E))
    E -= d
    if (Math.abs(d) < 1e-12) break
  }
  const xo = c.a * (Math.cos(E) - c.e)
  const yo = c.a * Math.sqrt(1 - c.e * c.e) * Math.sin(E)
  const w = c.peri * DEG
  const O = c.node * DEG
  const I = c.i * DEG
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(I), sI = Math.sin(I)
  return out.set(
    (cw * cO - sw * sO * cI) * xo + (-sw * cO - cw * sO * cI) * yo,
    (cw * sO + sw * cO * cI) * xo + (-sw * sO + cw * cO * cI) * yo,
    sw * sI * xo + cw * sI * yo
  )
}

let glowTex = null
function getGlow() {
  if (glowTex) return glowTex
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.2, 'rgba(255,255,255,0.55)')
  g.addColorStop(0.55, 'rgba(255,255,255,0.12)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  glowTex = new THREE.CanvasTexture(c)
  return glowTex
}

const TAIL_N = 1600
const _au = new THREE.Vector3()
const _prevAu = new THREE.Vector3()
const _anti = new THREE.Vector3()
const _vel = new THREE.Vector3()
const _side = new THREE.Vector3()

function buildComet(c, scene) {
  const world = new THREE.Vector3()
  const anchor = new THREE.Group()
  trackAnchor(anchor, world)
  scene.add(anchor)

  const coma = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlow(), color: 0xcfe8ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))
  coma.material.color.multiplyScalar(1.8)
  anchor.add(coma)
  // Beacon: few px from anywhere in the inner system.
  const beaconGeo = new THREE.BufferGeometry()
  beaconGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3))
  const beacon = new THREE.Points(beaconGeo, scaledPoints(new THREE.PointsMaterial({ size: 3, sizeAttenuation: false, map: getGlow(), color: 0xdff2ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })))
  anchor.add(beacon)

  // Tails: particle strips (anchor-local, rebuilt as the sun direction changes).
  // Stable random per particle.
  const rnd = new Float32Array(TAIL_N * 3).map((_, k) => {
    const x = Math.sin((k + 1) * 12.9898) * 43758.5453
    return x - Math.floor(x)
  })
  const mkTail = (color, gain, lenPow) => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TAIL_N * 3), 3))
    // Brightness falls off toward the tail end (no hard cut).
    const fade = new Float32Array(TAIL_N * 3)
    for (let k = 0; k < TAIL_N; k += 1) fade.fill(Math.pow(1 - Math.pow(rnd[k * 3], lenPow), 1.5), k * 3, k * 3 + 3)
    g.setAttribute('color', new THREE.BufferAttribute(fade, 3))
    const m = new THREE.PointsMaterial({ size: 1, sizeAttenuation: true, map: getGlow(), color, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 })
    m.color.multiplyScalar(gain) // HDR > 1 → tail catches bloom
    const pts = new THREE.Points(g, m)
    pts.frustumCulled = false
    anchor.add(pts)
    return pts
  }
  const ion = mkTail(0x7fb4ff, 3.2, 1.6)
  const dust = mkTail(0xffe2b8, 2.8, 1.3)

  const poi = { key: `comet_${c.key}`, kind: 'comet', name: c.name, position: world, radius: 5, labelRange: 4 * AU_KM, factsRange: 8e6, facts: c.facts, scrollLabel: true } // scrollLabel: named at the scroll sighting too

  let lastDays = NaN
  const update = (days) => {
    // Tail shape barely changes in 15 min sim time → skip rebuild + upload.
    if (Math.abs(days - lastDays) < 1 / 96) return
    lastDays = days
    cometPositionAU(c, days, _au)
    cometPositionAU(c, days - 1, _prevAu)
    world.set(_au.x * AU_KM, _au.z * AU_KM, -_au.y * AU_KM) // ecliptic → scene
    const rAU = _au.length()
    const act = Math.min(Math.pow(3 / rAU, 2), 12)
    // Directions (scene): anti-sunward, orbital velocity.
    _anti.copy(world).normalize()
    _vel.set(_au.x - _prevAu.x, _au.z - _prevAu.z, -(_au.y - _prevAu.y)).normalize()
    _side.crossVectors(_anti, _vel).normalize()
    const comaKm = 6e4 * Math.sqrt(act)
    coma.scale.setScalar(comaKm * 2)
    coma.material.opacity = Math.min(1, 0.5 + act * 0.2)
    const ionLen = 1.5e7 * act
    const dustLen = 0.9e7 * act
    const ia = ion.geometry.attributes.position.array
    const da = dust.geometry.attributes.position.array
    for (let k = 0; k < TAIL_N; k += 1) {
      const u = rnd[k * 3]
      const s1 = rnd[k * 3 + 1] - 0.5
      const s2 = rnd[k * 3 + 2] - 0.5
      // Ion: straight, narrow, slight flare.
      const li = Math.pow(u, 1.6) * ionLen
      const wi = comaKm * 0.6 + li * 0.04
      ia[k * 3] = _anti.x * li + _side.x * s1 * wi + _vel.x * s2 * wi
      ia[k * 3 + 1] = _anti.y * li + _side.y * s1 * wi + _vel.y * s2 * wi
      ia[k * 3 + 2] = _anti.z * li + _side.z * s1 * wi + _vel.z * s2 * wi
      // Dust: curves back along the orbit (lag ∝ distance²), broad fan.
      const ld = Math.pow(u, 1.3) * dustLen
      const lag = (ld * ld) / dustLen * 0.45
      const wd = comaKm + ld * 0.12
      da[k * 3] = _anti.x * ld - _vel.x * lag + _side.x * s1 * wd
      da[k * 3 + 1] = _anti.y * ld - _vel.y * lag + _side.y * s1 * wd
      da[k * 3 + 2] = _anti.z * ld - _vel.z * lag + _side.z * s1 * wd
    }
    ion.geometry.attributes.position.needsUpdate = true
    dust.geometry.attributes.position.needsUpdate = true
    // × render scale: three sizes points via canvas pixel ratio, scene target is scaled (dynamic res).
    ion.material.size = comaKm * 0.6 * getRenderScale()
    dust.material.size = comaKm * 1.1 * getRenderScale()
    ion.material.opacity = Math.min(1, 0.3 * act)
    dust.material.opacity = Math.min(1, 0.25 * act)
  }

  const dispose = () => {
    untrackAnchor(anchor)
    scene.remove(anchor)
    ;[coma, beacon, ion, dust].forEach((o) => {
      o.geometry?.dispose?.()
      o.material.dispose()
    })
  }

  return { key: c.key, world, poi, update, dispose }
}

let live = []
/** Scroll waypoints: world position of a comet by key (or null). */
export function getCometWorld(key) {
  return live.find((c) => c.key === key)?.world ?? null
}

export function createComets(scene) {
  live = COMETS.map((c) => buildComet(c, scene))
  setPoiGroup('comets', live.map((c) => c.poi))
  return {
    update: (days) => live.forEach((c) => c.update(days)),
    dispose: () => {
      live.forEach((c) => c.dispose())
      live = []
      setPoiGroup('comets', [])
    },
  }
}
