// Minimap extras: planet (orthographic globe from body texture, north up, zooms with altitude),
// Earth low-alt (satellite tiles, Web Mercator) and Local Group (top-down galactic plane).
import * as THREE from 'three'
import { origin } from '../three/floatingOrigin'
import { spaceConfig } from '../three/spaceConfig'
import { LY_KM, PC_KM, GALAXY_AXES, raDecToScene, sceneToGalaxyKpc } from '../three/galaxyFrame'
import { galaxies } from '../data/deepSpaceObjects'

const DEG = Math.PI / 180
const GLOBE_N = 128 // offscreen raster (px), upscaled
const EARTH_TILE_ALT_KM = 400 // below → tile map
const TILE_CACHE = 96

const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

// Inverse body quaternion applied to v (world dir) → body-local [x,y,z].
const _v = new THREE.Vector3()
const _q = new THREE.Quaternion()
function toLocal(q, v) {
  _v.set(v[0], v[1], v[2]).applyQuaternion(_q.copy(q).invert())
  return [_v.x, _v.y, _v.z]
}

/** Camera over body → { lat, lon (texture lon, rad), alt, up, east, north (body-local), fwd [e, n] }. */
export function bodyView(body, forwardWorld) {
  const rel = [origin.x - body.position.x, origin.y - body.position.y, origin.z - body.position.z]
  const r = Math.hypot(...rel)
  const p = toLocal(body.frameQ, rel.map((c) => c / r))
  const lat = Math.asin(Math.max(-1, Math.min(1, p[1])))
  const lon = Math.atan2(-p[2], p[0])
  const up = [Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon)]
  const east = [-Math.sin(lon), 0, -Math.cos(lon)]
  const north = [-Math.sin(lat) * Math.cos(lon), Math.cos(lat), Math.sin(lat) * Math.sin(lon)]
  const f = toLocal(body.frameQ, forwardWorld)
  return { lat, lon, alt: r - body.radius, up, east, north, fwd: [dot3(f, east), dot3(f, north)] }
}

// ─── texture texels (once per image) ─────────────────────────────────────────

const texelCache = new WeakMap()
function texels(img) {
  if (!img || !(img.width > 0)) return null
  let t = texelCache.get(img)
  if (t) return t
  const W = 1024
  const H = 512
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, W, H)
  t = { data: ctx.getImageData(0, 0, W, H).data, W, H }
  texelCache.set(img, t)
  return t
}

// ─── globe ───────────────────────────────────────────────────────────────────

const globe = { canvas: null, img: null, key: '', at: 0 }

function globeCanvas() {
  if (!globe.canvas) {
    globe.canvas = document.createElement('canvas')
    globe.canvas.width = globe.canvas.height = GLOBE_N
    globe.img = globe.canvas.getContext('2d').createImageData(GLOBE_N, GLOBE_N)
  }
  return globe.canvas
}

/** rho: half view extent, in body radii on the tangent plane. sunL: body-local sun dir. */
function renderGlobe(id, tex, v, rho, sunL, now) {
  const canvas = globeCanvas()
  const key = `${id}:${v.lat.toFixed(4)}:${v.lon.toFixed(4)}:${rho.toFixed(4)}`
  if (key === globe.key || now - globe.at < 66) return canvas
  globe.key = key
  globe.at = now
  const { data, W, H } = tex
  const out = globe.img.data
  const { up: U, east: E, north: N } = v
  for (let py = 0; py < GLOBE_N; py += 1) {
    const y = -((py + 0.5) / GLOBE_N * 2 - 1) * rho
    for (let px = 0; px < GLOBE_N; px += 1) {
      const x = ((px + 0.5) / GLOBE_N * 2 - 1) * rho
      const o = (py * GLOBE_N + px) * 4
      const p2 = x * x + y * y
      if (p2 > 1) {
        out[o + 3] = 0
        continue
      }
      const z = Math.sqrt(1 - p2)
      const X = z * U[0] + x * E[0] + y * N[0]
      const Y = z * U[1] + x * E[1] + y * N[1]
      const Z = z * U[2] + x * E[2] + y * N[2]
      const lat = Math.asin(Math.max(-1, Math.min(1, Y)))
      const lon = Math.atan2(-Z, X)
      const tx = Math.min(W - 1, Math.floor((0.5 + lon / (2 * Math.PI)) * W))
      const ty = Math.min(H - 1, Math.floor((0.5 - lat / Math.PI) * H))
      const i = (ty * W + tx) * 4
      // Day/night: soft terminator, night floor 0.28.
      const s = X * sunL[0] + Y * sunL[1] + Z * sunL[2]
      const light = 0.28 + 0.72 * Math.min(1, Math.max(0, (s + 0.1) / 0.3))
      out[o] = data[i] * light
      out[o + 1] = data[i + 1] * light
      out[o + 2] = data[i + 2] * light
      out[o + 3] = 255
    }
  }
  canvas.getContext('2d').putImageData(globe.img, 0, 0)
  return canvas
}

