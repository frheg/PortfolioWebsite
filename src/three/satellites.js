// Live satellites: CelesTrak GP (OMM JSON) → SGP4 (satellite.js) at the *simulated* time.
// Frame: Earth tilt group (equatorial, no spin). TEME/ECI (x, y, z=north) → local (x, z, -y).
// Round-robin propagation budget per frame + velocity extrapolation → thousands at 60 fps.
// Earth shadow: cylinder behind Earth (sun-ward axis), soft edge → sats fade into eclipse.
// Data cached 6 h in localStorage (CelesTrak asks: don't re-download more often than needed).
import * as THREE from 'three'
import { json2satrec, propagate } from 'satellite.js'
import { spaceConfig } from './spaceConfig'
import { origin } from './floatingOrigin'
import { getSimulatedDateMs } from './ephemerisTime'
import { setPoiGroup } from './solarSystemRuntime'

const cfg = spaceConfig.solarSystem.satellites
const CACHE_MS = 6 * 3600 * 1000
const RETRY_MS = 10 * 60 * 1000

let dotTexture = null
function getDot() {
  if (dotTexture) return dotTexture
  const c = document.createElement('canvas')
  c.width = c.height = 32
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.8)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 32, 32)
  dotTexture = new THREE.CanvasTexture(c)
  return dotTexture
}

async function loadGroup(name) {
  const key = `celestrak:${name}`
  try {
    const cached = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (cached && Date.now() - cached.t < CACHE_MS) return cached.data
  } catch {
    // no storage → fetch
  }
  // Relay: edge-cached copy (no CelesTrak rate limits). Else direct.
  const relay = spaceConfig.relay.url
  const res = await fetch(relay ? `${relay}/sats/${name}` : `https://celestrak.org/NORAD/elements/gp.php?GROUP=${name}&FORMAT=json`)
  if (!res.ok) throw new Error(`celestrak ${res.status}`)
  const data = await res.json()
  try {
    localStorage.setItem(key, JSON.stringify({ t: Date.now(), data }))
  } catch {
    // quota (Starlink is big) → session only
  }
  return data
}

// ECI (km) → Earth tilt-group local.
const eciToLocal = (p, out, i) => {
  out[i] = p.x
  out[i + 1] = p.z
  out[i + 2] = -p.y
}

const _q = new THREE.Quaternion()
const _sun = new THREE.Vector3()
const SHADOW_FLOOR = 0.06 // eclipsed brightness (earthshine-ish)

