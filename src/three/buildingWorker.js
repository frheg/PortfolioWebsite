// 3D buildings tile builder (worker). OpenFreeMap vector tile (OpenMapTiles schema, OSM data)
// → building footprints extruded to render_height, seated on Terrarium ground height.
// Frame: Earth-local km (same as terrain), positions relative to tile center.
// Imagery: orthophoto mosaic of this tile (2^(imgZ−z))² tiles → ImageBitmap, uv = tile fraction (v down, flipY off).
// In:  { id, z, x, y, url, terrainUrl, terrainZ, radius, imageryUrl, imgZ }
// Out: { id, center[3], positions, normals, colors, uvs, indices, imagery? } | { id, empty } | { id, error }
import { VectorTile } from '@mapbox/vector-tile'
import { PbfReader } from 'pbf'
import earcut from 'earcut'

const mercatorLat = (yFrac) => Math.atan(Math.sinh(Math.PI * (1 - 2 * yFrac)))
const dirFromLatLon = (lat, lon) => {
  const c = Math.cos(lat)
  return [Math.cos(lon) * c, Math.sin(lat), -Math.sin(lon) * c]
}
const DEFAULT_HEIGHT_M = 7
const SINK_KM = 0.004 // base below ground → no gap on slopes

async function loadHeights(url) {
  const res = await fetch(url)
  if (!res.ok) return null
  const bitmap = await createImageBitmap(await res.blob())
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(bitmap, 0, 0)
  const { data, width, height } = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
  bitmap.close()
  const h = new Float32Array(width * height)
  for (let i = 0; i < h.length; i += 1) h[i] = Math.max(0, data[i * 4] * 256 + data[i * 4 + 1] + data[i * 4 + 2] / 256 - 32768) / 1000
  return { h, width, height }
}

function sampleHeight(src, u, v) {
  if (!src) return 0
  const x = Math.min(Math.max(Math.round(u * (src.width - 1)), 0), src.width - 1)
  const y = Math.min(Math.max(Math.round(v * (src.height - 1)), 0), src.height - 1)
  return src.h[y * src.width + x]
}

// Mosaic of imagery tiles covering z/x/y. Missing tiles → left black (roof falls back to dark, rare).
async function loadImagery(template, z, x, y, imgZ) {
  if (!template) return null
  const k = 1 << Math.max(0, imgZ - z)
  const canvas = new OffscreenCanvas(256 * k, 256 * k)
  const ctx = canvas.getContext('2d')
  let ok = 0
  const jobs = []
  for (let j = 0; j < k; j += 1) {
    for (let i = 0; i < k; i += 1) {
      const u = template.replace('{z}', z + Math.log2(k)).replace('{x}', x * k + i).replace('{y}', y * k + j)
      jobs.push(
        fetch(u)
          .then((r) => (r.ok ? r.blob() : null))
          .then((b) => (b ? createImageBitmap(b) : null))
          .then((bmp) => {
            if (!bmp) return
            ctx.drawImage(bmp, i * 256, j * 256, 256, 256)
            bmp.close()
            ok += 1
          })
          .catch(() => {})
      )
    }
  }
  await Promise.all(jobs)
  return ok === k * k ? canvas.transferToImageBitmap() : null
}

const ringArea = (ring) => {
  let a = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j].x - ring[i].x) * (ring[j].y + ring[i].y)
  return a / 2
}

// MVT: polygons = outer ring + following holes (opposite winding).
function polygonsOf(rings) {
  const out = []
  let current = null
  let outerSign = 0
  for (const ring of rings) {
    const a = ringArea(ring)
    if (a === 0) continue
    if (!current || Math.sign(a) === outerSign) {
      outerSign = Math.sign(a)
      current = [ring]
      out.push(current)
    } else {
      current.push(ring)
    }
  }
  return out
}

const hash = (seed, k) => {
  const h = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453
  return h - Math.floor(h)
}

