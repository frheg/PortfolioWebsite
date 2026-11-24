// Shared THREE.LoadingManager for the background scene's initial texture
// loads (skybox + solar system). Only ever reached via BackgroundCanvas's
// lazy import chain — keep it that way (see sceneLoadingState.js for why).
import * as THREE from 'three'
// Ready = textures loaded AND (if Earth's surface is in view, e.g. Bergen home stop) every wanted
// terrain/imagery/building tile loaded and stable for SETTLE_MS. Caps: terrain never shows up → NO_TERRAIN_MS; dead network → MAX_WAIT_MS.
import { setSceneLoadProgress, setSceneLoadReady, setSceneLoadStatus } from '../utils/sceneLoadingState'
import { getTerrainLoadState } from './earthTerrain'

const TEXTURE_SHARE = 0.55 // progress bar: textures, then tiles
const SETTLE_MS = 700
const NO_TERRAIN_MS = 4000
const MAX_WAIT_MS = 45000

export const sceneLoadingManager = new THREE.LoadingManager()

sceneLoadingManager.onStart = () => setSceneLoadStatus('Bygger galaksen')

sceneLoadingManager.onProgress = (_url, itemsLoaded, itemsTotal) => {
  setSceneLoadProgress((itemsTotal > 0 ? itemsLoaded / itemsTotal : 0) * TEXTURE_SHARE)
  setSceneLoadStatus(itemsLoaded < itemsTotal / 2 ? `Tenner stjernene · ${itemsLoaded}` : `Former planetene · ${itemsLoaded}`)
}

sceneLoadingManager.onLoad = () => {
  const t0 = performance.now()
  let calmSince = null
  let peak = 1
  const poll = () => {
    const now = performance.now()
    const s = getTerrainLoadState()
    if (!s.active) {
      setSceneLoadStatus('Bygger galaksen')
      if (now - t0 > NO_TERRAIN_MS) return setSceneLoadReady()
    } else {
      setSceneLoadStatus(s.pending > 0 ? `Legger Bergen på plass · ${s.fetched} fliser` : 'Pusser fjordene')
      peak = Math.max(peak, s.pending + s.loaded)
      setSceneLoadProgress(TEXTURE_SHARE + (1 - TEXTURE_SHARE) * Math.min(0.99, s.loaded / peak))
      if (s.pending === 0) {
        calmSince ??= now
        if (now - calmSince > SETTLE_MS) return setSceneLoadReady()
      } else {
        calmSince = null
      }
    }
    if (now - t0 > MAX_WAIT_MS) return setSceneLoadReady()
    setTimeout(poll, 100)
  }
  poll()
}
