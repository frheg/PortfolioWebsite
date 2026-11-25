// Bake planet textures → KTX2 (Basis ETC1S, mips, sRGB):
//   <key>.ktx2     ≤ 2048 wide, loaded up front
//   <key>@4k.ktx2  4096 wide (if the source has it), loaded when the camera gets close
//   <key>.map.webp ≤ 1024 wide, HUD minimap
// + 2k webp fallbacks (no KTX2 support) written over the old source paths (imports unchanged).
// Sources: Solar System Scope (CC BY 4.0, NASA-based), Pluto: NASA New Horizons (public domain). Real colours, no tint.
// Downloads cached in .texture-cache/ (gitignored). Run after changing a source:  npm run build:ktx2 [-- key …]
import { mkdir, writeFile, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'
import { encodeToKTX2 } from 'ktx2-encoder'
import { ringAlphaFromLuminance } from '../src/three/textureTints.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'src/assets/ktx2')
const cacheDir = path.join(root, '.texture-cache')
const models = (p) => path.join(root, 'src/assets/Models', p)
const SSS = (name) => `https://www.solarsystemscope.com/textures/download/${name}`

// key → source (url or local file), fallback webp path, flags. map: minimap webp. ring/strip: keep own height.
// ring: alpha from luminance (photo paints gaps dark).
const SOURCES = {
  sun: { url: SSS('8k_sun.jpg'), fallback: 'solar/sun/sol/sun.webp', map: true },
  mercury: { url: SSS('8k_mercury.jpg'), fallback: 'solar/mercury/mercury.webp', map: true },
  venus: { url: SSS('4k_venus_atmosphere.jpg'), fallback: 'solar/venus/venus.webp', map: true }, // cloud tops = what you see
  earth: { file: models('Earth 3D Model/textures/earth.webp'), map: true },
  earthLights: { file: models('Earth 3D Model/textures/earth_lights_2048.png') },
  moon: { url: SSS('8k_moon.jpg'), fallback: 'solar/moon/moon.webp', map: true },
  mars: { url: SSS('8k_mars.jpg'), fallback: 'solar/mars/mars.webp', map: true },
  jupiter: { url: SSS('8k_jupiter.jpg'), fallback: 'solar/jupiter/jupiter.webp', map: true },
  saturn: { url: SSS('8k_saturn.jpg'), fallback: 'solar/saturn/saturno/saturn.webp', map: true },
  saturnRing: { url: SSS('8k_saturn_ring_alpha.png'), fallback: 'solar/saturn/saturno/ring.webp', strip: true },
  uranus: { url: SSS('2k_uranus.jpg'), fallback: 'solar/uranus/uranus.webp', map: true },
  uranusRing: { file: models('solar/uranus/uranus_rings.webp'), ring: true },
  neptune: { url: SSS('2k_neptune.jpg'), fallback: 'solar/neptune/neptune.webp', map: true },
  pluto: { url: 'https://upload.wikimedia.org/wikipedia/commons/a/ad/Pluto_color_mapmosaic.jpg', fallback: 'solar/pluto/pluto.webp', map: true, fillDark: true },
}

const BASE_W = 2048
const HI_W = 4096
const MAP_W = 1024 // = hudMaps texels size

const exists = (p) => access(p).then(() => true, () => false)

async function source(key, { url, file }) {
  if (file) return file
  const ext = path.extname(new URL(url).pathname)
  const cached = path.join(cacheDir, `${key}${ext}`)
  if (await exists(cached)) return cached
  const res = await fetch(url, { headers: { 'User-Agent': 'fredrichegland.no texture bake' } })
  if (!res.ok) throw new Error(`${key}: ${res.status} ${url}`)
  await writeFile(cached, Buffer.from(await res.arrayBuffer()))
  return cached
}

// RGBA raw at width ≤ w. Planets 2:1; rings/strips keep their aspect. Block formats need ×4 sizes.
async function rgbaAt(file, w, spec) {
  const meta = await sharp(file).metadata()
  const width = Math.min(w, meta.width)
  const ceil4 = (v) => Math.max(4, Math.ceil(v / 4) * 4)
  const W = ceil4(width)
  const H = ceil4(spec.strip || spec.ring ? meta.height * (width / meta.width) : W / 2)
  const { data, info } = await sharp(file).resize(W, H, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  if (spec.ring) ringAlphaFromLuminance(data)
  if (spec.fillDark) fillUnimaged(data, info.width, info.height)
  return { data, width: info.width, height: info.height, full: meta.width >= w }
}

// New Horizons never saw Pluto's far south (black). Fill: mean surface colour × detail mirrored from the north.
function fillUnimaged(data, w, h) {
  const lum = (i) => (data[i] + data[i + 1] + data[i + 2]) / 765
  const mean = [0, 0, 0]
  let n = 0
  for (let i = 0; i < data.length; i += 4) {
    if (lum(i) < 0.04) continue
    mean[0] += data[i]
    mean[1] += data[i + 1]
    mean[2] += data[i + 2]
    n += 1
  }
  mean.forEach((v, c) => (mean[c] = v / n))
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4
      if (lum(i) >= 0.04) continue
      const m = ((h - 1 - y) * w + x) * 4 // mirrored across the equator
      const k = 0.75 + 0.5 * lum(m)
      for (let c = 0; c < 3; c += 1) data[i + c] = Math.min(255, Math.round(mean[c] * k))
    }
  }
}

const encode = (raw) =>
  encodeToKTX2(Buffer.alloc(0), {
    imageDecoder: async () => ({ data: new Uint8Array(raw.data.buffer, raw.data.byteOffset, raw.data.length), width: raw.width, height: raw.height }),
    enableDebug: false,
    isUASTC: false,
    qualityLevel: 230,
    compressionLevel: 3,
    generateMipmap: true,
    isPerceptual: true,
    isSetKTX2SRGBTransferFunc: true,
    isYFlip: true, // TextureLoader flipY=true look; KTX2 textures upload unflipped
  })

const webp = (raw, w) =>
  sharp(Buffer.from(raw.data), { raw: { width: raw.width, height: raw.height, channels: 4 } })
    .resize(Math.min(w, raw.width), null)
    .webp({ quality: 82 })
    .toBuffer()

await mkdir(outDir, { recursive: true })
await mkdir(cacheDir, { recursive: true })
const kb = (b) => `${(b.length / 1024).toFixed(0)} KB`
const only = process.argv.slice(2) // keys to rebuild; none = all
for (const [key, spec] of Object.entries(SOURCES)) {
  if (only.length && !only.includes(key)) continue
  const file = await source(key, spec)
  const base = await rgbaAt(file, BASE_W, spec)
  const ktx = await encode(base)
  await writeFile(path.join(outDir, `${key}.ktx2`), ktx)
  const notes = [`${base.width}×${base.height} ${kb(ktx)}`]
  if (!spec.strip && !spec.ring) {
    const hi = await rgbaAt(file, HI_W, spec)
    if (hi.full) {
      const hiKtx = await encode(hi)
      await writeFile(path.join(outDir, `${key}@4k.ktx2`), hiKtx)
      notes.push(`4k ${kb(hiKtx)}`)
    }
  }
  if (spec.map) {
    const m = await webp(base, MAP_W)
    await writeFile(path.join(outDir, `${key}.map.webp`), m)
    notes.push(`map ${kb(m)}`)
  }
  if (spec.fallback) {
    const fb = await webp(base, BASE_W)
    await writeFile(models(spec.fallback), fb)
    notes.push(`fallback ${kb(fb)}`)
  }
  console.log(`${key}: ${notes.join(', ')}`)
}