// Facade: OSM colour if tagged (OpenMapTiles `colour`), else plaster/brick variety.
const FACADES = [[0.78, 0.76, 0.72], [0.72, 0.7, 0.66], [0.82, 0.8, 0.74], [0.66, 0.52, 0.44], [0.74, 0.68, 0.58]]
function facade(seed, colour) {
  const m = /^#([0-9a-f]{6})$/i.exec(colour ?? '')
  if (m) {
    const v = parseInt(m[1], 16)
    // Lifted toward light grey (tagged colours often garish / dark).
    return [v >> 16, (v >> 8) & 255, v & 255].map((c) => 0.3 * 0.72 + 0.7 * (c / 255))
  }
  const c = FACADES[Math.floor(hash(seed, 1) * FACADES.length)]
  const j = 0.92 + hash(seed, 2) * 0.12
  return c.map((x) => x * j)
}

// Roof: small + low → pitched (terracotta, slate, dark tile, brown, rare copper green); big/tall → flat (tar, gravel, concrete).
const PITCHED = [[0.6, 0.27, 0.18], [0.5, 0.24, 0.18], [0.3, 0.3, 0.32], [0.22, 0.22, 0.24], [0.38, 0.31, 0.26], [0.34, 0.5, 0.44]]
const FLAT = [[0.34, 0.34, 0.34], [0.46, 0.45, 0.43], [0.56, 0.55, 0.52], [0.26, 0.26, 0.27], [0.64, 0.64, 0.62]]
function roof(seed, areaM2, heightM) {
  const pitched = areaM2 < 450 && heightM < 16
  const list = pitched ? PITCHED : FLAT
  const i = Math.min(Math.floor(hash(seed, 3) * (pitched ? list.length - 0.75 : list.length)), list.length - 1)
  const j = 0.9 + hash(seed, 4) * 0.15
  return list[i].map((x) => x * j)
}

