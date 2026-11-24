// Neighbor galaxies (M31, M33, LMC, SMC): glow = sprite cloud in real shape + orientation,
// plus resolved bright stars (visible only up close, like real). Speed-only bodies (brake, no collision).
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'
import { galaxies } from '../data/deepSpaceObjects'
import { PC_KM, raDecToScene, temperatureToRgb } from './galaxyFrame'
import { createSpriteCloud, fbm3, gauss, mulberry32 } from './deepSpace'
import { createStarPoints } from './starMaterial'
import { getDeepBodies, setDeepBodies, setPoiGroup } from './solarSystemRuntime'

const cfg = spaceConfig.galaxy.neighbors

const OLD = [1.0, 0.82, 0.62]
const YOUNG = [0.58, 0.7, 1.0]
const HII = [1.0, 0.36, 0.55]
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

// Unit galaxy, disk in xy, normal +z. Returns { sprites: [x,y,z,size,r,g,b,a]…, stars: [x,y,z,young]… }.
function buildUnit(def, count) {
  const rand = mulberry32(def.seed * 104729)
  const sprites = []
  const stars = []
  const push = (p, size, col, a, young) => {
    sprites.push(p[0], p[1], p[2], size, col[0], col[1], col[2], a)
    if (rand() < 0.5) stars.push(p[0] + gauss(rand) * size * 0.3, p[1] + gauss(rand) * size * 0.3, p[2], young ? 1 : 0)
  }

  if (def.type === 'spiral') {
    const k = Math.tan((def.pitch * Math.PI) / 180)
    for (let i = 0; i < count; i += 1) {
      if (rand() < 0.16) {
        const p = [gauss(rand) * 0.07, gauss(rand) * 0.06, gauss(rand) * 0.045]
        push(p, 0.02 + rand() * 0.035, OLD, 0.9, false)
        continue
      }
      let R = Math.min(-0.3 * Math.log(1 - rand() * 0.97), 1.1)
      let th = rand() * Math.PI * 2
      const onArm = rand() < 0.62
      if (def.ring && rand() < 0.3) R = def.ring + gauss(rand) * 0.035
      if (onArm) {
        const arm = Math.floor(rand() * def.arms)
        th = Math.log(Math.max(R, 0.05) / 0.1) / k + (arm * 2 * Math.PI) / def.arms + (gauss(rand) * 0.22) / (R * 4 + 1)
      }
      const p = [Math.cos(th) * R, Math.sin(th) * R, gauss(rand) * 0.014]
      const hii = onArm && rand() < 0.06
      const col = hii ? HII : onArm ? mix3(YOUNG, [1, 1, 1], rand() * 0.35) : mix3(OLD, [1, 0.95, 0.9], rand() * 0.3)
      push(p, hii ? 0.008 + rand() * 0.01 : 0.012 + rand() * 0.025, col, (0.75 * Math.exp(-R * 1.3) + 0.12) * (hii ? 1.6 : 1), onArm)
    }
  } else if (def.type === 'barred') {
    for (let i = 0; i < count; i += 1) {
      const u = rand()
      if (u < 0.3) {
        push([gauss(rand) * 0.28, gauss(rand) * 0.07, gauss(rand) * 0.05], 0.025 + rand() * 0.03, OLD, 0.8, false)
      } else if (u < 0.36) {
        const [tx, ty] = def.tarantula
        push([tx + gauss(rand) * 0.035, ty + gauss(rand) * 0.035, gauss(rand) * 0.02], 0.01 + rand() * 0.015, HII, 1.6, true)
      } else {
        const R = Math.min(-0.35 * Math.log(1 - rand() * 0.95), 1.1)
        const th = rand() * Math.PI * 2
        const p = [Math.cos(th) * R, Math.sin(th) * R, gauss(rand) * 0.05]
        if (fbm3(p[0] * 3 + 4, p[1] * 3, p[2] * 3, def.seed) < 0.42) continue
        push(p, 0.02 + rand() * 0.03, mix3(YOUNG, [1, 1, 1], rand() * 0.5), 0.55 * Math.exp(-R) + 0.1, true)
      }
    }
  } else {
    for (let i = 0; i < count; i += 1) {
      const p = [gauss(rand) * 0.45, gauss(rand) * 0.22, gauss(rand) * 0.3]
      if (fbm3(p[0] * 3 + 9, p[1] * 3, p[2] * 3, def.seed) < 0.4) continue
      const hii = rand() < 0.05
      push(p, hii ? 0.012 : 0.025 + rand() * 0.03, hii ? HII : mix3(YOUNG, [1, 1, 1], rand() * 0.5), hii ? 1.4 : 0.5, true)
    }
  }
  return { sprites, stars }
}

