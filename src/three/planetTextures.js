// Planet textures: baked KTX2 (scripts/build-ktx2.mjs) → GPU-compressed, mips pre-built, transcoded in workers.
// → no main-thread decode loops, ~4–6× less VRAM, small uploads. No KTX2 support / load error → webp fallback.
// Up front ≤ 2k; <key>@4k.ktx2 on demand (camera close, loadHiRes).
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
 * Returns { cancel() (late arrivals disposed), loadHiRes(key, onTexture) → false if none / already asked }.
 */
export function loadPlanetTextures(renderer, manager, fallbackUrls, onTexture) {
  let live = true
  const keys = Object.keys(fallbackUrls)
  const loader = new KTX2Loader(manager).setTranscoderPath(`${import.meta.env.BASE_URL}basis/`)
  let ktxOk = true
  try {
    loader.detectSupport(renderer)
  } catch {
    ktxOk = false
  }
  const done = (key, tex) => {
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
  // 4k: same loader (one transcoder pool), kept until cancel.
  const asked = new Set()
  const loadHiRes = (key, onHi) => {
    const url = urlFor(ktx2Urls, key, '@4k.ktx2')
    if (!ktxOk || !url || asked.has(key)) return false
    asked.add(key)
    loader.load(url, (tex) => {
      if (!live) return tex.dispose()
      tex.colorSpace = THREE.SRGBColorSpace
      onHi(tex)
    })
    return true
  }

  const cancel = () => {
    live = false
    loader.dispose()
  }
  return { cancel, loadHiRes }
}
