// Bake planet textures → KTX2 (Basis ETC1S, mips, sRGB) + small tinted webp for the HUD minimap.
// Tint baked in → no per-pixel loops on the main thread at load. Run after changing a source texture or a tint:
//   npm run build:ktx2
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'
import { encodeToKTX2 } from 'ktx2-encoder'
import { tintPixels } from '../src/three/textureTints.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = (p) => path.join(root, 'src/assets/Models', p)
const outDir = path.join(root, 'src/assets/ktx2')

// key → source. map: also write minimap webp (bodies only).
const SOURCES = {
  sun: { file: 'solar/sun/sol/sun.webp', map: true },
  mercury: { file: 'solar/mercury/mercury.webp', map: true },
  venus: { file: 'solar/venus/venus.webp', map: true },
  earth: { file: 'Earth 3D Model/textures/earth.webp', map: true },
  earthLights: { file: 'Earth 3D Model/textures/earth_lights_2048.png' },
  moon: { file: 'solar/moon/moon.webp', map: true },
  mars: { file: 'solar/mars/mars.webp', map: true },
  jupiter: { file: 'solar/jupiter/jupiter.webp', map: true },
  saturn: { file: 'solar/saturn/saturno/saturn.webp', map: true },
  saturnRing: { file: 'solar/saturn/saturno/ring.webp' },
  uranus: { file: 'solar/uranus/uranus.webp', map: true },
  uranusRing: { file: 'solar/uranus/uranus_rings.webp' },
  neptune: { file: 'solar/neptune/neptune.webp', map: true },
  pluto: { file: 'solar/pluto/pluto.webp', map: true },
}

const MAP_W = 1024 // max = hudMaps texels size
const MAP_H = 512

await mkdir(outDir, { recursive: true })
for (const [key, { file, map }] of Object.entries(SOURCES)) {
  // Block-compressed GPU formats (BC1/S3TC) need base size ×4 → round up.
  const meta = await sharp(src(file)).metadata()
  const w4 = Math.ceil(meta.width / 4) * 4
  const h4 = Math.ceil(meta.height / 4) * 4
  const { data, info } = await sharp(src(file)).resize(w4, h4, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  tintPixels(key, data)
  const raw = { data: new Uint8Array(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height }
  const ktx = await encodeToKTX2(Buffer.alloc(0), {
    imageDecoder: async () => raw,
    enableDebug: false,
    isUASTC: false,
    qualityLevel: 230,
    compressionLevel: 3,
    generateMipmap: true,
    isPerceptual: true,
    isSetKTX2SRGBTransferFunc: true,
    isYFlip: true, // TextureLoader flipY=true look; KTX2 textures upload unflipped
  })
  await writeFile(path.join(outDir, `${key}.ktx2`), ktx)
  let note = ''
  if (map) {
    const webp = await sharp(Buffer.from(data), { raw: { width: info.width, height: info.height, channels: 4 } })
      .resize(MAP_W, MAP_H, { fit: 'inside', withoutEnlargement: true }) // minimap scales to 1024×512 anyway
      .webp({ quality: 80 })
      .toBuffer()
    await writeFile(path.join(outDir, `${key}.map.webp`), webp)
    note = ` + map ${(webp.length / 1024).toFixed(0)} KB`
  }
  console.log(`${key}: ${info.width}×${info.height} → ${(ktx.length / 1024).toFixed(0)} KB${note}`)
}