// ─── Earth tiles ─────────────────────────────────────────────────────────────

const tiles = new Map() // key → Image (LRU by reinsertion)
function tileImage(z, x, y) {
  const key = `${z}/${x}/${y}`
  let img = tiles.get(key)
  if (img) {
    tiles.delete(key)
    tiles.set(key, img)
    return img.complete && img.naturalWidth ? img : null
  }
  const t = spaceConfig.solarSystem.earthTerrain
  img = new Image()
  img.src = (z <= t.imageryMaxZoom ? t.imageryUrl : t.closeImageryUrl).replace('{z}', z).replace('{x}', x).replace('{y}', y)
  tiles.set(key, img)
  if (tiles.size > TILE_CACHE) tiles.delete(tiles.keys().next().value)
  return null
}

function drawTileMap(ctx, S, v, R) {
  const lat = v.lat
  const lon = v.lon
  const viewKm = Math.min(Math.max(v.alt * 3 + 2, 2), 2500)
  const circ = 2 * Math.PI * R * Math.cos(lat)
  const z = Math.min(17, Math.max(2, Math.floor(Math.log2((circ * S) / (256 * viewKm)))))
  const n = 1 << z
  const fx = ((lon + Math.PI) / (2 * Math.PI)) * n
  const fy = ((1 - Math.log(Math.tan(Math.PI / 4 + lat / 2)) / Math.PI) / 2) * n
  const tilePx = (S * circ) / n / viewKm // css px per tile
  const r = Math.ceil(S / 2 / tilePx) + 1
  for (let dy = -r; dy <= r; dy += 1) {
    for (let dx = -r; dx <= r; dx += 1) {
      const tx = Math.floor(fx) + dx
      const ty = Math.floor(fy) + dy
      if (ty < 0 || ty >= n) continue
      const sx = S / 2 + (tx - fx) * tilePx
      const sy = S / 2 + (ty - fy) * tilePx
      if (sx > S || sy > S || sx + tilePx < 0 || sy + tilePx < 0) continue
      // Fallback: parent tile region while loading.
      const img = tileImage(z, ((tx % n) + n) % n, ty)
      if (img) {
        ctx.drawImage(img, sx, sy, tilePx + 0.5, tilePx + 0.5)
      } else if (z > 2) {
        const parent = tileImage(z - 1, ((((tx % n) + n) % n) >> 1), ty >> 1)
        if (parent) ctx.drawImage(parent, (tx & 1) * 128, (ty & 1) * 128, 128, 128, sx, sy, tilePx + 0.5, tilePx + 0.5)
      }
    }
  }
  return { viewKm, toScreen: (la, lo) => {
    const px = ((lo + Math.PI) / (2 * Math.PI)) * n
    const py = ((1 - Math.log(Math.tan(Math.PI / 4 + la / 2)) / Math.PI) / 2) * n
    return [S / 2 + (px - fx) * tilePx, S / 2 + (py - fy) * tilePx]
  } }
}

// ─── planet map ──────────────────────────────────────────────────────────────

/**
 * body: collision entry (frameQ, mapImage, lonOffset). places: POIs (kind 'place', bodyKey, local).
 * Returns footer text. drawMarker(ctx, x, y, dx, dy, color) from HUD.
 */
