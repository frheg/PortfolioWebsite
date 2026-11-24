// Simulated air traffic (fallback when no live snapshot): real hubs, deterministic schedules.
// Same clock → every visitor sees the same planes. Great-circle legs, climb / cruise / descent profile.
// Output = readsb-shaped rows (same as the relay) → flights.js treats them like live data.
const D2R = Math.PI / 180
const R_KM = 6371
const KN_KMS = 0.000514444

// [IATA, lat, lon] — big hubs + Nordic coverage.
const AIRPORTS = [
  ['OSL', 60.194, 11.1], ['BGO', 60.293, 5.218], ['TRD', 63.458, 10.924], ['SVG', 58.877, 5.638], ['TOS', 69.683, 18.919], ['BOO', 67.269, 14.365],
  ['ARN', 59.652, 17.919], ['GOT', 57.668, 12.292], ['CPH', 55.618, 12.656], ['HEL', 60.317, 24.963], ['KEF', 63.985, -22.605], ['RIX', 56.924, 23.971],
  ['LHR', 51.47, -0.454], ['AMS', 52.31, 4.768], ['FRA', 50.033, 8.571], ['CDG', 49.01, 2.548], ['MUC', 48.354, 11.786], ['ZRH', 47.465, 8.549],
  ['MAD', 40.472, -3.561], ['BCN', 41.297, 2.078], ['FCO', 41.8, 12.239], ['VIE', 48.11, 16.57], ['WAW', 52.166, 20.967], ['IST', 41.262, 28.742],
  ['DUB', 53.421, -6.27], ['LIS', 38.774, -9.134], ['ATH', 37.936, 23.947], ['DXB', 25.253, 55.364], ['DOH', 25.273, 51.608], ['JFK', 40.641, -73.778],
  ['ORD', 41.974, -87.907], ['ATL', 33.637, -84.428], ['LAX', 33.942, -118.408], ['SFO', 37.621, -122.379], ['YYZ', 43.677, -79.624], ['MEX', 19.436, -99.072],
  ['GRU', -23.435, -46.473], ['JNB', -26.139, 28.246], ['CAI', 30.112, 31.4], ['DEL', 28.556, 77.1], ['BOM', 19.09, 72.866], ['SIN', 1.364, 103.991],
  ['HKG', 22.308, 113.918], ['PEK', 40.08, 116.584], ['NRT', 35.772, 140.393], ['ICN', 37.46, 126.441], ['SYD', -33.94, 151.175], ['BKK', 13.69, 100.75],
]
const AIRLINES = ['SAS', 'NOZ', 'FIN', 'DLH', 'KLM', 'BAW', 'AFR', 'RYR', 'EZY', 'UAE', 'QTR', 'THY', 'WIF', 'IBE']
const TYPES_SHORT = ['A320', 'B738', 'A321', 'E190', 'A20N', 'B38M']
const TYPES_LONG = ['A359', 'B789', 'B77W', 'A333']

const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}
const unit = (lat, lon) => [Math.cos(lat * D2R) * Math.cos(lon * D2R), Math.cos(lat * D2R) * Math.sin(lon * D2R), Math.sin(lat * D2R)]
const angle = (a, b) => Math.acos(Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])))

// Routes: each hub → up to 5 others, 250–9500 km. Built once.
let routes = null
function getRoutes() {
  if (routes) return routes
  routes = []
  AIRPORTS.forEach(([, la, lo], i) => {
    const a = unit(la, lo)
    let picked = 0
    for (let k = 0; k < AIRPORTS.length * 2 && picked < 5; k += 1) {
      const j = Math.floor(hash(i * 97 + k * 13) * AIRPORTS.length)
      if (j === i) continue
      const b = unit(AIRPORTS[j][1], AIRPORTS[j][2])
      const dist = angle(a, b) * R_KM
      if (dist < 250 || dist > 9500) continue
      const id = i * 100 + j
      const long = dist > 3500
      routes.push({
        id,
        a,
        b,
        dist,
        gsKn: long ? 480 : 430,
        headwayS: (long ? 3 : 1.2) * 3600 * (0.7 + hash(id) * 0.6),
        offsetS: hash(id + 7) * 86400,
        type: long ? TYPES_LONG[id % TYPES_LONG.length] : TYPES_SHORT[id % TYPES_SHORT.length],
      })
      picked += 1
    }
  })
  return routes
}

function slerp(a, b, f, ang) {
  const s = Math.sin(ang)
  const wa = Math.sin((1 - f) * ang) / s
  const wb = Math.sin(f * ang) / s
  return [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb]
}

/** Simulated aircraft within radiusKm of (lat, lon) at nowMs → readsb-like rows. */
export function simulateFlights(lat, lon, nowMs, radiusKm = 600) {
  const c = unit(lat, lon)
  const maxAng = radiusKm / R_KM
  const nowS = nowMs / 1000
  const out = []
  for (const r of getRoutes()) {
    const ang = r.dist / R_KM
    // Route far from camera (both ends + midpoint beyond range + leg) → skip.
    if (angle(c, slerp(r.a, r.b, 0.5, ang)) > maxAng + ang / 2) continue
    const durS = r.dist / (r.gsKn * KN_KMS) + 1200 // + climb/descent slowness
    const kNow = Math.floor((nowS - r.offsetS) / r.headwayS)
    for (let k = kNow - Math.ceil(durS / r.headwayS); k <= kNow; k += 1) {
      const dep = r.offsetS + k * r.headwayS
      const f = (nowS - dep) / durS
      if (f <= 0 || f >= 1) continue
      const p = slerp(r.a, r.b, f, ang)
      if (angle(c, p) > maxAng) continue
      const p2 = slerp(r.a, r.b, Math.min(f + 0.001, 1), ang)
      const la = Math.asin(p[2]) / D2R
      const lo = Math.atan2(p[1], p[0]) / D2R
      // Track: bearing p → p2.
      const la2 = Math.asin(p2[2])
      const dLon = Math.atan2(p2[1], p2[0]) - lo * D2R
      const trk = (Math.atan2(Math.sin(dLon) * Math.cos(la2), Math.cos(la * D2R) * Math.sin(la2) - Math.sin(la * D2R) * Math.cos(la2) * Math.cos(dLon)) / D2R + 360) % 360
      // Altitude: climb first 12 %, descend last 15 %, cruise FL350–390.
      const cruiseFt = 35000 + (r.id % 3) * 2000
      const climb = Math.min(1, f / 0.12)
      const desc = Math.min(1, (1 - f) / 0.15)
      const prof = Math.min(climb, desc)
      const alt = cruiseFt * Math.sin((prof * Math.PI) / 2)
      const vr = climb < 1 ? 2200 * (1 - climb) + 600 : desc < 1 ? -(1800 * (1 - desc) + 400) : 0
      const n = Math.abs(k) % 1000
      out.push({
        hex: `sim${r.id}_${n}`,
        flight: `${AIRLINES[(r.id + n) % AIRLINES.length]}${100 + ((r.id * 7 + n * 13) % 900)}`,
        t: r.type,
        lat: la,
        lon: lo,
        alt_geom: Math.round(alt),
        gs: Math.round(r.gsKn * (0.55 + 0.45 * prof)),
        track: trk,
        geom_rate: Math.round(vr),
        seen_pos: 0,
      })
    }
  }
  return out
}
