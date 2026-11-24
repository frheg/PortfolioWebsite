// Earth terrain tile builder (worker). Fetch Terrarium PNG → heights → sphere-mapped grid mesh.
// Frame: Earth-local km (matches SphereGeometry/equirect texture: lon 0 → +x, north → +y).
// Positions relative to tile center (float32 precise near surface). Skirts hide LOD cracks.
// In:  { id, z, x, y, grid, radius, terrainUrl, terrainMaxZ, skirtKm }
// Out: { id, center[3], positions, normals, uvs, indices, heights, normalMap (128² RG8 slopes) } | { id, error }
// In { cancel: id } → drop result if still pending (mesh build skipped).
import { tileFetch } from './tileStore'

const mercatorLat = (yFrac) => Math.atan(Math.sinh(Math.PI * (1 - 2 * yFrac)))

function dirFromLatLon(lat, lon) {
  const c = Math.cos(lat)
  return [Math.cos(lon) * c, Math.sin(lat), -Math.sin(lon) * c]
}

// Decoded source tiles, LRU. z > terrainMaxZ tiles share their ancestor's decode.
const heightCache = new Map()
const HEIGHT_CACHE_MAX = 48

async function loadHeightsCached(url, tile) {
  const hit = heightCache.get(url)
  if (hit) {
    heightCache.delete(url)
    heightCache.set(url, hit)
    return hit
  }
  const promise = loadHeights(url, tile)
  heightCache.set(url, promise)
  if (heightCache.size > HEIGHT_CACHE_MAX) heightCache.delete(heightCache.keys().next().value)
  promise.catch(() => heightCache.delete(url))
  return promise
}

async function loadHeights(url, tile) {
  const res = await tileFetch(url, tile) // shared by many tiles → not aborted per tile
  if (!res.ok) throw new Error(`terrain ${res.status}`)
  const bitmap = await createImageBitmap(await res.blob())
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(bitmap, 0, 0)
  const { data, width, height } = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
  bitmap.close()
  const h = new Float32Array(width * height)
  for (let i = 0; i < h.length; i += 1) {
    // Terrarium: (R·256 + G + B/256) − 32768 m. Ocean floor → clamp to sea level (flat water).
    h[i] = Math.max(0, data[i * 4] * 256 + data[i * 4 + 1] + data[i * 4 + 2] / 256 - 32768) / 1000
  }
  return { h, width, height }
}

function sample({ h, width, height }, u, v) {
  const x = Math.min(Math.max(u * (width - 1), 0), width - 1)
  const y = Math.min(Math.max(v * (height - 1), 0), height - 1)
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(x0 + 1, width - 1)
  const y1 = Math.min(y0 + 1, height - 1)
  const fx = x - x0
  const fy = y - y0
  const a = h[y0 * width + x0] * (1 - fx) + h[y0 * width + x1] * fx
  const b = h[y1 * width + x0] * (1 - fx) + h[y1 * width + x1] * fx
  return a * (1 - fy) + b * fy
}

const cancelled = new Set()

