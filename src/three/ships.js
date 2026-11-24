// Live Baltic ships: Fintraffic Digitraffic AIS (CC BY 4.0), polled ~1/min while you're near the region.
// Dead reckoning (speed + course) between polls → smooth, real-time motion.
// Points live in terrain's Earth-local group (spin with Earth). Names via pooled labels up close.
// Near camera: instanced low-poly boats (AIS length, heading), min on-screen size → readable icons.
import * as THREE from 'three'
import { createVertexColorMaterial } from './bodyLod'
import { getBoatGeometry } from './vehicleModels'
import { spaceConfig } from './spaceConfig'
import { origin } from './floatingOrigin'
import { getEarthFrame } from './earthTerrain'

const cfg = spaceConfig.solarSystem.ships
const KNOT_KMS = 0.000514444
const DEG = Math.PI / 180

// AIS ship type → color.
function typeColor(t) {
  if (t >= 60 && t < 70) return [0.55, 0.85, 1.0] // passenger
  if (t >= 70 && t < 80) return [0.6, 1.0, 0.65] // cargo
  if (t >= 80 && t < 90) return [1.0, 0.55, 0.45] // tanker
  if (t === 30) return [1.0, 0.85, 0.4] // fishing
  if (t === 36 || t === 37) return [0.95, 0.75, 1.0] // sailing / pleasure
  return [0.9, 0.9, 0.9]
}

const TYPE_NAME = (t) =>
  t >= 60 && t < 70 ? 'Passasjer' : t >= 70 && t < 80 ? 'Last' : t >= 80 && t < 90 ? 'Tanker' : t === 30 ? 'Fiske' : t === 36 ? 'Seil' : t === 37 ? 'Fritid' : 'Fartøy'

// Soft round sprite (plain PointsMaterial = squares).
let roundDot = null
function getRoundDot() {
  if (roundDot) return roundDot
  const c = document.createElement('canvas')
  c.width = c.height = 32
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.45, 'rgba(255,255,255,0.85)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 32, 32)
  roundDot = new THREE.CanvasTexture(c)
  return roundDot
}

let state = null // module-level for label collection

let shipsActive = false
export function areShipsActive() {
  return shipsActive
}

const _m = new THREE.Matrix4()
const _f = new THREE.Vector3()
const _u = new THREE.Vector3()
const _e = new THREE.Vector3()
const _up = new THREE.Vector3()
const _n = new THREE.Vector3()
const _s = new THREE.Vector3()
const _c = new THREE.Color()

