// Procedural stars beyond the catalog. Octree-ish levels = magnitude bands:
// bright band → huge cells, loaded far; faint band → tiny cells, only near cam.
// Load radius per band = where its brightest star drops below mag limit (+margin) → no pop.
// Cells: generated in worker, one Points each, fade in.
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'
import { createStarPoints } from './starMaterial'

const cfg = spaceConfig.galaxy.stars

function visRadiusPc(absMag, magLimit) {
  return Math.pow(10, (magLimit - absMag + 5) / 5)
}

export function createStarSectors(scene, magLimit) {
  const levels = cfg.bands.map((band, level) => {
    const loadRadius = visRadiusPc(band.mag[0], magLimit + cfg.loadMagMargin)
    return {
      level,
      band,
      loadRadius,
      unloadRadius: loadRadius * 1.25,
      size: loadRadius * cfg.cellFactor,
      // Catalog complete for this band's brightest stars inside here → skip procedural.
      exclusionPc: Math.min(visRadiusPc(band.mag[0], cfg.catalogCompleteMag), cfg.catalogMaxPc),
    }
  })

  const worker = new Worker(new URL('./starWorker.js', import.meta.url), { type: 'module' })
  const cells = new Map() // key → { level, corner, size, count, positions, points, fade }
  const pending = new Map() // id → key
  let nextId = 1
  let scanTimer = 0
  const camPc = new THREE.Vector3()

  worker.onmessage = (event) => {
    const { id, count, positions, absMag, temp, color } = event.data
    const key = pending.get(id)
    pending.delete(id)
    scanTimer = 0 // slot free → refill next frame
    const cell = cells.get(key)
    if (!cell) return // unloaded meanwhile
    cell.count = count
    cell.positions = positions
    cell.absMag = absMag
    cell.temp = temp
    if (count === 0) return
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('absMag', new THREE.BufferAttribute(absMag, 1))
    geometry.setAttribute('temp', new THREE.BufferAttribute(temp, 1))
    geometry.setAttribute('color', new THREE.BufferAttribute(color, 3, true))
    cell.points = createStarPoints(geometry, cell.corner)
    cell.points.material.uniforms.uFade.value = 0
    scene.add(cell.points)
  }

  const boxDistance = (corner, size, p) => {
    const dx = Math.max(corner.x - p.x, 0, p.x - (corner.x + size))
    const dy = Math.max(corner.y - p.y, 0, p.y - (corner.y + size))
    const dz = Math.max(corner.z - p.z, 0, p.z - (corner.z + size))
    return Math.hypot(dx, dy, dz)
  }

  const dropCell = (key, cell) => {
    if (cell.points) {
      scene.remove(cell.points)
      cell.points.geometry.dispose()
      cell.points.material.dispose()
    }
    cells.delete(key)
  }

  const scan = () => {
    const wanted = []
    for (const lv of levels) {
      const { size, loadRadius } = lv
      const min = (c) => Math.floor((c - loadRadius) / size)
      const max = (c) => Math.floor((c + loadRadius) / size)
      for (let ix = min(camPc.x); ix <= max(camPc.x); ix += 1) {
        for (let iy = min(camPc.y); iy <= max(camPc.y); iy += 1) {
          for (let iz = min(camPc.z); iz <= max(camPc.z); iz += 1) {
            const key = `${lv.level}:${ix}:${iy}:${iz}`
            if (cells.has(key)) continue
            const corner = { x: ix * size, y: iy * size, z: iz * size }
            const dist = boxDistance(corner, size, camPc)
            if (dist <= loadRadius) wanted.push({ key, lv, ix, iy, iz, corner, dist: dist / loadRadius })
          }
        }
      }
    }
    // Nearest (relative to band range) first.
    wanted.sort((a, b) => a.dist - b.dist)
    for (const w of wanted) {
      if (pending.size >= cfg.maxInFlight) break
      const id = nextId++
      pending.set(id, w.key)
      cells.set(w.key, { level: w.lv.level, corner: w.corner, size: w.lv.size, count: -1, positions: null, points: null })
      worker.postMessage({
        id,
        level: w.lv.level,
        ix: w.ix,
        iy: w.iy,
        iz: w.iz,
        size: w.lv.size,
        mag: w.lv.band.mag,
        density: w.lv.band.density * cfg.densityScale,
        exclusionPc: w.lv.exclusionPc,
        cap: cfg.cellCap,
        seed: cfg.seed,
      })
    }
    cells.forEach((cell, key) => {
      if (boxDistance(cell.corner, cell.size, camPc) > levels[cell.level].unloadRadius) dropCell(key, cell)
    })
  }

  /** cam: scene pc (float64). */
  const update = (deltaSeconds, cam) => {
    camPc.copy(cam)
    scanTimer -= deltaSeconds
    if (scanTimer <= 0) {
      scanTimer = cfg.scanIntervalS
      scan()
    }
    const k = Math.min(1, deltaSeconds / cfg.cellFadeS)
    cells.forEach((cell) => {
      if (!cell.points) return
      const u = cell.points.material.uniforms.uFade
      if (u.value < 1) u.value = Math.min(1, u.value + k)
    })
  }

  // Nearest loaded star within maxPc of p (scene pc). Writes into out; returns dist or Infinity.
  const nearest = (p, maxPc, out) => {
    let best = maxPc
    let found = false
    cells.forEach((cell) => {
      if (!cell.positions || cell.count <= 0) return
      if (boxDistance(cell.corner, cell.size, p) > best) return
      const { positions, corner } = cell
      for (let i = 0; i < cell.count; i += 1) {
        const dx = corner.x + positions[i * 3] - p.x
        const dy = corner.y + positions[i * 3 + 1] - p.y
        const dz = corner.z + positions[i * 3 + 2] - p.z
        const d = Math.hypot(dx, dy, dz)
        if (d < best) {
          best = d
          found = true
          out.x = corner.x + positions[i * 3]
          out.y = corner.y + positions[i * 3 + 1]
          out.z = corner.z + positions[i * 3 + 2]
          out.absMag = cell.absMag[i]
          out.temp = cell.temp[i]
          out.id = `p${cell.level}:${i}:${Math.round(corner.x)}:${Math.round(corner.y)}:${Math.round(corner.z)}`
        }
      }
    })
    return found ? best : Infinity
  }

  const dispose = () => {
    worker.terminate()
    cells.forEach((cell, key) => dropCell(key, cell))
    pending.clear()
  }

  return { update, nearest, dispose }
}