self.onmessage = async (event) => {
  if (event.data.cancel !== undefined) {
    cancelled.add(event.data.cancel)
    return
  }
  const { id, z, x, y, grid, radius, terrainUrl, terrainMaxZ, skirtKm } = event.data
  try {
    // Beyond terrain max zoom: sample the covering ancestor's sub-rect.
    const tz = Math.min(z, terrainMaxZ)
    const shift = z - tz
    const tx = x >> shift
    const ty = y >> shift
    const span = 1 / (1 << shift)
    const offU = (x - (tx << shift)) * span
    const offV = (y - (ty << shift)) * span
    const src = await loadHeightsCached(terrainUrl.replace('{z}', tz).replace('{x}', tx).replace('{y}', ty), { z: tz, x: tx, y: ty })
    if (cancelled.delete(id)) return

    const n = grid
    const side = n + 1
    const tiles = 1 << z
    const centerDir = dirFromLatLon(mercatorLat((y + 0.5) / tiles), ((x + 0.5) / tiles) * 2 * Math.PI - Math.PI)
    const center = centerDir.map((c) => c * radius)

    const vertCount = side * side + 4 * side
    const positions = new Float32Array(vertCount * 3)
    const normals = new Float32Array(vertCount * 3)
    const uvs = new Float32Array(vertCount * 2)
    const heights = new Float32Array(side * side)
    const dirs = new Float64Array(side * side * 3)

    for (let j = 0; j < side; j += 1) {
      for (let i = 0; i < side; i += 1) {
        const u = i / n
        const v = j / n
        const lat = mercatorLat((y + v) / tiles)
        const lon = ((x + u) / tiles) * 2 * Math.PI - Math.PI
        const d = dirFromLatLon(lat, lon)
        const hKm = sample(src, offU + u * span, offV + v * span)
        const k = j * side + i
        heights[k] = hKm
        dirs.set(d, k * 3)
        const r = radius + hKm
        positions[k * 3] = d[0] * r - center[0]
        positions[k * 3 + 1] = d[1] * r - center[1]
        positions[k * 3 + 2] = d[2] * r - center[2]
        uvs[k * 2] = u
        uvs[k * 2 + 1] = v // flipY false: row 0 = north
      }
    }

    // Normals: central differences on the grid (one-sided at edges).
    const p = (i, j) => {
      const k = (Math.min(Math.max(j, 0), n) * side + Math.min(Math.max(i, 0), n)) * 3
      return [positions[k], positions[k + 1], positions[k + 2]]
    }
    for (let j = 0; j < side; j += 1) {
      for (let i = 0; i < side; i += 1) {
        const a = p(i + 1, j)
        const b = p(i - 1, j)
        const c = p(i, j + 1)
        const e = p(i, j - 1)
        const du = [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
        const dv = [c[0] - e[0], c[1] - e[1], c[2] - e[2]]
        // v grows southward → dv × du points outward.
        let nx = dv[1] * du[2] - dv[2] * du[1]
        let ny = dv[2] * du[0] - dv[0] * du[2]
        let nz = dv[0] * du[1] - dv[1] * du[0]
        const k = j * side + i
        if (nx * dirs[k * 3] + ny * dirs[k * 3 + 1] + nz * dirs[k * 3 + 2] < 0) {
          nx = -nx
          ny = -ny
          nz = -nz
        }
        const l = Math.hypot(nx, ny, nz) || 1
        normals.set([nx / l, ny / l, nz / l], k * 3)
      }
    }

    // Skirt verts: edge loop pushed down by skirtKm.
    const edges = [
      Array.from({ length: side }, (_, i) => i), // north row
      Array.from({ length: side }, (_, i) => n * side + i), // south row
      Array.from({ length: side }, (_, j) => j * side), // west col
      Array.from({ length: side }, (_, j) => j * side + n), // east col
    ]
    let sv = side * side
    const skirtStart = []
    for (const edge of edges) {
      skirtStart.push(sv)
      for (const k of edge) {
        const d = [dirs[k * 3], dirs[k * 3 + 1], dirs[k * 3 + 2]]
        positions.set([positions[k * 3] - d[0] * skirtKm, positions[k * 3 + 1] - d[1] * skirtKm, positions[k * 3 + 2] - d[2] * skirtKm], sv * 3)
        normals.set(normals.subarray(k * 3, k * 3 + 3), sv * 3)
        uvs.set(uvs.subarray(k * 2, k * 2 + 2), sv * 2)
        sv += 1
      }
    }

    const idx = []
    for (let j = 0; j < n; j += 1) {
      for (let i = 0; i < n; i += 1) {
        const a = j * side + i
        const b = a + 1
        const c = a + side
        const d = c + 1
        idx.push(a, c, b, b, c, d)
      }
    }
    edges.forEach((edge, e) => {
      for (let i = 0; i < n; i += 1) {
        const top0 = edge[i]
        const top1 = edge[i + 1]
        const bot0 = skirtStart[e] + i
        const bot1 = bot0 + 1
        idx.push(top0, bot0, top1, top1, bot0, bot1) // double-sided material covers winding
      }
    })
    const indices = new Uint16Array(idx)

    // Per-pixel slope map (NM×NM, RG8 = east/north slope) from source heights → relief shading
    // way past mesh grid; shader rebuilds the normal. Mercator conformal → equal E/N texel spacing.
    const NM = 128
    const SLOPE_RANGE = 4 // ±, ~76°
    const normalMap = new Uint8Array(NM * NM * 2)
    const texelKm = (2 * Math.PI * radius * Math.cos(mercatorLat((y + 0.5) / tiles))) / tiles / NM
    const hAt = (i, j) => sample(src, offU + (Math.min(Math.max(i, 0), NM - 1) / (NM - 1)) * span, offV + (Math.min(Math.max(j, 0), NM - 1) / (NM - 1)) * span)
    for (let j = 0; j < NM; j += 1) {
      for (let i = 0; i < NM; i += 1) {
        const dhE = (hAt(i + 1, j) - hAt(i - 1, j)) / (2 * texelKm)
        const dhN = (hAt(i, j - 1) - hAt(i, j + 1)) / (2 * texelKm) // row 0 = north
        const enc = (s) => Math.round(Math.min(Math.max(s / (2 * SLOPE_RANGE) + 0.5, 0), 1) * 255)
        const k = (j * NM + i) * 2
        normalMap[k] = enc(dhE)
        normalMap[k + 1] = enc(dhN)
      }
    }

    self.postMessage({ id, center, positions, normals, uvs, indices, heights, normalMap }, [
      normalMap.buffer,
      positions.buffer,
      normals.buffer,
      uvs.buffer,
      indices.buffer,
      heights.buffer,
    ])
  } catch (error) {
    self.postMessage({ id, error: String(error) })
  }
}
