// Dense Earth names (GeoNames cities ≥15k + Natural Earth geography). Lazy-loaded near Earth.
// Per frame: candidates by altitude threshold + horizon → project → priority sort → greedy
// screen-space declutter → ≤ MAX labels. Rendered by a fixed DOM pool (PlanetLabels).
import * as THREE from 'three'
import { origin } from './floatingOrigin'
import { getEarthFrame, getEarthHeightAt } from './earthTerrain'
import { surfacePlaces } from '../data/surfacePlaces'

const MAX_LABELS = 70
const LABEL_H = 15

let data = null // { dirs Float32Array, names, minAlt Float32Array, priority Float32Array, kind[] }
let loading = false

// Show-below altitude (km) by importance.
const cityMinAlt = (pop) =>
  pop >= 1e7 ? 3000 : pop >= 3e6 ? 1800 : pop >= 1e6 ? 900 : pop >= 3e5 ? 350 : pop >= 1e5 ? 140 : pop >= 5e4 ? 70 : 40

function featureMinAlt(kind, rank, elevKm, cls) {
  if (kind === 'water') {
    if (cls === 'ocean') return 6000
    if (cls === 'sea') return rank <= 2 ? 3000 : 1500
    if (cls === 'fjord' || cls === 'river' || cls === 'inlet' || cls === 'lagoon') return 160
    return rank <= 3 ? 1500 : rank <= 5 ? 600 : 200
  }
  if (kind === 'mountain') return elevKm >= 7 ? 600 : elevKm >= 5 ? 300 : elevKm >= 3 ? 120 : 60
  return rank <= 3 ? 1200 : rank <= 5 ? 400 : 120
}

async function load() {
  loading = true
  const res = await fetch(`${import.meta.env.BASE_URL}data/places-earth.json`)
  if (!res.ok) throw new Error('places fetch failed')
  const { cities, features } = await res.json()
  // Hand-curated labels (with facts) win → skip same-name duplicates.
  const curated = new Set(surfacePlaces.earth.map((p) => p.name))
  const rows = [
    ...cities.filter((c) => !curated.has(c[0])).map(([n, lat, lon, pop]) => [n, lat, lon, 'city', cityMinAlt(pop), pop]),
    ...features
      .filter((f) => !curated.has(f[0]))
      .map(([n, lat, lon, kind, rank, elev, cls]) => {
        const minAlt = featureMinAlt(kind, rank, elev, cls)
        return [n, lat, lon, kind, minAlt, minAlt * 1e4] // big features outrank towns
      }),
  ]
  const n = rows.length
  const dirs = new Float32Array(n * 3)
  const minAlt = new Float32Array(n)
  const priority = new Float32Array(n)
  rows.forEach(([, lat, lon, , alt, prio], i) => {
    const la = THREE.MathUtils.degToRad(lat)
    const lo = THREE.MathUtils.degToRad(lon)
    dirs[i * 3] = Math.cos(lo) * Math.cos(la)
    dirs[i * 3 + 1] = Math.sin(la)
    dirs[i * 3 + 2] = -Math.sin(lo) * Math.cos(la)
    minAlt[i] = alt
    priority[i] = prio
  })
  data = { dirs, minAlt, priority, names: rows.map((r) => r[0]), kind: rows.map((r) => r[3]) }
}

const _qi = new THREE.Quaternion()
const _camLocal = new THREE.Vector3()
const _p = new THREE.Vector3()
const _g = new THREE.Vector3()
const candidates = []
const placed = []

/**
 * → labels [{ name, kind, x, y, opacity }] (screen px). Empty when far from Earth / not loaded.
 * focus: 0..1 Earth focus (labels shown fully only when ~ in Earth's vicinity).
 */
export function collectEarthNames(camera, width, height) {
  const frame = getEarthFrame()
  if (!frame) return []
  const R = frame.radius
  _camLocal.subVectors(origin, frame.world)
  const camAlt = _camLocal.length() - R
  if (camAlt > 6000) return []
  if (!data) {
    if (!loading) load().catch(() => (loading = false))
    return []
  }
  _qi.copy(frame.quaternion).invert()
  _camLocal.applyQuaternion(_qi)
  const camDist = _camLocal.length()
  const cx = _camLocal.x / camDist
  const cy = _camLocal.y / camDist
  const cz = _camLocal.z / camDist
  // Horizon + a bit (labels for tall stuff/near horizon), and a range cap when low.
  const horizonAng = Math.acos(Math.min(1, R / camDist))
  const rangeAng = Math.min(horizonAng * 1.1, (Math.sqrt(2 * R * Math.max(camAlt, 0.05)) * 1.2 + 15) / R)
  const cosRange = Math.cos(rangeAng)

  const { dirs, minAlt, priority } = data
  candidates.length = 0
  for (let i = 0; i < minAlt.length; i += 1) {
    if (camAlt > minAlt[i]) continue
    const d = dirs[i * 3] * cx + dirs[i * 3 + 1] * cy + dirs[i * 3 + 2] * cz
    if (d < cosRange) continue
    candidates.push(i)
  }
  candidates.sort((a, b) => priority[b] - priority[a])

  placed.length = 0
  const out = []
  for (const i of candidates) {
    if (out.length >= MAX_LABELS) break
    // On the ground (terrain height) → no float above surface when low.
    _p.set(dirs[i * 3], dirs[i * 3 + 1], dirs[i * 3 + 2]).applyQuaternion(frame.quaternion)
    _g.copy(_p).multiplyScalar(R).add(frame.world)
    _p.multiplyScalar(R + getEarthHeightAt(_g) + 0.002).add(frame.world).sub(origin)
    const dist = _p.length()
    _p.project(camera)
    if (_p.z > 1 || Math.abs(_p.x) > 1.05 || Math.abs(_p.y) > 1.05) continue
    const x = (_p.x * 0.5 + 0.5) * width
    const y = (-_p.y * 0.5 + 0.5) * height
    const name = data.names[i]
    const w = name.length * 6.2 + 16
    const box = [x - w / 2, y - LABEL_H, x + w / 2, y + 2]
    if (placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue
    placed.push(box)
    const opacity = 1 - THREE.MathUtils.smoothstep(camAlt, minAlt[i] * 0.6, minAlt[i])
    out.push({ name, kind: data.kind[i], x, y, opacity, dist })
  }
  return out
}