/** earth: bodyMap entry (world, tiltGroup). */
export function createSatellites(earth, isMobile) {
  const root = new THREE.Group()
  earth.tiltGroup.add(root)
  const sets = []
  const named = [] // { rec, poi, local: Vector3 }
  let disposed = false

  const addSet = (def, omms) => {
    const list = isMobile && def.mobileLimit ? omms.slice(0, def.mobileLimit) : omms
    const recs = []
    const names = []
    for (const omm of list) {
      try {
        recs.push(json2satrec(omm))
        names.push(omm.OBJECT_NAME)
      } catch {
        // malformed element set → skip
      }
    }
    const n = recs.length
    const pos = new Float32Array(n * 3)
    const vel = new Float32Array(n * 3)
    const tSat = new Float64Array(n).fill(NaN) // sim ms of last propagation
    const geometry = new THREE.BufferGeometry()
    const attr = new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage)
    geometry.setAttribute('position', attr)
    const light = new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3).setUsage(THREE.DynamicDrawUsage)
    geometry.setAttribute('color', light)
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)
    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: def.color,
        size: def.sizePx,
        sizeAttenuation: false,
        map: getDot(),
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    )
    points.frustumCulled = false
    root.add(points)
    sets.push({ def, recs, names, pos, vel, tSat, attr, light, points, cursor: 0 })

    for (const spec of cfg.labeled) {
      const i = names.findIndex((nm) => new RegExp(spec.match).test(nm))
      if (i < 0 || named.some((x) => x.spec === spec)) continue
      named.push({
        spec,
        rec: recs[i],
        local: new THREE.Vector3(),
        poi: {
          key: `sat_${spec.key}`,
          kind: 'satellite',
          name: spec.name,
          position: new THREE.Vector3(),
          radius: 0.05,
          labelRange: cfg.labelRangeKm,
          factsRange: 3000,
          facts: spec.facts,
        },
      })
    }
    setPoiGroup('satellites', named.map((x) => x.poi))
  }

  // One load per group; on failure back off (never hammer CelesTrak — they rate-limit by IP).
  const loaded = new Set()
  const retryAt = new Map()
  const ensure = (def) => {
    if (loaded.has(def.group) || Date.now() < (retryAt.get(def.group) ?? 0)) return
    loaded.add(def.group)
    loadGroup(def.group)
      .then((omms) => !disposed && addSet(def, omms))
      .catch(() => {
        loaded.delete(def.group)
        retryAt.set(def.group, Date.now() + RETRY_MS)
      })
  }
  cfg.groups.filter((g) => !g.lazy).forEach(ensure)

  // ISS orbit track (one period around now).
  const trackGeo = new THREE.BufferGeometry()
  trackGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cfg.trackPoints * 3), 3))
  const track = new THREE.Line(trackGeo, new THREE.LineBasicMaterial({ color: 0xfab387, transparent: true, opacity: 0.45, depthWrite: false }))
  track.frustumCulled = false
  root.add(track)
  let trackAt = -Infinity

  const p = { x: 0, y: 0, z: 0 }
  const tmp = new Float32Array(3)

  const update = () => {
    const camDist = origin.distanceTo(earth.world)
    root.visible = camDist < cfg.visibleKm
    if (!root.visible) return
    cfg.groups.filter((g) => g.lazy && camDist < g.loadWithinKm).forEach(ensure)

    const nowMs = getSimulatedDateMs()
    const date = new Date(nowMs)
    // Sun dir in tilt-local frame (lod.sunDir: world, Earth → Sun).
    earth.tiltGroup.getWorldQuaternion(_q)
    _sun.copy(earth.lod.sunDir.value).applyQuaternion(_q.invert())
    const R = earth.def.radius
    const sx = _sun.x
    const sy = _sun.y
    const sz = _sun.z
    let budget = isMobile ? cfg.budgetMobile : cfg.budget
    for (const s of sets) {
      const n = s.recs.length
      const steps = Math.min(n, budget)
      budget -= steps
      for (let k = 0; k < steps; k += 1) {
        const i = s.cursor
        s.cursor = (s.cursor + 1) % n
        const pv = propagate(s.recs[i], date)
        if (!pv || !pv.position) continue
        eciToLocal(pv.position, s.pos, i * 3)
        eciToLocal(pv.velocity, s.vel, i * 3)
        s.tSat[i] = nowMs
      }
      // Everyone: extrapolate from last fix (km/s · s).
      const out = s.attr.array
      const { light } = s
      for (let i = 0; i < n; i += 1) {
        if (Number.isNaN(s.tSat[i])) {
          out[i * 3] = out[i * 3 + 1] = out[i * 3 + 2] = 0
          continue
        }
        const dt = (nowMs - s.tSat[i]) / 1000
        out[i * 3] = s.pos[i * 3] + s.vel[i * 3] * dt
        out[i * 3 + 1] = s.pos[i * 3 + 1] + s.vel[i * 3 + 1] * dt
        out[i * 3 + 2] = s.pos[i * 3 + 2] + s.vel[i * 3 + 2] * dt
        // Eclipse: behind Earth + inside shadow cylinder.
        const x = out[i * 3]
        const y = out[i * 3 + 1]
        const z = out[i * 3 + 2]
        const along = x * sx + y * sy + z * sz
        let b = 1
        if (along < 0) {
          const perp = Math.sqrt(Math.max(0, x * x + y * y + z * z - along * along))
          const t = Math.min(1, Math.max(0, (perp - R * 0.985) / (R * 0.03)))
          b = SHADOW_FLOOR + (1 - SHADOW_FLOOR) * t * t * (3 - 2 * t)
        }
        light.array[i * 3] = light.array[i * 3 + 1] = light.array[i * 3 + 2] = b
      }
      s.attr.needsUpdate = true
      light.needsUpdate = true
      s.points.geometry.setDrawRange(0, n)
    }

    // Labeled: exact propagation every frame, world pos for labels.
    earth.tiltGroup.getWorldQuaternion(_q)
    for (const x of named) {
      const pv = propagate(x.rec, date)
      if (!pv || !pv.position) continue
      eciToLocal(pv.position, tmp, 0)
      x.local.set(tmp[0], tmp[1], tmp[2])
      x.poi.position.copy(x.local).applyQuaternion(_q).add(earth.world)
    }

    // Track: refresh when sim time moved > 20 s or jumped.
    const iss = named.find((x) => x.spec.key === 'iss')
    if (iss && Math.abs(nowMs - trackAt) > 20000) {
      trackAt = nowMs
      const periodMs = ((2 * Math.PI) / iss.rec.no) * 60000 // no: rad/min
      const arr = trackGeo.attributes.position.array
      for (let k = 0; k < cfg.trackPoints; k += 1) {
        const pv = propagate(iss.rec, new Date(nowMs + (k / (cfg.trackPoints - 1) - 0.5) * periodMs))
        if (!pv || !pv.position) continue
        p.x = pv.position.x
        p.y = pv.position.y
        p.z = pv.position.z
        eciToLocal(p, arr, k * 3)
      }
      trackGeo.attributes.position.needsUpdate = true
    }
    track.visible = Boolean(iss) && camDist < cfg.trackVisibleKm
  }

  const dispose = () => {
    disposed = true
    earth.tiltGroup.remove(root)
    sets.forEach((s) => {
      s.points.geometry.dispose()
      s.points.material.dispose()
    })
    trackGeo.dispose()
    track.material.dispose()
    setPoiGroup('satellites', [])
  }

  return { update, dispose }
}
