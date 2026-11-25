// Local universe: Local Group dwarfs, nearby groups, Virgo + Fornax clusters, field galaxies.
// One sprite per galaxy (one draw call) → sizes + distances read at a glance from afar (intro flight).
// Real: dwarfs, group main members, cluster centres/sizes/counts. Generated (seeded): cluster/group members, field.
import * as THREE from 'three'
import { galaxies, localDwarfs, nearbyGroups, galaxyClusters, fieldGalaxies } from '../data/deepSpaceObjects'
import { GALAXY_CENTER_PC, PC_KM, raDecToScene } from './galaxyFrame'
import { createSpriteCloud, gauss, mulberry32 } from './deepSpace'
import { getDeepBodies, setDeepBodies, setPoiGroup } from './solarSystemRuntime'
import { spaceConfig } from './spaceConfig'

const cfg = spaceConfig.galaxy.localUniverse
const TINT = { s: [0.75, 0.82, 1.0], e: [1.0, 0.84, 0.64], i: [0.62, 0.74, 1.0] }
const MPC = 1e6

// Uniform random direction.
function randomDir(rand) {
  const z = rand() * 2 - 1
  const a = rand() * Math.PI * 2
  const r = Math.sqrt(1 - z * z)
  return [r * Math.cos(a), r * Math.sin(a), z]
}

// Typical generated galaxy: mostly dwarfs, a few big ones. pc.
const memberRadius = (rand) => Math.min(40_000, 2_500 * Math.exp(gauss(rand) * 0.7))

export function createLocalUniverse(scene, isMobile) {
  const pos = []
  const size = []
  const tint = []
  const add = ([x, y, z], radius, type, a = 1) => {
    pos.push(x, y, z)
    size.push(radius * cfg.sizeScale)
    tint.push(...TINT[type], a)
  }
  const at = (ra, dec, dist) => raDecToScene(ra, dec, dist)

  localDwarfs.forEach(([, ra, dec, dist, radius, type]) => add(at(ra, dec, dist), radius, type, 0.8))

  const groupPois = nearbyGroups.map((g) => {
    const rand = mulberry32(g.key.length * 7919 + g.extra)
    const centers = g.members.map(([, ra, dec, dist, radius, type]) => {
      const c = at(ra, dec, dist)
      add(c, radius, type)
      return c
    })
    const [cx, cy, cz] = centers[0]
    for (let i = 0; i < g.extra; i += 1) {
      const d = randomDir(rand)
      const r = g.spread * Math.sqrt(rand())
      add([cx + d[0] * r, cy + d[1] * r, cz + d[2] * r], memberRadius(rand) * 0.6, rand() < 0.5 ? 'e' : 'i', 0.8)
    }
    const mean = centers.reduce((s, c) => [s[0] + c[0], s[1] + c[1], s[2] + c[2]], [0, 0, 0]).map((v) => v / centers.length)
    return groupPoi(g.key, g.name, mean, g.spread, g.facts)
  })

  const clusterPois = galaxyClusters.map((c) => {
    const rand = mulberry32(c.seed)
    const center = at(c.ra, c.dec, c.dist)
    const count = Math.round(c.count * (isMobile ? cfg.mobileFactor : 1))
    // Isothermal-ish: dense core, long tail out to radius. Ellipticals dominate the core (morphology–density).
    const span = Math.atan(c.radius / c.coreRadius)
    for (let i = 0; i < count; i += 1) {
      const r = c.coreRadius * Math.tan(rand() * span)
      const d = randomDir(rand)
      const core = r < c.coreRadius * 1.5
      add([center[0] + d[0] * r, center[1] + d[1] * r, center[2] + d[2] * r], memberRadius(rand), rand() < (core ? 0.8 : 0.35) ? 'e' : 's')
    }
    if (c.key === 'virgo') add(center, 40_000, 'e') // M87, giant elliptical at the core
    return groupPoi(c.key, c.name, center, c.radius, c.facts)
  })

  {
    const f = fieldGalaxies
    const rand = mulberry32(f.seed)
    const count = Math.round(f.count * (isMobile ? cfg.mobileFactor : 1))
    const lo = f.minDist ** 3
    const hi = f.maxDist ** 3
    for (let i = 0; i < count; i += 1) {
      const r = Math.cbrt(lo + rand() * (hi - lo))
      const d = randomDir(rand)
      add([d[0] * r, d[1] * r, d[2] * r], memberRadius(rand) * 1.3, rand() < 0.6 ? 's' : 'e', 0.9)
    }
  }

  const cloud = createSpriteCloud(new Float32Array(pos), new Float32Array(size), new Float32Array(tint), { x: 0, y: 0, z: 0 }, cfg.gain)
  scene.add(cloud)

  // Names (intro + explore): Milky Way, Local Group, groups, clusters.
  const mwKm = new THREE.Vector3(...GALAXY_CENTER_PC).multiplyScalar(PC_KM)
  const m31 = galaxies.find((g) => g.key === 'm31')
  const m31Pc = new THREE.Vector3(...at(m31.ra, m31.dec, m31.dist))
  const lgPc = new THREE.Vector3(...GALAXY_CENTER_PC).lerp(m31Pc, 0.55) // barycenter-ish (M31 a bit heavier)
  const mwRadiusKm = 15_000 * PC_KM
  const pois = [
    {
      key: 'lu_mw', kind: 'cluster', name: 'Melkeveien', position: mwKm, radius: mwRadiusKm, labelRange: Infinity, introLabel: true,
      factsRange: mwRadiusKm * 1.2, facts: ['Vår galakse: 100–400 milliarder stjerner', '~100 000 lysår på tvers'],
      labelVisibility: (distKm) => THREE.MathUtils.smoothstep(distKm, mwRadiusKm * 1.5, mwRadiusKm * 2.5),
    },
    groupPoi('lg', 'Den lokale gruppen', lgPc.toArray(), 1.5 * MPC, ['~80 galakser, ~10 millioner lysår på tvers', 'Melkeveien og Andromeda er de største']),
    ...groupPois,
    ...clusterPois,
  ]
  setPoiGroup('localUniverse', pois)
  // Explore: speed scales with distance to these centres (brake on approach, fly through freely).
  const bodies = pois.filter((p) => p.key !== 'lu_mw').map((p) => ({ key: p.key, kind: 'body', soft: true, position: p.position, radius: 0 }))
  setDeepBodies([...getDeepBodies(), ...bodies])

  const dispose = () => {
    scene.remove(cloud)
    cloud.geometry.dispose()
    cloud.material.dispose()
    setPoiGroup('localUniverse', [])
    setDeepBodies(getDeepBodies().filter((b) => !bodies.includes(b)))
  }
  return { dispose }
}

// Group/cluster name: shown from outside, fades once inside.
function groupPoi(key, name, centerPc, radiusPc, facts) {
  const radiusKm = radiusPc * PC_KM
  return {
    key: `lu_${key}`,
    kind: 'cluster',
    name,
    position: new THREE.Vector3(...centerPc).multiplyScalar(PC_KM),
    radius: radiusKm,
    labelRange: Infinity,
    introLabel: true,
    factsRange: radiusKm * 2,
    facts,
    labelVisibility: (distKm) => THREE.MathUtils.smoothstep(distKm, radiusKm * 0.8, radiusKm * 1.6),
  }
}
