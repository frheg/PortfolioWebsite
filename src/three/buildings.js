// 3D buildings around the camera (Earth, low altitude). OpenFreeMap vector tiles (OSM, ODbL).
// z14 tiles within radiusKm of nadir, nearest first, unload beyond 1.5× → small, steady memory.
// Lives in terrain's Earth-local group (spins with Earth). Worker extrudes + seats on ground.
// Roofs draped with Esri orthophoto (z16 near, z15 farther) → per-tile texture + material (shared program).
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'
import { createVertexColorMaterial } from './bodyLod'
import { queueUpload } from './frameGovernor'

const cfg = spaceConfig.solarSystem.earthTerrain.buildings
const terrainCfg = spaceConfig.solarSystem.earthTerrain
const Z = 14
const _dir = new THREE.Vector3()

let buildingsActive = false
/** HUD: OSM attribution while buildings render. */
export function areBuildingsActive() {
  return buildingsActive
}

export function createBuildings(group, sunDir, planetCenter, R, isMobile) {
  const material = createVertexColorMaterial(sunDir, planetCenter)
  const worker = new Worker(new URL('./buildingWorker.js', import.meta.url), { type: 'module' })
  const tiles = new Map() // key → { state, mesh, x, y, d }
  const pending = new Map()
  let nextId = 1
  let urlTemplate = null
  let inFlight = 0
  const radiusKm = isMobile ? cfg.radiusKmMobile : cfg.radiusKm

  // Tile URL is versioned → read from TileJSON once.
  let tileJsonDone = false
  fetch(cfg.tileJsonUrl)
    .then((r) => r.json())
    .then((j) => {
      urlTemplate = j.tiles?.[0] ?? null
    })
    .catch(() => {})
    .finally(() => {
      tileJsonDone = true
    })

  worker.onmessage = (event) => {
    const { id, error, empty, center, positions, normals, colors, uvs, indices, imagery } = event.data
    const t = pending.get(id)
    pending.delete(id)
    inFlight -= 1
    if (!t || t.state !== 'loading') {
      imagery?.close()
      return
    }
    if (error || empty) {
      t.state = 'empty'
      return
    }
    // Drawable later (upload budget). Dropped meanwhile → just free the bitmap.
    t.state = 'queued'
    let tex = null
    if (imagery) {
      tex = new THREE.Texture(imagery)
      tex.flipY = false // ImageBitmap: rows top-down = uv.y down
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 4
      tex.needsUpdate = true
    }
    queueUpload(() => {
      if (t.state !== 'queued') {
        imagery?.close()
        tex?.dispose()
        return false
      }
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3, true))
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
      geometry.setIndex(new THREE.BufferAttribute(indices, 1))
      geometry.computeBoundingSphere()
      t.mesh = new THREE.Mesh(geometry, tex ? createVertexColorMaterial(sunDir, planetCenter, tex) : material)
      t.mesh.position.set(center[0], center[1], center[2])
      group.add(t.mesh)
      t.state = 'ready'
    }, tex ? [tex] : null)
  }

  const drop = (key, t) => {
    if (t.mesh) {
      group.remove(t.mesh)
      t.mesh.geometry.dispose()
      if (t.mesh.material !== material) {
        const tex = t.mesh.material.uniforms.uImagery.value
        tex.image?.close?.()
        tex.dispose()
        t.mesh.material.dispose()
      }
    }
    t.state = 'dropped'
    tiles.delete(key)
  }

  /** camLocal: Earth-local km. camAlt: km above sea level. */
  const update = (camLocal, camAlt) => {
    const on = Boolean(urlTemplate) && camAlt < cfg.maxAltKm
    buildingsActive = false
    if (on) for (const t of tiles.values()) if (t.state === 'ready') buildingsActive = true
    if (!on) {
      tiles.forEach((t, k) => drop(k, t))
      return
    }
    const d = _dir.copy(camLocal).normalize()
    const lat = Math.asin(d.y)
    const lon = Math.atan2(-d.z, d.x)
    const n = 1 << Z
    const fx = ((lon + Math.PI) / (2 * Math.PI)) * n
    const fy = ((1 - Math.log(Math.tan(Math.PI / 4 + lat / 2)) / Math.PI) / 2) * n
    const tileKm = (2 * Math.PI * R * Math.cos(lat)) / n
    // Wider ring when higher (see farther), capped.
    const reachKm = Math.min(radiusKm, Math.max(2, camAlt * 2.5 + 1.5))
    const r = Math.ceil(reachKm / tileKm)

    const wanted = []
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        const tx = Math.floor(fx) + dx
        const ty = Math.floor(fy) + dy
        if (ty < 0 || ty >= n) continue
        const distKm = Math.hypot(tx + 0.5 - fx, ty + 0.5 - fy) * tileKm
        if (distKm > reachKm + tileKm) continue
        wanted.push({ key: `${tx}/${ty}`, x: ((tx % n) + n) % n, y: ty, distKm })
      }
    }
    wanted.sort((a, b) => a.distKm - b.distKm)
    const keep = new Set(wanted.map((w) => w.key))
    for (const w of wanted) {
      if (tiles.has(w.key) || inFlight >= cfg.maxInFlight) continue
      const id = nextId++
      const t = { state: 'loading', mesh: null }
      tiles.set(w.key, t)
      pending.set(id, t)
      inFlight += 1
      worker.postMessage({ id, z: Z, x: w.x, y: w.y, url: urlTemplate, terrainUrl: terrainCfg.terrainUrl, terrainZ: terrainCfg.terrainMaxZoom, radius: R, imageryUrl: terrainCfg.closeImageryUrl, imgZ: w.distKm < cfg.imageryNearKm ? 16 : 15 })
    }
    // Unload outside reach (hysteresis: only when not wanted at all).
    tiles.forEach((t, k) => {
      if (!keep.has(k) && t.state !== 'loading') drop(k, t) // queued → dropped, job cleans up
    })
  }

  const dispose = () => {
    worker.terminate()
    tiles.forEach((t, k) => drop(k, t))
    material.dispose()
    buildingsActive = false
  }

  /** Loading gate: TileJSON not yet in + tiles in flight. */
  const pendingCount = () => (tileJsonDone ? inFlight : 1)

  return { update, dispose, pending: pendingCount }
}