/** sunDir / planetCenter: shared lighting (see createVertexColorMaterial). */
export function createShips(group, R, sunDir, planetCenter) {
  const max = cfg.maxShips
  const geometry = new THREE.BufferGeometry()
  const pos = new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage)
  const col = new THREE.BufferAttribute(new Float32Array(max * 3), 3)
  geometry.setAttribute('position', pos)
  geometry.setAttribute('color', col)
  geometry.setDrawRange(0, 0)
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ size: cfg.sizePx * 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, map: getRoundDot() })
  )
  points.frustumCulled = false
  group.add(points)

  const boats = new THREE.InstancedMesh(getBoatGeometry(), createVertexColorMaterial(sunDir, planetCenter), cfg.maxModels)
  boats.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  boats.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cfg.maxModels * 3), 3)
  boats.count = 0
  boats.frustumCulled = false
  group.add(boats)
  const near = [] // scratch: { i, d }

  const ships = [] // { mmsi, lat, lon, sog, cog, t, type, name, dest }
  const meta = new Map()
  let lastPoll = -Infinity
  let lastMeta = -Infinity
  let polling = false

  const poll = async () => {
    polling = true
    try {
      const since = Date.now() - cfg.windowMs
      const [loc, ves] = await Promise.all([
        fetch(`${cfg.baseUrl}/locations?from=${since}`).then((r) => r.json()),
        Date.now() - lastMeta > cfg.metaEveryMs ? fetch(`${cfg.baseUrl}/vessels?from=${Date.now() - 24 * 3600e3}`).then((r) => r.json()) : null,
      ])
      if (ves) {
        lastMeta = Date.now()
        ves.forEach((v) => meta.set(v.mmsi, v))
      }
      ships.length = 0
      for (const f of loc.features ?? []) {
        const p = f.properties
        const m = meta.get(p.mmsi)
        ships.push({
          mmsi: p.mmsi,
          lon: f.geometry.coordinates[0],
          lat: f.geometry.coordinates[1],
          sog: p.sog > 102 ? 0 : p.sog, // 102.3 = n/a
          cog: p.cog >= 360 ? 0 : p.cog,
          hdg: p.heading < 360 ? p.heading : p.cog >= 360 ? 0 : p.cog,
          lenM: m && m.referencePointA + m.referencePointB > 0 ? m.referencePointA + m.referencePointB : 40,
          t: p.timestampExternal,
          type: m?.shipType ?? 0,
          name: m?.name?.trim() || `MMSI ${p.mmsi}`,
          dest: m?.destination?.trim() || '',
        })
        if (ships.length >= max) break
      }
      ships.forEach((s, i) => col.array.set(typeColor(s.type), i * 3))
      col.needsUpdate = true
      geometry.setDrawRange(0, ships.length)
    } catch {
      // offline / blocked → keep last
    } finally {
      polling = false
    }
  }

  const local = new Float32Array(max * 3)
  state = { ships, local, R }

  /** camLocal: Earth-local km. camAlt: km. focalPx: px per unit at 1 km. */
  const update = (camLocal, camAlt, focalPx) => {
    const d = camLocal.clone().normalize()
    const lat = Math.asin(d.y) / DEG
    const lon = Math.atan2(-d.z, d.x) / DEG
    const [la0, lo0, la1, lo1] = cfg.bbox
    const inRegion = camAlt < cfg.maxAltKm && lat > la0 - 5 && lat < la1 + 5 && lon > lo0 - 8 && lon < lo1 + 8
    points.visible = inRegion
    boats.visible = inRegion
    shipsActive = inRegion && ships.length > 0
    if (!inRegion) return
    const now = Date.now()
    if (!polling && now - lastPoll > cfg.pollMs) {
      lastPoll = now
      poll()
    }
    // Dead reckoning from each fix (capped), → Earth-local km.
    const arr = pos.array
    for (let i = 0; i < ships.length; i += 1) {
      const s = ships[i]
      const dtS = Math.min(Math.max((now - s.t) / 1000, 0), cfg.maxExtrapolateS)
      const distKm = s.sog * KNOT_KMS * dtS
      const la = (s.lat + ((distKm * Math.cos(s.cog * DEG)) / R) / DEG) * DEG
      const lo = (s.lon + ((distKm * Math.sin(s.cog * DEG)) / (R * Math.cos(s.lat * DEG))) / DEG) * DEG
      const c = Math.cos(la)
      const r = R + 0.01
      arr[i * 3] = Math.cos(lo) * c * r
      arr[i * 3 + 1] = Math.sin(la) * r
      arr[i * 3 + 2] = -Math.sin(lo) * c * r
    }
    local.set(arr.subarray(0, ships.length * 3))

    // Models: nearest within range (cap). Their points parked at Earth center (depth-hidden).
    near.length = 0
    const r2 = cfg.modelRangeKm * cfg.modelRangeKm
    for (let i = 0; i < ships.length; i += 1) {
      const dx = local[i * 3] - camLocal.x
      const dy = local[i * 3 + 1] - camLocal.y
      const dz = local[i * 3 + 2] - camLocal.z
      const d2 = dx * dx + dy * dy + dz * dz
      if (d2 < r2) near.push({ i, d: Math.sqrt(d2) })
    }
    if (near.length > cfg.maxModels) near.sort((a, b) => a.d - b.d).length = cfg.maxModels
    const minScale = cfg.modelMinPx / Math.max(focalPx, 1) // km per km of distance
    near.forEach(({ i, d }, k) => {
      const s = ships[i]
      _u.set(local[i * 3], local[i * 3 + 1], local[i * 3 + 2])
      const up = _up.copy(_u).normalize()
      // Heading: 0 = north (toward +y pole), 90 = east. East = north × up... ENU: e = n̂pole × up.
      _e.set(0, 1, 0).cross(up).normalize()
      const north = _n.copy(up).cross(_e)
      const h = s.hdg * DEG
      _f.copy(north).multiplyScalar(Math.cos(h)).addScaledVector(_e, Math.sin(h))
      const side = _s.copy(_f).cross(up)
      const scale = Math.max(s.lenM / 1000, d * minScale)
      _m.makeBasis(_f.multiplyScalar(scale), up.multiplyScalar(scale), side.multiplyScalar(scale)).setPosition(_u)
      boats.setMatrixAt(k, _m)
      const tc = typeColor(s.type)
      boats.setColorAt(k, _c.setRGB(tc[0], tc[1], tc[2]))
      arr[i * 3] = arr[i * 3 + 1] = arr[i * 3 + 2] = 0
    })
    boats.count = near.length
    boats.instanceMatrix.needsUpdate = true
    if (boats.instanceColor) boats.instanceColor.needsUpdate = true
    pos.needsUpdate = true
  }

  const dispose = () => {
    group.remove(points)
    group.remove(boats)
    geometry.dispose()
    points.material.dispose()
    boats.material.dispose()
    boats.dispose()
    state = null
    shipsActive = false
  }

  return { update, dispose }
}

const _p = new THREE.Vector3()

/** Ship name labels near the camera → pooled label format. */
export function collectShipLabels(camera, width, height) {
  const frame = getEarthFrame()
  if (!state || !shipsActive || !frame) return []
  const out = []
  for (let i = 0; i < state.ships.length && out.length < cfg.maxLabels; i += 1) {
    _p.set(state.local[i * 3], state.local[i * 3 + 1], state.local[i * 3 + 2]).applyQuaternion(frame.quaternion).add(frame.world)
    const dist = _p.distanceTo(origin)
    if (dist > cfg.labelRangeKm) continue
    _p.sub(origin).project(camera)
    if (_p.z > 1 || Math.abs(_p.x) > 1 || Math.abs(_p.y) > 1) continue
    const s = state.ships[i]
    const speed = s.sog > 0.5 ? ` · ${s.sog.toFixed(0)} kn` : ''
    out.push({
      name: `${s.name}${speed}`,
      kind: 'ship',
      dist,
      x: (_p.x * 0.5 + 0.5) * width,
      y: (-_p.y * 0.5 + 0.5) * height - 1,
      opacity: 1 - THREE.MathUtils.smoothstep(dist, cfg.labelRangeKm * 0.6, cfg.labelRangeKm),
      title: `${TYPE_NAME(s.type)}${s.dest ? ` → ${s.dest}` : ''}`,
    })
  }
  return out
}