self.onmessage = async (event) => {
  const { id, z, x, y, url, terrainUrl, terrainZ, radius, imageryUrl, imgZ } = event.data
  try {
    const res = await fetch(url.replace('{z}', z).replace('{x}', x).replace('{y}', y))
    if (!res.ok) throw new Error(`tile ${res.status}`)
    const tile = new VectorTile(new PbfReader(new Uint8Array(await res.arrayBuffer())))
    const layer = tile.layers.building
    if (!layer || layer.length === 0) return self.postMessage({ id, empty: true })

    // Ground: Terrarium tile covering this one.
    const shift = Math.max(0, z - terrainZ)
    const tz = z - shift
    const imageryJob = loadImagery(imageryUrl, z, x, y, imgZ)
    const heights = await loadHeights(terrainUrl.replace('{z}', tz).replace('{x}', x >> shift).replace('{y}', y >> shift))
    const span = 1 / (1 << shift)
    const offU = (x - ((x >> shift) << shift)) * span
    const offV = (y - ((y >> shift) << shift)) * span

    const n = 1 << z
    const center = dirFromLatLon(mercatorLat((y + 0.5) / n), ((x + 0.5) / n) * 2 * Math.PI - Math.PI).map((c) => c * radius)
    const pos = []
    const nor = []
    const col = []
    const uvs = []
    const idx = []
    const extent = layer.extent ?? 4096
    const tileM = ((2 * Math.PI * radius * Math.cos(mercatorLat((y + 0.5) / n))) / n) * 1000

    const vertex = (px, py, hKm) => {
      const lat = mercatorLat((y + py / extent) / n)
      const lon = ((x + px / extent) / n) * 2 * Math.PI - Math.PI
      const d = dirFromLatLon(lat, lon)
      const r = radius + hKm
      return [d[0] * r - center[0], d[1] * r - center[1], d[2] * r - center[2], d]
    }

    for (let f = 0; f < layer.length; f += 1) {
      const feature = layer.feature(f)
      if (feature.type !== 3) continue
      const p = feature.properties
      if (p.hide_3d) continue
      const topM = Number(p.render_height) || DEFAULT_HEIGHT_M
      const minM = Number(p.render_min_height) || 0
      const seed = feature.id ?? f
      const shade = facade(seed, p.colour)

      for (const poly of polygonsOf(feature.loadGeometry())) {
        const outer = poly[0]
        let cx = 0
        let cy = 0
        outer.forEach((pt) => {
          cx += pt.x
          cy += pt.y
        })
        cx /= outer.length
        cy /= outer.length
        const ground = sampleHeight(heights, offU + (cx / extent) * span, offV + (cy / extent) * span)
        const baseKm = ground + minM / 1000 - (minM > 0 ? 0 : SINK_KM)
        const topKm = ground + topM / 1000

        // Roof: earcut on tile coords (rings closed → drop last dup).
        const flat = []
        const holes = []
        poly.forEach((ring, ri) => {
          if (ri > 0) holes.push(flat.length / 2)
          const pts = ring.length > 1 && ring[0].x === ring[ring.length - 1].x && ring[0].y === ring[ring.length - 1].y ? ring.slice(0, -1) : ring
          pts.forEach((pt) => flat.push(pt.x, pt.y))
        })
        const tris = earcut(flat, holes)
        const roofCol = roof(seed, Math.abs(ringArea(outer)) * (tileM / extent) ** 2, topM)
        const roofStart = pos.length / 3
        const up = vertex(cx, cy, topKm)[3]
        for (let k = 0; k < flat.length; k += 2) {
          const v = vertex(flat[k], flat[k + 1], topKm)
          pos.push(v[0], v[1], v[2])
          uvs.push(flat[k] / extent, flat[k + 1] / extent)
          nor.push(up[0], up[1], up[2])
          col.push(roofCol[0], roofCol[1], roofCol[2])
        }
        for (let k = 0; k < tris.length; k += 3) idx.push(roofStart + tris[k], roofStart + tris[k + 2], roofStart + tris[k + 1])

        // Walls: quad per edge, outward normal (away from footprint center).
        const mid = vertex(cx, cy, (baseKm + topKm) / 2)
        for (const ring of poly) {
          for (let k = 0; k < ring.length - 1; k += 1) {
            const a = ring[k]
            const b = ring[k + 1]
            if (a.x === b.x && a.y === b.y) continue
            const a0 = vertex(a.x, a.y, baseKm)
            const a1 = vertex(a.x, a.y, topKm)
            const b0 = vertex(b.x, b.y, baseKm)
            const b1 = vertex(b.x, b.y, topKm)
            const e = [b1[0] - a1[0], b1[1] - a1[1], b1[2] - a1[2]]
            const u = a1[3]
            let nx = e[1] * u[2] - e[2] * u[1]
            let ny = e[2] * u[0] - e[0] * u[2]
            let nz = e[0] * u[1] - e[1] * u[0]
            const mx = (a0[0] + b1[0]) / 2 - mid[0]
            const my = (a0[1] + b1[1]) / 2 - mid[1]
            const mz = (a0[2] + b1[2]) / 2 - mid[2]
            const flip = nx * mx + ny * my + nz * mz < 0 && ring === poly[0] ? -1 : 1
            const l = Math.hypot(nx, ny, nz) * flip || 1
            nx /= l
            ny /= l
            nz /= l
            const s = pos.length / 3
            for (const [v, pt] of [[a0, a], [b0, b], [b1, b], [a1, a]]) {
              pos.push(v[0], v[1], v[2])
              uvs.push(pt.x / extent, pt.y / extent)
              nor.push(nx, ny, nz)
              col.push(shade[0], shade[1], shade[2])
            }
            idx.push(s, s + 1, s + 2, s, s + 2, s + 3)
          }
        }
      }
    }

    if (!idx.length) {
      imageryJob.then((b) => b?.close())
      return self.postMessage({ id, empty: true })
    }
    const positions = new Float32Array(pos)
    const normals = new Float32Array(nor)
    const colors = new Uint8Array(col.map((c) => Math.round(Math.min(c, 1) * 255)))
    const indices = positions.length / 3 > 65535 ? new Uint32Array(idx) : new Uint16Array(idx)
    const uv = new Float32Array(uvs)
    const imagery = await imageryJob
    const transfer = [positions.buffer, normals.buffer, colors.buffer, uv.buffer, indices.buffer]
    if (imagery) transfer.push(imagery)
    self.postMessage({ id, center, positions, normals, colors, uvs: uv, indices, imagery }, transfer)
  } catch (error) {
    self.postMessage({ id, error: String(error) })
  }
}