export function drawPlanetMap(ctx, w, h, body, forward, places, drawMarker, color, fmtDist) {
  const S = Math.min(w, h)
  const ox = (w - S) / 2
  const oy = (h - S) / 2
  const v = bodyView(body, forward)
  const R = body.radius
  ctx.save()
  ctx.beginPath()
  ctx.rect(ox, oy, S, S)
  ctx.clip()
  ctx.translate(ox, oy)

  let project
  if (body.key === 'earth' && v.alt < EARTH_TILE_ALT_KM) {
    ctx.fillStyle = '#0b1320'
    ctx.fillRect(0, 0, S, S)
    const tm = drawTileMap(ctx, S, v, R)
    project = (p) => {
      const la = Math.asin(p[1])
      const lo = Math.atan2(-p[2], p[0])
      return tm.toScreen(la, lo)
    }
  } else {
    // rho: whole disc high up → close-up near surface.
    const rho = Math.min(1.08, Math.max(0.004, (v.alt / R) * 0.9 + 0.004))
    const sunW = [-body.position.x, -body.position.y, -body.position.z]
    const l = Math.hypot(...sunW) || 1
    const tex = texels(body.mapImage?.())
    if (tex) {
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(renderGlobe(body.key, tex, v, rho, toLocal(body.frameQ, sunW.map((c) => c / l)), performance.now()), 0, 0, S, S)
    }
    if (rho >= 0.9) {
      ctx.strokeStyle = 'rgba(180,190,254,0.25)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(S / 2, S / 2, S / 2 / rho, 0, Math.PI * 2)
      ctx.stroke()
    }
    project = (p) => {
      if (dot3(p, v.up) < 0) return null
      return [S / 2 + (dot3(p, v.east) / rho) * (S / 2), S / 2 - (dot3(p, v.north) / rho) * (S / 2)]
    }
  }

  // Places: dots + a few names (lowest rank first).
  ctx.font = '600 8px ui-sans-serif, system-ui'
  ctx.textBaseline = 'middle'
  let named = 0
  const list = places.filter((pl) => pl.bodyKey === body.key).sort((a, b) => (a.rank ?? 9) - (b.rank ?? 9))
  for (const pl of list) {
    const l = Math.hypot(pl.local.x, pl.local.y, pl.local.z)
    const s = project([pl.local.x / l, pl.local.y / l, pl.local.z / l])
    if (!s || s[0] < 2 || s[1] < 2 || s[0] > S - 2 || s[1] > S - 2) continue
    ctx.fillStyle = 'rgba(249,226,175,0.9)'
    ctx.fillRect(s[0] - 1, s[1] - 1, 2, 2)
    if (named < 5 && pl.placeKind !== 'region' && pl.placeKind !== 'water') {
      ctx.fillStyle = 'rgba(205,214,244,0.8)'
      ctx.shadowColor = 'rgba(0,0,0,0.9)'
      ctx.shadowBlur = 3
      ctx.fillText(pl.name, s[0] + 3, s[1])
      ctx.shadowBlur = 0
      named += 1
    }
  }
  ctx.restore()
  drawMarker(ctx, w / 2, h / 2, v.fwd[0], -v.fwd[1], color)

  const glat = v.lat / DEG
  let glon = v.lon / DEG - (body.lonOffset ?? 0)
  glon = ((glon + 540) % 360) - 180
  const ns = glat >= 0 ? 'N' : 'S'
  const ew = glon >= 0 ? 'Ø' : 'V'
  return `${Math.abs(glat).toFixed(1)}°${ns} ${Math.abs(glon).toFixed(1)}°${ew} · ${fmtDist(v.alt)}`
}

// ─── Local Group ─────────────────────────────────────────────────────────────

const groupMembers = [
  { name: 'Melkeveien', g: [0, 0, 0], kpc: 15, color: '#f9e2af' },
  ...galaxies.map((gal) => {
    const sc = raDecToScene(gal.ra, gal.dec, gal.dist)
    return {
      name: gal.key.toUpperCase(),
      g: sceneToGalaxyKpc(sc[0], sc[1], sc[2]),
      kpc: gal.radius / 1000,
      color: gal.type === 'irregular' || gal.type === 'barred' ? '#94e2d5' : '#b4befe',
    }
  }),
]

/** Top-down (galactic plane, view from NGP): right = +gy, down = +gx. Centered between MW and camera. */
export function drawGroupMap(ctx, w, h, forward, camG, drawMarker, color) {
  const cx = w / 2
  const cy = h / 2
  const R = Math.min(w, h) / 2 - 8
  const dCam = Math.hypot(camG[0], camG[1])
  const range = Math.min(Math.max(dCam * 1.25, 900), 5000) // kpc
  const k = R / range
  const toS = (g) => [cx + g[1] * k, cy + g[0] * k]

  ctx.strokeStyle = 'rgba(180,190,254,0.12)'
  ctx.lineWidth = 1
  for (const f of [0.25, 0.5, 1]) {
    ctx.beginPath()
    ctx.arc(cx, cy, R * f, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.font = '600 8px ui-sans-serif, system-ui'
  ctx.textBaseline = 'middle'
  // MW satellites cluster near center → label only when separable.
  for (const m of groupMembers) {
    const [x, y] = toS(m.g)
    if (Math.hypot(x - cx, y - cy) > R + 2) continue
    ctx.fillStyle = m.color
    ctx.globalAlpha = 0.8
    ctx.beginPath()
    ctx.arc(x, y, Math.max(1.8, m.kpc * k), 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    if (m.name === 'Melkeveien' || Math.hypot(m.g[0], m.g[1]) * k > 14) {
      ctx.fillStyle = 'rgba(205,214,244,0.7)'
      ctx.fillText(m.name === 'Melkeveien' ? 'MV' : m.name, x + 4, y)
    }
  }
  const [x0, y0] = toS(camG)
  const fG = [dot3(forward, GALAXY_AXES.x), dot3(forward, GALAXY_AXES.y)]
  drawMarker(ctx, x0, y0, fG[1], fG[0], color)
  return `Radius ${((range * 1000 * PC_KM) / LY_KM / 1e6).toFixed(2)} Mly`
}
