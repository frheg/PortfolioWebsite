// Flights: OpenSky snapshot (GitHub Actions → relay, ~5 min old) or, if missing/stale/offline, simulated traffic.
// Polls the 1° grid point under the camera (~250 km radius). Dead reckoning: ground speed, track, vertical rate.
// Instanced low-poly planes in terrain's Earth-local group (spin with Earth), min on-screen size.
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'
import { origin } from './floatingOrigin'
import { getEarthFrame, getEarthHeightAt } from './earthTerrain'
import { createVertexColorMaterial } from './bodyLod'
import { getPlaneGeometry } from './vehicleModels'
import { simulateFlights } from './flightSim'

const cfg = spaceConfig.solarSystem.flights
const KNOT_KMS = 0.000514444
const FT_KM = 0.0003048
const DEG = Math.PI / 180

let state = null
let flightsActive = false
let simulated = false
/** HUD / labels: current planes are simulated (no fresh live snapshot). */
export function areFlightsSimulated() {
  return simulated
}
/** HUD: attribution while planes render. */
export function areFlightsActive() {
  return flightsActive
}

const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _up = new THREE.Vector3()
const _e = new THREE.Vector3()
const _n = new THREE.Vector3()
const _f = new THREE.Vector3()
const _s = new THREE.Vector3()
const _c = new THREE.Color()
const _w = new THREE.Vector3()

// Altitude tint: low amber → high cyan.
function altColor(km) {
  const t = Math.min(1, Math.max(0, km / 11))
  return _c.setRGB(1 - 0.45 * t, 0.82 + 0.1 * t, 0.55 + 0.45 * t)
}

