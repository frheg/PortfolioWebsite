// Dev-time: GeoNames cities15000 + Natural Earth geography → public/data/places-earth.json.
// Runtime stays client-only (static file, lazy-loaded near Earth).
// Usage: node scripts/build-earth-places.mjs <cities15000.txt> <regions.geojson> <elev.geojson> <marine.geojson>
// Sources: GeoNames (CC BY 4.0, geonames.org), Natural Earth (public domain, naturalearthdata.com).
//
// Out: { cities: [[name, lat, lon, pop]], features: [[name, lat, lon, kind, scalerank, elevKm]] }
import fs from 'node:fs'
import path from 'node:path'

const [citiesPath, regionsPath, elevPath, marinePath] = process.argv.slice(2)
if (!marinePath) throw new Error('usage: build-earth-places.mjs <cities15000.txt> <regions> <elev> <marine>')

const r3 = (v) => Math.round(v * 1000) / 1000

// GeoNames columns: 1 name, 4 lat, 5 lon, 6 feature class, 14 population.
const cities = fs
  .readFileSync(citiesPath, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => line.split('\t'))
  .filter((f) => f[6] === 'P' && Number(f[14]) >= 15000)
  .map((f) => [f[1], r3(Number(f[4])), r3(Number(f[5])), Number(f[14])])
  .sort((a, b) => b[3] - a[3])

const features = []
const pointFeatures = (file, kindOf) => {
  for (const { properties: p } of JSON.parse(fs.readFileSync(file, 'utf8')).features) {
    if (!p.name) continue
    features.push([p.name, r3(p.lat_y), r3(p.long_x), kindOf(p), p.scalerank ?? 9, r3((p.elevation ?? 0) / 1000)])
  }
}
pointFeatures(regionsPath, (p) => (p.featurecla === 'waterfall' ? 'landmark' : 'region'))
pointFeatures(elevPath, (p) => (p.featurecla === 'mountain' || p.featurecla === 'spot elevation' ? 'mountain' : 'region'))

// Marine polygons: label at area-weighted centroid of largest ring.
const ringArea = (ring) => ring.reduce((s, [x1, y1], i) => s + x1 * ring[(i + 1) % ring.length][1] - ring[(i + 1) % ring.length][0] * y1, 0) / 2
const centroid = (ring) => {
  let cx = 0
  let cy = 0
  let a = 0
  ring.forEach(([x1, y1], i) => {
    const [x2, y2] = ring[(i + 1) % ring.length]
    const k = x1 * y2 - x2 * y1
    a += k
    cx += (x1 + x2) * k
    cy += (y1 + y2) * k
  })
  return a === 0 ? ring[0] : [cx / (3 * a), cy / (3 * a)]
}
for (const { properties: p, geometry: g } of JSON.parse(fs.readFileSync(marinePath, 'utf8')).features) {
  if (!p.name || !g) continue
  const rings = g.type === 'Polygon' ? [g.coordinates[0]] : g.coordinates.map((poly) => poly[0])
  const largest = rings.reduce((best, r) => (Math.abs(ringArea(r)) > Math.abs(ringArea(best)) ? r : best))
  const [lon, lat] = centroid(largest)
  features.push([p.name, r3(lat), r3(lon), 'water', p.scalerank ?? 9, 0, p.featurecla])
}

const out = path.resolve('public/data/places-earth.json')
fs.writeFileSync(out, JSON.stringify({ cities, features }))
console.log(`cities: ${cities.length}, features: ${features.length}, ${(fs.statSync(out).size / 1e6).toFixed(2)} MB`)
