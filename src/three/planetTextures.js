// Planet textures: baked KTX2 (scripts/build-ktx2.mjs) → GPU-compressed, mips + tint pre-baked, transcoded in workers.
// → no main-thread decode/tint loops, ~4–6× less VRAM, small uploads. No KTX2 support / load error → webp + live tint.
import * as THREE from 'three'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { tintPixels } from './textureTints'

const ktx2Urls = import.meta.glob('../assets/ktx2/*.ktx2', { query: '?url', import: 'default', eager: true })
const mapUrls = import.meta.glob('../assets/ktx2/*.map.webp', { query: '?url', import: 'default', eager: true })
const urlFor = (urls, key, ext) => urls[`../assets/ktx2/${key}${ext}`]

/** Minimap image (tinted, ≤1024×512), loaded on first ask. */
const mapImages = new Map()
export function planetMapImage(key) {
  let img = mapImages.get(key)
  if (!img) {
    const url = urlFor(mapUrls, key, '.map.webp')
    if (!url) return null
    img = new Image()
    img.src = url
    mapImages.set(key, img)
  }
  return img
}

// Fallback: webp → canvas → tint (main thread, old path).
function loadFallback(manager, key, url, done) {
  new THREE.TextureLoader(manager).load(url, (tex) => {
    const img = tex.image
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
    tintPixels(key, data.data)
    ctx.putImageData(data, 0, 0)
    tex.image = canvas
    tex.needsUpdate = true
    done(tex)
  })
}

/**
 * fallbackUrls: key → webp/png url. onTexture(key, texture) per arrival (sRGB set).
 * Returns cancel(): stop handing out textures (late arrivals disposed).
 */
export function loadPlanetTextures(renderer, manager, fallbackUrls, onTexture) {
  let live = true
  const keys = Object.keys(fallbackUrls)
  let pending = keys.length
  const loader = new KTX2Loader(manager).setTranscoderPath(`${import.meta.env.BASE_URL}basis/`)
  let ktxOk = true
  try {
    loader.detectSupport(renderer)
  } catch {
    ktxOk = false
  }
  const done = (key, tex) => {
    pending -= 1
    if (pending === 0) loader.dispose() // free transcoder workers
    if (!live) return tex.dispose()
    tex.colorSpace = THREE.SRGBColorSpace
    onTexture(key, tex)
  }
  for (const key of keys) {
    const url = urlFor(ktx2Urls, key, '.ktx2')
    const fallback = () => loadFallback(manager, key, fallbackUrls[key], (tex) => done(key, tex))
    if (!ktxOk || !url) fallback()
    else loader.load(url, (tex) => done(key, tex), undefined, fallback)
  }
  return () => {
    live = false
  }
}
