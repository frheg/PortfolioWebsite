// Persistent tile store (Cache Storage, survives reloads/visits). Main thread + workers.
// Kept: tiles touching the home region (Bergen) + coarse world tiles (z ≤ 5). Rest → plain fetch (HTTP cache).
// Second visit → home stop renders from disk, no network.
const CACHE_NAME = 'space-tiles-v1'
const HOME = { lat: [60.2, 60.56], lon: [4.9, 5.75] } // Bergen + fjords/mountains in view
const COARSE_Z = 5

const mercLat = (yFrac) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * yFrac))) * 180) / Math.PI

/** Web Mercator tile z/x/y touches the home region (or is coarse) → keep. */
export function isKeptTile(z, x, y) {
  if (z <= COARSE_Z) return true
  const n = 2 ** z
  const lon0 = (x / n) * 360 - 180
  const lon1 = ((x + 1) / n) * 360 - 180
  const lat1 = mercLat(y / n)
  const lat0 = mercLat((y + 1) / n)
  return lon1 >= HOME.lon[0] && lon0 <= HOME.lon[1] && lat1 >= HOME.lat[0] && lat0 <= HOME.lat[1]
}

let cachePromise = null
const openCache = () => {
  if (typeof caches === 'undefined') return null
  cachePromise ??= caches.open(CACHE_NAME).catch(() => null)
  return cachePromise
}

/** fetch() with cache-first for kept tiles. tile = { z, x, y } (Web Mercator coords of this request). */
export async function tileFetch(url, tile, init) {
  if (!tile || !isKeptTile(tile.z, tile.x, tile.y)) return fetch(url, init)
  const cache = await openCache()
  if (!cache) return fetch(url, init)
  const hit = await cache.match(url).catch(() => null)
  if (hit) return hit
  const res = await fetch(url, init)
  if (res.ok) cache.put(url, res.clone()).catch(() => {}) // quota → just not kept
  return res
}
