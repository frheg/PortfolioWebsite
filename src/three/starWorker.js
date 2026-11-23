// Procedural star cell generator (worker). Deterministic per (level, cell) → same sky every visit.
// In:  { id, level, ix, iy, iz, size, mag: [bright, faint], density, exclusionPc, cap, seed }
// Out: { id, count, positions (pc, local to cell corner), absMag, temp, color } (transferred)
import { stellarDensity } from './galaxyModel'
import { sceneToGalaxyKpc, temperatureToRgb } from './galaxyFrame'

const SUB_CELL_PC = 400

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashCell(level, ix, iy, iz, seed) {
  let h = seed ^ 0x9e3779b9
  for (const v of [level, ix, iy, iz]) {
    h = Math.imul(h ^ (v | 0), 0x85ebca6b)
    h ^= h >>> 13
  }
  return h >>> 0
}

function poisson(mean, rand) {
  if (mean <= 0) return 0
  if (mean < 30) {
    const L = Math.exp(-mean)
    let k = 0
    let p = 1
    do {
      k += 1
      p *= rand()
    } while (p > L)
    return k - 1
  }
  const g = Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand())
  return Math.max(0, Math.round(mean + Math.sqrt(mean) * g))
}

function densityAt(x, y, z) {
  const g = sceneToGalaxyKpc(x, y, z)
  return stellarDensity(g[0], g[1], g[2])
}

// Main sequence M → T (K). Piecewise linear.
const MS_M = [-8, -5, -3, -1, 0.5, 2, 3, 4.8, 6, 8, 10, 12, 15]
const MS_T = [40000, 28000, 18000, 11500, 9500, 7800, 6700, 5800, 5200, 4300, 3700, 3300, 3000]
function mainSequenceTemp(M) {
  if (M <= MS_M[0]) return MS_T[0]
  for (let i = 1; i < MS_M.length; i += 1) {
    if (M <= MS_M[i]) {
      const t = (M - MS_M[i - 1]) / (MS_M[i] - MS_M[i - 1])
      return MS_T[i - 1] + (MS_T[i] - MS_T[i - 1]) * t
    }
  }
  return MS_T[MS_T.length - 1]
}

// Evolved-star share by M: supergiants/giants are red, not hot MS.
function giantChance(M) {
  if (M < -5) return 0.35
  if (M < -2.5) return 0.25
  if (M < 0) return 0.55
  if (M < 2.5) return 0.3
  return 0
}

function starTemp(M, rand) {
  if (rand() < giantChance(M)) return M < -2.5 ? 3400 + rand() * 1200 : 4200 + rand() * 900
  return mainSequenceTemp(M) * (0.92 + rand() * 0.16)
}

self.onmessage = (event) => {
  const { id, level, ix, iy, iz, size, mag, density, exclusionPc, cap, seed } = event.data
  const rand = mulberry32(hashCell(level, ix, iy, iz, seed))
  const cx = ix * size
  const cy = iy * size
  const cz = iz * size

  // Subdivide → arms/bulge resolved in acceptance bound.
  const k = Math.min(8, Math.max(1, Math.ceil(size / SUB_CELL_PC)))
  const sub = size / k
  const subs = []
  let expected = 0
  for (let a = 0; a < k; a += 1) {
    for (let b = 0; b < k; b += 1) {
      for (let c = 0; c < k; c += 1) {
        const x0 = cx + a * sub
        const y0 = cy + b * sub
        const z0 = cz + c * sub
        let rhoMax = densityAt(x0 + sub / 2, y0 + sub / 2, z0 + sub / 2)
        for (let n = 0; n < 8; n += 1) {
          rhoMax = Math.max(rhoMax, densityAt(x0 + (n & 1) * sub, y0 + ((n >> 1) & 1) * sub, z0 + ((n >> 2) & 1) * sub))
        }
        rhoMax *= 1.4
        const mean = density * sub * sub * sub * rhoMax
        expected += mean
        subs.push({ x0, y0, z0, rhoMax, mean })
      }
    }
  }
  const thin = Math.min(1, cap / Math.max(expected * 0.5, 1)) // uniform thinning if dense

  const pos = []
  const mags = []
  const temps = []
  for (const s of subs) {
    const n = poisson(s.mean * thin, rand)
    for (let j = 0; j < n; j += 1) {
      const x = s.x0 + rand() * sub
      const y = s.y0 + rand() * sub
      const z = s.z0 + rand() * sub
      if (rand() * s.rhoMax > densityAt(x, y, z)) continue
      if (x * x + y * y + z * z < exclusionPc * exclusionPc) continue // catalog covers this
      const M = mag[0] + rand() * (mag[1] - mag[0])
      pos.push(x - cx, y - cy, z - cz)
      mags.push(M)
      temps.push(Math.round(starTemp(M, rand)))
    }
  }

  const count = mags.length
  const positions = new Float32Array(pos)
  const absMag = new Float32Array(mags)
  const temp = new Uint16Array(temps)
  const color = new Uint8Array(count * 3)
  for (let i = 0; i < count; i += 1) {
    const rgb = temperatureToRgb(temps[i])
    color[i * 3] = Math.round(rgb[0] * 255)
    color[i * 3 + 1] = Math.round(rgb[1] * 255)
    color[i * 3 + 2] = Math.round(rgb[2] * 255)
  }
  self.postMessage({ id, count, positions, absMag, temp, color }, [positions.buffer, absMag.buffer, temp.buffer, color.buffer])
}
