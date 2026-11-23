// Dev-time: HYG v4.1 CSV → public/data/stars.bin + star-names.json. Runtime stays client-only (static files).
// Usage: node scripts/build-star-catalog.mjs <hygdata_v41.csv>
// Source: https://github.com/astronexus/HYG-Database (CC BY-SA 4.0).
//
// stars.bin layout (little endian, SoA):
//   u32 magic 'STR1' | u32 count | f32 pos[count*3] (scene pc) | f32 absMag[count]
//   | u16 tempK[count] | u8 rgb[count*3] (linear, max channel 255)
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { equatorialToScene, bvToTemperature, temperatureToRgb } from '../src/three/galaxyFrame.js'

const MAX_DIST_PC = 1000 // beyond: parallax noise, procedural fills in
const DEFAULT_BV = 0.65

const input = process.argv[2]
if (!input) throw new Error('usage: build-star-catalog.mjs <hygdata_v41.csv>')
const outDir = path.resolve('public/data')
fs.mkdirSync(outDir, { recursive: true })

// Minimal CSV split: HYG quotes only simple strings, no embedded commas.
const split = (line) => line.split(',').map((f) => f.replace(/^"|"$/g, ''))

const rl = readline.createInterface({ input: fs.createReadStream(input) })
let header = null
const stars = []
for await (const line of rl) {
  const f = split(line)
  if (!header) {
    header = Object.fromEntries(f.map((name, i) => [name, i]))
    continue
  }
  const id = Number(f[header.id])
  const dist = Number(f[header.dist])
  if (id === 0 || !(dist > 0) || dist >= MAX_DIST_PC) continue // Sol rendered separately
  const absMag = Number(f[header.absmag])
  if (!Number.isFinite(absMag)) continue
  const bvRaw = f[header.ci]
  const bv = bvRaw === '' ? DEFAULT_BV : Number(bvRaw)
  stars.push({
    pos: equatorialToScene(Number(f[header.x]), Number(f[header.y]), Number(f[header.z])),
    absMag,
    temp: Math.round(Math.min(Math.max(bvToTemperature(Number.isFinite(bv) ? bv : DEFAULT_BV), 1500), 50000)),
    proper: f[header.proper],
    hip: f[header.hip],
  })
}

// Brightest first → names index stable-ish, nearest-query friendly.
stars.sort((a, b) => a.absMag - b.absMag)

const n = stars.length
const posBytes = n * 12
const magBytes = n * 4
const tempBytes = n * 2
const rgbBytes = n * 3
const buf = Buffer.alloc(8 + posBytes + magBytes + tempBytes + rgbBytes)
buf.write('STR1', 0, 'ascii')
buf.writeUInt32LE(n, 4)
let o = 8
for (const s of stars) for (const c of s.pos) o = buf.writeFloatLE(c, o)
for (const s of stars) o = buf.writeFloatLE(s.absMag, o)
for (const s of stars) o = buf.writeUInt16LE(s.temp, o)
for (const s of stars) for (const c of temperatureToRgb(s.temp)) o = buf.writeUInt8(Math.round(c * 255), o)
fs.writeFileSync(path.join(outDir, 'stars.bin'), buf)

const names = stars.flatMap((s, i) => (s.proper ? [{ i, n: s.proper }] : []))
fs.writeFileSync(path.join(outDir, 'star-names.json'), JSON.stringify(names))

console.log(`stars: ${n}, named: ${names.length}, bin: ${(buf.length / 1e6).toFixed(2)} MB`)