// Disk basis in scene: major axis from PA on sky, normal tilted by inclination from line of sight.
function diskBasis(def) {
  const c = new THREE.Vector3(...raDecToScene(def.ra, def.dec, 1))
  const north = new THREE.Vector3(...raDecToScene(def.ra, def.dec + 0.05, 1)).sub(c).normalize()
  const east = new THREE.Vector3(...raDecToScene(def.ra + 0.05, def.dec, 1)).sub(c).normalize()
  const pa = THREE.MathUtils.degToRad(def.pa)
  const inc = THREE.MathUtils.degToRad(def.inclination)
  const major = north.clone().multiplyScalar(Math.cos(pa)).addScaledVector(east, Math.sin(pa)).normalize()
  const minorSky = north.clone().multiplyScalar(-Math.sin(pa)).addScaledVector(east, Math.cos(pa)).normalize()
  const normal = c.clone().negate().multiplyScalar(Math.cos(inc)).addScaledVector(minorSky, Math.sin(inc)).normalize()
  const minor = new THREE.Vector3().crossVectors(normal, major).normalize()
  return { major, minor, normal }
}

function buildGalaxy(def, isMobile) {
  const center = raDecToScene(def.ra, def.dec, def.dist)
  const chunk = { x: center[0], y: center[1], z: center[2] }
  const count = Math.round(cfg.sprites * def.weight * (isMobile ? cfg.mobileFactor : 1))
  const { sprites, stars } = buildUnit(def, count)
  const { major, minor, normal } = diskBasis(def)
  const toScene = (x, y, z, out) =>
    out.copy(major).multiplyScalar(x).addScaledVector(minor, y).addScaledVector(normal, z).multiplyScalar(def.radius)

  const n = sprites.length / 8
  const positions = new Float32Array(n * 3)
  const sizes = new Float32Array(n)
  const tints = new Float32Array(n * 4)
  const v = new THREE.Vector3()
  let overlap = 0
  for (let i = 0; i < n; i += 1) {
    toScene(sprites[i * 8], sprites[i * 8 + 1], sprites[i * 8 + 2], v)
    positions.set([v.x, v.y, v.z], i * 3)
    sizes[i] = sprites[i * 8 + 3] * def.radius
    tints.set(sprites.slice(i * 8 + 4, i * 8 + 8), i * 4)
    overlap += sprites[i * 8 + 3] ** 2 * sprites[i * 8 + 7]
  }
  const glow = createSpriteCloud(positions, sizes, tints, chunk, cfg.gain / Math.max(overlap, 1))

  // Resolved stars: bright end only (supergiants/giants). Young → hot, old → red giant.
  const rand = mulberry32(def.seed * 7)
  const ns = stars.length / 4
  const sPos = new Float32Array(ns * 3)
  const sMag = new Float32Array(ns)
  const sTemp = new Float32Array(ns)
  const sCol = new Uint8Array(ns * 3)
  for (let i = 0; i < ns; i += 1) {
    toScene(stars[i * 4], stars[i * 4 + 1], stars[i * 4 + 2], v)
    sPos.set([v.x, v.y, v.z], i * 3)
    const young = stars[i * 4 + 3] > 0.5
    sMag[i] = -2 - 5.5 * rand() ** 2
    sTemp[i] = young ? 12000 + rand() * 20000 : 3600 + rand() * 1400
    sCol.set(temperatureToRgb(sTemp[i]).map((c) => Math.round(c * 255)), i * 3)
  }
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3))
  starGeo.setAttribute('absMag', new THREE.BufferAttribute(sMag, 1))
  starGeo.setAttribute('temp', new THREE.BufferAttribute(sTemp, 1))
  starGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3, true))
  const starPoints = createStarPoints(starGeo, chunk)

  const world = new THREE.Vector3(...center).multiplyScalar(PC_KM)
  const radiusKm = def.radius * PC_KM
  const poi = {
    key: `gal_${def.key}`,
    kind: 'galaxy',
    name: def.name,
    position: world,
    radius: radiusKm,
    labelRange: Infinity,
    factsRange: radiusKm * 3,
    labelVisibility: (distKm) => THREE.MathUtils.smoothstep(distKm, radiusKm * 0.5, radiusKm * 1.4),
    facts: def.facts,
  }
  // Speed only: altitude = distance to center → brake on approach, fly through freely.
  const body = { key: `gal_${def.key}`, kind: 'body', soft: true, position: world, radius: 0 }
  return { glow, starPoints, poi, body }
}

export function createNeighborGalaxies(scene, isMobile) {
  const list = galaxies.map((def) => buildGalaxy(def, isMobile))
  list.forEach(({ glow, starPoints }) => scene.add(glow, starPoints))
  setPoiGroup('galaxies', list.map((g) => g.poi))
  const bodies = list.map((g) => g.body)
  setDeepBodies([...getDeepBodies(), ...bodies])

  const dispose = () => {
    list.forEach(({ glow, starPoints }) => {
      scene.remove(glow, starPoints)
      ;[glow, starPoints].forEach((p) => {
        p.geometry.dispose()
        p.material.dispose()
      })
    })
    setPoiGroup('galaxies', [])
    setDeepBodies(getDeepBodies().filter((b) => !bodies.includes(b)))
  }

  return { dispose }
}
