// 3D buildings around the camera (Earth, low altitude). OpenFreeMap vector tiles (OSM, ODbL).
// z14 tiles within radiusKm of nadir, nearest first, unload beyond 1.5× → small, steady memory.
// Lives in terrain's Earth-local group (spins with Earth). Worker extrudes + seats on ground.
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'
import { createVertexColorMaterial } from './bodyLod'

const cfg = spaceConfig.solarSystem.earthTerrain.buildings
const terrainCfg = spaceConfig.solarSystem.earthTerrain
const Z = 14

let buildingsActive = false
/** HUD: OSM attribution while buildings render. */
export function areBuildingsActive() {
  return buildingsActive
}

export function createBuildings(group, sunDir, R, isMobile) {
  const material = createVertexColorMaterial(sunDir)
  const worker = new Worker(new URL('./buildingWorker.js', import.meta.url), { type: 'module' })
  const tiles = new Map() // key → { state, mesh, x, y, d }
  const pending = new Map()
  let nextId = 1
  let urlTemplate = null
  let inFlight = 0
  const radiusKm = isMobile ? cfg.radiusKmMobile : cfg.radiusKm

  // Tile URL is versioned → read from TileJSON once.
  fetch(cfg.tileJsonUrl)
    .then((r) => r.json())
    .then((j) => {
      urlTemplate = j.tiles?.[0] ?? null
    })
    .catch(() => {})

  worker.onmessage = (event) => {
    const { id, error, empty, center, positions, normals, colors, indices } = event.data
    const t = pending.get(id)
    pending.delete(id)
    inFlight -= 1
    if (!t || t.state !== 'loading') return
    if (error || empty) {
      t.state = 'empty'
      return
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3, true))
    geometry.setIndex(new THREE.BufferAttribute(indices, 1))
    geometry.computeBoundingSphere()
    t.mesh = new THREE.Mesh(geometry, material)
    t.mesh.position.set(center[0], center[1], center[2])
    group.add(t.mesh)
    t.state = 'ready'
  }

  const drop = (key, t) => {
    if (t.mesh) {
      group.remove(t.mesh)
      t.mesh.geometry.dispose()
    }
    t.state = 'dropped'
    tiles.delete(key)
  }

  /** camLocal: Earth-local km. camAlt: km above sea level. */
  const update = (camLocal, camAlt) => {
    const on = Boolean(urlTemplate) && camAlt < cfg.maxAltKm
    buildingsActive = on && [...tiles.values()].some((t) => t.state === 'ready')
    if (!on) {
      tiles.forEach((t, k) => drop(k, t))
      return
    }
    const d = camLocal.clone().normalize()
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
      worker.postMessage({ id, z: Z, x: w.x, y: w.y, url: urlTemplate, terrainUrl: terrainCfg.terrainUrl, terrainZ: terrainCfg.terrainMaxZoom, radius: R })
    }
    // Unload outside reach (hysteresis: only when not wanted at all).
    tiles.forEach((t, k) => {
      if (!keep.has(k) && t.state !== 'loading') drop(k, t)
    })
  }

  const dispose = () => {
    worker.terminate()
    tiles.forEach((t, k) => drop(k, t))
    material.dispose()
    buildingsActive = false
  }

  return { update, dispose }
}
