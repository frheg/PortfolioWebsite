// Earth surface: Web Mercator quadtree of real imagery + elevation, projected onto the sphere.
// Active only within render distance (explore). Refine by screen-space error, parents stand in
// while children load, LRU cache. Base sphere sinks a few km under tiles → no z-fight.
// Imagery: EOX Sentinel-2 cloudless (CC BY-NC-SA 4.0) ≤ z9, Esri World Imagery beyond (sub-meter).
// Elevation: AWS Terrain Tiles (Terrarium) + per-pixel normal maps.
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'
import { createSurfaceMaterial } from './bodyLod'
import { origin } from './floatingOrigin'
import { quality } from './qualityRuntime'
import { createBuildings } from './buildings'
import { createShips } from './ships'
import { createFlights } from './flights'

const cfg = spaceConfig.solarSystem.earthTerrain

const mercatorLat = (yFrac) => Math.atan(Math.sinh(Math.PI * (1 - 2 * yFrac)))

function dirFromLatLon(lat, lon, out = new THREE.Vector3()) {
  const c = Math.cos(lat)
  return out.set(Math.cos(lon) * c, Math.sin(lat), -Math.sin(lon) * c)
}

const _q = new THREE.Quaternion()
const _qi = new THREE.Quaternion()
const _v = new THREE.Vector3()
const _camLocal = new THREE.Vector3()

let terrainActive = false
// Earth frame (world quaternion of the spinning surface, center, radius) for name layers. Updated every frame.
let earthFrame = null
export function getEarthFrame() {
  return earthFrame
}
let latLonFn = null
/** [latDeg, lonDeg] under a world pos while tiles active, else null. */
export function getEarthLatLon(worldPos) {
  return terrainActive && latLonFn ? latLonFn(worldPos) : null
}
let heightFn = null
/** Ground height (km above R) under a world pos; 0 while tiles off. Labels sit on this. */
export function getEarthHeightAt(worldPos) {
  return terrainActive && heightFn ? heightFn(worldPos) : 0
}
/** HUD: show attribution while tiles are on. */
export function isEarthTerrainActive() {
  return terrainActive
}

/**
 * earth: { def, world (Vector3 km), tiltGroup, mesh, lod } from useSolarSystem.
 * Returns { update(focalPx, explore), heightAt(worldPos) → km, dispose }.
 */