/** sunDir / planetCenter: shared lighting. */
export function createFlights(group, R, sunDir, planetCenter) {
  const relay = spaceConfig.relay.url
  const planes = new THREE.InstancedMesh(getPlaneGeometry(), createVertexColorMaterial(sunDir, planetCenter), cfg.maxModels)
  planes.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  planes.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cfg.maxModels * 3), 3)
  planes.count = 0
  planes.frustumCulled = false
  group.add(planes)

  const list = [] // { hex, call, type, reg, lat, lon, altKm, gs, trk, vs, t, ground }
  const local = new Float32Array(cfg.maxModels * 3)
  state = { list, local }
  let cell = ''
  let lastPoll = -Infinity
  let polling = false

  const fetchLive = async (lat, lon) => {
    if (!relay) return null
    try {
      const r = await fetch(`${relay}/flights?lat=${lat}&lon=${lon}`)
      if (!r.ok) return null
      const j = await r.json()
      return j.stale ? null : (j.aircraft ?? j.ac ?? [])
    } catch {
      return null
    }
  }

  const poll = async (lat, lon) => {
    polling = true
    try {
      // Live snapshot if fresh, else simulated (same clock for everyone).
      const live = await fetchLive(lat, lon)
      const now = Date.now()
      simulated = live === null
      const rows = live ?? simulateFlights(lat, lon, now)
      list.length = 0
      for (const a of rows) {
        if (typeof a.lat !== 'number' || typeof a.lon !== 'number') continue
        const ground = a.alt_baro === 'ground'
        const ft = typeof a.alt_geom === 'number' ? a.alt_geom : typeof a.alt_baro === 'number' ? a.alt_baro : 0
        list.push({
          hex: a.hex,
          call: (a.flight ?? '').trim() || a.r || a.hex,
          type: a.t ?? '',
          lat: a.lat,
          lon: a.lon,
          ground,
          altKm: Math.max(0, ft * FT_KM),
          gs: a.gs ?? 0,
          trk: a.track ?? a.true_heading ?? 0,
          vs: (a.geom_rate ?? a.baro_rate ?? 0) * FT_KM / 60, // km/s
          t: now - (a.seen_pos ?? 0) * 1000,
        })
        if (list.length >= cfg.maxModels) break
      }
    } finally {
      polling = false
    }
  }

  /** camLocal: Earth-local km. camAlt: km. focalPx: px at 1 km. */
  const update = (camLocal, camAlt, focalPx) => {
    const on = camAlt < cfg.maxAltKm
    planes.visible = on
    flightsActive = on && list.length > 0
    if (!on) return
    const d = _p.copy(camLocal).normalize()
    const lat = Math.round(Math.asin(d.y) / DEG)
    const lon = Math.round(Math.atan2(-d.z, d.x) / DEG)
    const now = Date.now()
    const key = `${lat}/${lon}`
    const maxExtra = simulated ? cfg.pollMs / 1000 + 5 : cfg.maxExtrapolateS
    if (!polling && (key !== cell || now - lastPoll > cfg.pollMs)) {
      cell = key
      lastPoll = now
      poll(lat, lon)
    }

    const frame = getEarthFrame()
    const minScale = cfg.modelMinPx / Math.max(focalPx, 1)
    for (let i = 0; i < list.length; i += 1) {
      const a = list[i]
      const dt = Math.min(Math.max((now - a.t) / 1000, 0), maxExtra)
      const dist = a.gs * KNOT_KMS * dt
      const la = (a.lat + (dist * Math.cos(a.trk * DEG)) / R / DEG) * DEG
      const lo = (a.lon + (dist * Math.sin(a.trk * DEG)) / (R * Math.cos(a.lat * DEG)) / DEG) * DEG
      _up.set(Math.cos(lo) * Math.cos(la), Math.sin(la), -Math.sin(lo) * Math.cos(la))
      // Ground traffic: sit on terrain.
      let alt = Math.max(0, a.altKm + a.vs * dt)
      if (a.ground && frame) alt = getEarthHeightAt(_w.copy(_up).multiplyScalar(R).applyQuaternion(frame.quaternion).add(frame.world)) + 0.003
      _p.copy(_up).multiplyScalar(R + alt)
      local.set([_p.x, _p.y, _p.z], i * 3)

      // Basis: nose along track, pitched by climb angle; +y up, +z starboard.
      _e.set(0, 1, 0).cross(_up).normalize()
      _n.copy(_up).cross(_e)
      const h = a.trk * DEG
      const pitch = a.gs > 30 ? Math.atan2(a.vs, a.gs * KNOT_KMS) : 0
      _f.copy(_n).multiplyScalar(Math.cos(h)).addScaledVector(_e, Math.sin(h))
      _f.multiplyScalar(Math.cos(pitch)).addScaledVector(_up, Math.sin(pitch)).normalize()
      _s.copy(_f).cross(_up).normalize()
      const upB = _w.copy(_s).cross(_f)
      const scale = Math.max(cfg.modelKm, _p.distanceTo(camLocal) * minScale)
      _m.makeBasis(_f.multiplyScalar(scale), upB.multiplyScalar(scale), _s.multiplyScalar(scale)).setPosition(_p)
      planes.setMatrixAt(i, _m)
      planes.setColorAt(i, altColor(alt))
      a.altNow = alt
    }
    planes.count = list.length
    planes.instanceMatrix.needsUpdate = true
    if (planes.instanceColor) planes.instanceColor.needsUpdate = true
  }

  const dispose = () => {
    group.remove(planes)
    planes.material.dispose()
    planes.dispose()
    state = null
    flightsActive = false
  }

  return { update, dispose }
}

/** Callsign labels near camera → pooled label format. */
export function collectFlightLabels(camera, width, height) {
  const frame = getEarthFrame()
  if (!state || !flightsActive || !frame) return []
  const out = []
  for (let i = 0; i < state.list.length && out.length < cfg.maxLabels; i += 1) {
    _p.set(state.local[i * 3], state.local[i * 3 + 1], state.local[i * 3 + 2]).applyQuaternion(frame.quaternion).add(frame.world)
    const dist = _p.distanceTo(origin)
    if (dist > cfg.labelRangeKm) continue
    _p.sub(origin).project(camera)
    if (_p.z > 1 || Math.abs(_p.x) > 1 || Math.abs(_p.y) > 1) continue
    const a = state.list[i]
    const alt = a.altNow ?? 0
    out.push({
      name: `${a.call}${a.type ? ` · ${a.type}` : ''}`,
      kind: 'plane',
      x: (_p.x * 0.5 + 0.5) * width,
      y: (-_p.y * 0.5 + 0.5) * height - 1,
      opacity: 1 - THREE.MathUtils.smoothstep(dist, cfg.labelRangeKm * 0.6, cfg.labelRangeKm),
      title: `${alt < 1 ? `${Math.round(alt * 1000)} m` : `${alt.toFixed(1)} km`} · ${Math.round(a.gs)} kn${simulated ? ' · simulert' : ''}`,
    })
  }
  return out
}