export function createEarthTerrain(earth, isMobile, maxAnisotropy = 8, pixelRatio = () => 1) {
  const R = earth.def.radius
  const maxZ = isMobile ? cfg.maxZoomMobile : cfg.maxZoom
  const splitPx = isMobile ? cfg.splitPxMobile : cfg.splitPx
  // Cache budget from device RAM (Chrome: navigator.deviceMemory, GB, ≤ 8).
  const deviceGb = (typeof navigator !== 'undefined' && navigator.deviceMemory) || (isMobile ? 4 : 8)
  const maxTiles = Math.round(
    THREE.MathUtils.clamp(deviceGb * cfg.tilesPerGb, cfg.minTiles, isMobile ? cfg.maxTilesMobile : cfg.maxTiles)
  )
  const maxInFlight = isMobile ? cfg.maxInFlightMobile : cfg.maxInFlight

  // Spins with Earth mesh (copy rotation each frame), lives in its tilt frame.
  const normalRot = { value: new THREE.Matrix3() } // shared: Earth-local → world
  const group = new THREE.Group()
  group.visible = false
  earth.tiltGroup.add(group)
  const buildings = createBuildings(group, earth.lod.sunDir, earth.anchor.position, R, isMobile)
  const ships = createShips(group, R, earth.lod.sunDir, earth.anchor.position)
  const flights = createFlights(group, R, earth.lod.sunDir, earth.anchor.position)

  // Pool: decode + normal maps are CPU-heavy → spread over cores. Same-parent tiles → same worker (cache hits).
  const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4
  const workers = Array.from(
    { length: Math.max(1, Math.min(isMobile ? cfg.workersMobile : cfg.workers, cores - 1)) },
    () => new Worker(new URL('./terrainWorker.js', import.meta.url), { type: 'module' })
  )
  const workerFor = (t) => {
    const shift = Math.max(0, t.z - cfg.terrainMaxZoom)
    return workers[((t.x >> shift) * 31 + (t.y >> shift)) % workers.length]
  }
  const tiles = new Map() // key → tile
  const pending = new Map() // worker id → tile
  const queue = new Set()
  let inFlight = 0
  let nextId = 1
  let frame = 0

  const key = (z, x, y) => `${z}/${x}/${y}`

  const getTile = (z, x, y) => {
    const k = key(z, x, y)
    let t = tiles.get(k)
    if (t) return t
    const n = 1 << z
    // Bounds on sphere: center + farthest corner (+ max relief).
    const latN = mercatorLat(y / n)
    const latS = mercatorLat((y + 1) / n)
    const lonW = (x / n) * 2 * Math.PI - Math.PI
    const lonE = ((x + 1) / n) * 2 * Math.PI - Math.PI
    const center = dirFromLatLon(mercatorLat((y + 0.5) / n), (lonW + lonE) / 2).multiplyScalar(R)
    let radius = 0
    for (const [la, lo] of [[latN, lonW], [latN, lonE], [latS, lonW], [latS, lonE]]) {
      radius = Math.max(radius, dirFromLatLon(la, lo, _v).multiplyScalar(R).distanceTo(center))
    }
    // Ground size along tile → texel size for SSE.
    const groundKm = (2 * Math.PI * R * Math.cos((latN + latS) / 2)) / n
    t = { k, z, x, y, center, radius: radius + 2, groundKm, state: 'empty', mesh: null, heights: null, lastUsed: 0, geoReady: false, texReady: false }
    tiles.set(k, t)
    return t
  }

  // GPU upload budget: finished tiles queue, ≤ uploadsPerFrame become drawable per frame (no hitches).
  const uploads = []
  const makeReady = (t) => {
    if (!t.geoReady || !t.texReady) return
    uploads.push(t)
  }
  const flushUploads = () => {
    for (let n = 0; n < cfg.uploadsPerFrame && uploads.length; n += 1) {
      const t = uploads.shift()
      if (t.state !== 'loading') continue
      t.mesh.visible = false
      group.add(t.mesh)
      t.state = 'ready'
    }
  }

  // Each tile = 2 parts (geometry, imagery), each ½ of an in-flight slot.
  const partDone = (t) => {
    if (t.parts <= 0) return
    t.parts -= 1
    inFlight -= 0.5
  }

  const failed = (t) => {
    inFlight -= 0.5 * Math.max(t.parts, 0)
    t.parts = 0
    t.state = 'error'
  }

  const onWorkerMessage = (event) => {
    const { id, error, center, positions, normals, uvs, indices, heights, normalMap } = event.data
    const t = pending.get(id)
    pending.delete(id)
    if (!t || t.state === 'disposed' || t.state === 'error') return
    if (error) return failed(t)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    geometry.setIndex(new THREE.BufferAttribute(indices, 1))
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), t.radius)
    t.mesh.geometry = geometry
    t.mesh.position.set(center[0], center[1], center[2])
    t.mesh.material.uniforms.uTileCenter.value.set(center[0], center[1], center[2])
    const nm = new THREE.DataTexture(normalMap, 128, 128, THREE.RGFormat)
    nm.unpackAlignment = 2
    nm.flipY = false
    nm.generateMipmaps = true
    nm.minFilter = THREE.LinearMipmapLinearFilter
    nm.magFilter = THREE.LinearFilter
    nm.needsUpdate = true
    t.normalTexture = nm
    t.mesh.material.uniforms.uNormalMap.value = nm
    t.mesh.material.uniforms.uUseNormalMap.value = 1
    t.heights = heights
    t.geoReady = true
    partDone(t)
    makeReady(t)
  }

  workers.forEach((w) => {
    w.onmessage = onWorkerMessage
  })

  const request = (t, high) => {
    if (t.state !== 'empty') return
    t.state = 'loading'
    t.parts = 2
    inFlight += 1
    t.mesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      createSurfaceMaterial(null, earth.lod.sunDir, {
        side: THREE.DoubleSide,
        nightMap: earth.lod.nightMap,
        nightGain: earth.lod.nightGain,
        normalRot,
      })
    )
    t.mesh.matrixAutoUpdate = true

    const id = nextId++
    t.id = id
    t.abort = new AbortController()
    pending.set(id, t)
    workerFor(t).postMessage({
      id,
      z: t.z,
      x: t.x,
      y: t.y,
      grid: cfg.grid,
      radius: R,
      terrainUrl: cfg.terrainUrl,
      terrainMaxZ: cfg.terrainMaxZoom,
      skirtKm: Math.max(0.05, t.groundKm / cfg.grid),
    })

    const template = t.z > cfg.imageryMaxZoom ? cfg.closeImageryUrl : cfg.imageryUrl
    const url = template.replace('{z}', t.z).replace('{x}', t.x).replace('{y}', t.y)
    fetch(url, { signal: t.abort.signal, priority: high ? 'high' : 'low' })
      .then((res) => {
        if (!res.ok) throw new Error(`imagery ${res.status}`)
        return res.blob()
      })
      .then((blob) => createImageBitmap(blob, { imageOrientation: 'none' }))
      .then((bitmap) => {
        if (t.state === 'disposed' || t.state === 'error') return bitmap.close()
        const texture = new THREE.Texture(bitmap)
        texture.flipY = false
        texture.colorSpace = THREE.SRGBColorSpace
        texture.anisotropy = maxAnisotropy
        texture.needsUpdate = true
        // Decoded pixels live on GPU after upload → free the CPU copy.
        texture.onUpdate = () => {
          bitmap.close()
          texture.onUpdate = null
        }
        t.mesh.material.uniforms.map.value = texture
        t.texture = texture
        t.texReady = true
        partDone(t)
        makeReady(t)
      })
      .catch(() => {
        if (t.state === 'loading') failed(t)
      })
  }

  // Stale in-flight tile (cam moved on) → abort fetch + worker job, back to empty.
  const cancelTile = (t) => {
    inFlight -= 0.5 * Math.max(t.parts, 0)
    t.parts = 0
    t.abort?.abort()
    if (pending.delete(t.id)) workerFor(t).postMessage({ cancel: t.id })
    disposeTile(t, true)
  }

  const disposeTile = (t, alreadyCounted = false) => {
    if (t.state === 'loading' && !alreadyCounted) inFlight -= 0.5 * Math.max(t.parts, 0)
    if (t.mesh) {
      group.remove(t.mesh)
      t.mesh.geometry.dispose()
      t.mesh.material.dispose()
    }
    t.abort?.abort()
    t.texture?.image?.close?.()
    t.texture?.dispose()
    t.normalTexture?.dispose()
    t.state = 'disposed'
    tiles.delete(t.k)
  }

  // ─── selection ─────────────────────────────────────────────────────────────

  const visible = []
  let focal = 1000
  let camDist = Infinity
  let horizonCos = 0
  const reliefHorizon = Math.acos(R / (R + cfg.maxReliefKm))

  const culled = (t) => {
    // Horizon: tile center angle vs horizon angle + tile angular radius.
    const ang = Math.acos(Math.min(1, Math.max(-1, _v.copy(t.center).normalize().dot(_camLocal) / camDist)))
    const horizon = Math.acos(Math.min(1, horizonCos))
    // + horizon of a peak of maxReliefKm (far mountains still poke over).
    return ang - Math.asin(Math.min(1, t.radius / R)) > horizon + reliefHorizon
  }

  const surfaceDist = (t) => Math.max(t.center.distanceTo(_camLocal) - t.radius, 0.05)

  // Texel > split px → refine. Far tiles (hazed, grazing) need less: threshold grows with distance.
  const wantsSplit = (t) => {
    if (t.z >= maxZ) return false
    const d = surfaceDist(t)
    const threshold = splitPx * quality.terrainSplitScale * (1 + d / cfg.distanceFalloffKm)
    return ((t.groundKm / 256) / d) * focal > threshold
  }

  const children = (t) => [0, 1, 2, 3].map((i) => getTile(t.z + 1, t.x * 2 + (i & 1), t.y * 2 + (i >> 1)))

  // Returns after drawing this tile or its descendants. Unready → caller draws itself.
  const visit = (t) => {
    t.lastUsed = frame
    t.lastUsedMs = nowMs
    if (culled(t)) return
    if (wantsSplit(t)) {
      const kids = children(t)
      kids.forEach((c) => {
        c.lastUsed = frame
        c.lastUsedMs = nowMs
        if (c.state === 'empty') queue.add(c)
      })
      // Lookahead: kid nearest cam → queue its kids too (+ next level) → sharp tiles start early.
      let near = kids.reduce((a, c) => (c.center.distanceTo(_camLocal) < a.center.distanceTo(_camLocal) ? c : a))
      for (let depth = 0; depth < cfg.lookaheadLevels && wantsSplit(near); depth += 1) {
        const grand = children(near)
        grand.forEach((g) => {
          g.lastUsed = frame
          g.lastUsedMs = nowMs
          if (g.state === 'empty') queue.add(g)
        })
        near = grand.reduce((a, c) => (c.center.distanceTo(_camLocal) < a.center.distanceTo(_camLocal) ? c : a))
      }
      if (kids.every((c) => c.state === 'ready' || c.state === 'error')) {
        kids.forEach((c) => (c.state === 'ready' ? visit(c) : null))
        if (kids.some((c) => c.state === 'error')) visible.push(t) // hole guard
        return
      }
    }
    visible.push(t)
  }

  const frameState = { quaternion: new THREE.Quaternion(), world: earth.world, radius: R }

  let nowMs = 0

  const update = (focalPx, explore) => {
    frame += 1
    nowMs = performance.now()
    group.rotation.copy(earth.mesh.rotation)
    group.updateWorldMatrix(true, false)
    group.getWorldQuaternion(frameState.quaternion)
    earthFrame = explore ? frameState : null
    _v.subVectors(origin, earth.world)
    const distWorld = _v.length()
    const active = explore && distWorld < R * cfg.activeRadii
    terrainActive = active
    group.visible = active
    // Sink base sphere under tiles while active.
    earth.mesh.scale.setScalar(active ? R - cfg.baseSinkKm : R)
    if (!active) {
      buildings.update(_camLocal, Infinity) // drops all
      return
    }

    _q.copy(frameState.quaternion)
    _qi.copy(_q).invert()
    normalRot.value.setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(_q))
    _camLocal.subVectors(origin, earth.world).applyQuaternion(_qi)
    camDist = _camLocal.length()
    horizonCos = R / camDist
    buildings.update(_camLocal, camDist - R)
    ships.update(_camLocal, camDist - R, focalPx)
    flights.update(_camLocal, camDist - R, focalPx)
    focal = focalPx * pixelRatio() // SSE in device px (HiDPI → finer tiles)

    visible.length = 0
    queue.clear()
    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < 4; x += 1) {
        const root = getTile(2, x, y)
        root.lastUsed = frame
        root.lastUsedMs = nowMs
        if (root.state === 'empty') queue.add(root)
        if (root.state === 'ready') visit(root)
      }
    }

    tiles.forEach((t) => {
      if (t.mesh && t.state === 'ready') t.mesh.visible = false
    })
    visible.forEach((t) => {
      t.mesh.visible = true
    })

    // Load: nearest surface first (big ancestors count as near → still load early), then coarse.
    const ordered = [...queue].sort((a, b) => surfaceDist(a) - surfaceDist(b) || a.z - b.z)
    let rank = 0
    for (const t of ordered) {
      if (inFlight >= maxInFlight) break
      request(t, rank < cfg.highPriorityLoads)
      rank += 1
    }

    flushUploads()

    // Unrequested bookkeeping tiles nobody visits → drop (keeps the map small).
    tiles.forEach((t) => {
      if (t.state === 'empty' && frame - t.lastUsed > cfg.cancelAfterFrames) tiles.delete(t.k)
    })

    // Cancel loads nobody wanted for a while (flew past).
    tiles.forEach((t) => {
      if (t.state === 'loading' && frame - t.lastUsed > cfg.cancelAfterFrames) cancelTile(t)
    })

    // Idle evict: drawn-but-unseen for a while → free now (RAM stays minimal, roots kept).
    tiles.forEach((t) => {
      if (t.state === 'ready' && t.z > 2 && t.lastUsed < frame && nowMs - (t.lastUsedMs ?? 0) > cfg.idleEvictMs) disposeTile(t)
    })

    // LRU evict (never this frame's).
    if (tiles.size > maxTiles) {
      const old = [...tiles.values()]
        .filter((t) => t.lastUsed < frame && t.state !== 'loading' && t.state !== 'empty')
        .sort((a, b) => a.lastUsed - b.lastUsed)
      for (let i = 0; i < tiles.size - maxTiles && i < old.length; i += 1) disposeTile(old[i])
    }
  }

  latLonFn = (worldPos) => {
    _v.subVectors(worldPos, earth.world).applyQuaternion(_qi).normalize()
    return [THREE.MathUtils.radToDeg(Math.asin(_v.y)), THREE.MathUtils.radToDeg(Math.atan2(-_v.z, _v.x))]
  }

  // Terrain height (km above R) under a world position. Deepest ready tile, bilinear.
  const heightAt = (worldPos) => {
    if (!terrainActive) return 0
    _v.subVectors(worldPos, earth.world).applyQuaternion(_qi).normalize()
    const lat = Math.asin(_v.y)
    const lon = Math.atan2(-_v.z, _v.x)
    const xf = (lon + Math.PI) / (2 * Math.PI)
    const yf = (1 - Math.log(Math.tan(Math.PI / 4 + lat / 2)) / Math.PI) / 2
    if (yf < 0 || yf >= 1) return 0
    for (let z = maxZ; z >= 2; z -= 1) {
      const n = 1 << z
      const t = tiles.get(key(z, Math.floor(xf * n), Math.floor(yf * n)))
      if (!t || !t.heights) continue
      const side = cfg.grid + 1
      const u = (xf * n - t.x) * cfg.grid
      const v = (yf * n - t.y) * cfg.grid
      const i0 = Math.min(Math.floor(u), cfg.grid - 1)
      const j0 = Math.min(Math.floor(v), cfg.grid - 1)
      const fu = u - i0
      const fv = v - j0
      const h = t.heights
      const a = h[j0 * side + i0] * (1 - fu) + h[j0 * side + i0 + 1] * fu
      const b = h[(j0 + 1) * side + i0] * (1 - fu) + h[(j0 + 1) * side + i0 + 1] * fu
      return a * (1 - fv) + b * fv
    }
    return 0
  }

  // Dev only: lat/lon (deg) + alt (km) → world km. For console/tests.
  if (import.meta.env.DEV) {
    window.__earth = {
      latLonAltToWorld: (latDeg, lonDeg, altKm) => {
        group.rotation.copy(earth.mesh.rotation)
        group.updateWorldMatrix(true, false)
        group.getWorldQuaternion(_q)
        const d = dirFromLatLon(THREE.MathUtils.degToRad(latDeg), THREE.MathUtils.degToRad(lonDeg))
        const p = d.multiplyScalar(R + altKm).applyQuaternion(_q).add(earth.world)
        return [p.x, p.y, p.z]
      },
    }
  }

  const dispose = () => {
    if (import.meta.env.DEV) delete window.__earth
    workers.forEach((w) => w.terminate())
    buildings.dispose()
    ships.dispose()
    flights.dispose()
    ;[...tiles.values()].forEach(disposeTile)
    earth.tiltGroup.remove(group)
    earth.mesh.scale.setScalar(R)
    terrainActive = false
    earthFrame = null
  }

  heightFn = heightAt
  return { update, heightAt, dispose }
}
