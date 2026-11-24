// Galaxy orchestrator + frame pipeline: volume glow (sky pass) → world pass → optional lens pass.
// Owns catalog/procedural/Sun star points, nebulae + black holes, nearest-star telemetry + promotion.
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'
import { createGalaxyVolume } from './galaxyVolume'
import { createDeepSpace } from './deepSpace'
import { createNeighborGalaxies } from './neighborGalaxies'
import { createLensPass } from './lensPass'
import { createPostFx } from './postFx'
import { createAtmospheres } from './atmosphere'
import { quality } from './qualityRuntime'
import { getTunnel, getWarp } from './cameraRuntime'
import { getSolarCollisionBodies } from './solarSystemRuntime'
import { createStarPromoter } from './starPromoter'
import { createFadeOverlay } from './fadeOverlay'
import { createStarSectors } from './starSectors'
import { createStarPoints, starUniforms, updateStarUniforms } from './starMaterial'
import { loadStarCatalog } from './starCatalog'
import { nearestStar } from './starRuntime'
import { setPoiGroup } from './solarSystemRuntime'
import { origin } from './floatingOrigin'
import { LY_KM, PC_KM, SUN_ABS_MAG, SUN_RADIUS_KM, spectralClass } from './galaxyFrame'

const cfg = spaceConfig.galaxy.stars
const CHUNK_AT_SUN = { x: 0, y: 0, z: 0 }
const _center = new THREE.Vector2()

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || navigator.maxTouchPoints > 2
}

export function starRadiusKm(absMag, temp) {
  const luminosity = Math.pow(10, -0.4 * (absMag - SUN_ABS_MAG))
  const tr = 5778 / temp
  return SUN_RADIUS_KM * Math.sqrt(luminosity) * tr * tr
}

const fmt = (n, digits = 0) => n.toLocaleString('nb-NO', { maximumFractionDigits: digits })

function namedStarPois(catalog) {
  const { positions, absMag, temp, names } = catalog
  return names.map(({ i, n }) => {
    const pc = [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]]
    const distPc = Math.hypot(...pc)
    const M = absMag[i]
    const T = temp[i]
    const luminosity = Math.pow(10, -0.4 * (M - SUN_ABS_MAG))
    return {
      key: `star_${i}`,
      kind: 'star',
      name: n,
      position: new THREE.Vector3(pc[0] * PC_KM, pc[1] * PC_KM, pc[2] * PC_KM),
      radius: starRadiusKm(M, T),
      labelRange: Infinity,
      factsRange: 0.5 * PC_KM,
      // Bright from here, or close → label.
      labelVisibility: (distKm) => {
        const d = Math.max(distKm / PC_KM, 1e-9)
        if (d < cfg.labelNearPc) return 1
        const mApp = M + 5 * Math.log10(d) - 5
        return 1 - THREE.MathUtils.smoothstep(mApp, cfg.labelMag, cfg.labelMag + 1)
      },
      facts: [
        `Avstand fra Solen: ${fmt((distPc * PC_KM) / LY_KM, 1)} lysår`,
        `Spektralklasse: ${spectralClass(T)}`,
        `Temperatur: ~${fmt(Math.round(T / 100) * 100)} K`,
        `Lysstyrke: ${fmt(luminosity, luminosity < 10 ? 2 : 0)} × Solen`,
      ],
    }
  })
}

export function useGalaxy(sceneRef, rendererRef) {
  const stateRef = useRef(null)

  useEffect(() => {
    const scene = sceneRef.current
    const renderer = rendererRef.current
    if (!scene || !renderer) return undefined

    const isMobile = isMobileDevice()
    const magLimit = isMobile ? cfg.magLimitMobile : cfg.magLimit
    starUniforms.uMagLimit.value = magLimit

    const volume = createGalaxyVolume(isMobile)
    const sectors = createStarSectors(scene, magLimit)
    const deepSpace = createDeepSpace(scene, isMobile)
    const neighbors = createNeighborGalaxies(scene, isMobile)
    const lens = createLensPass(isMobile)
    const post = createPostFx(quality)
    const atmospheres = createAtmospheres()
    const promoter = createStarPromoter(scene)
    const fade = createFadeOverlay()

    // The Sun as a star: takes over from its body LOD once its disc is sub-pixel.
    const sunGeometry = new THREE.BufferGeometry()
    sunGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3))
    sunGeometry.setAttribute('absMag', new THREE.Float32BufferAttribute([SUN_ABS_MAG], 1))
    sunGeometry.setAttribute('temp', new THREE.Float32BufferAttribute([5778], 1))
    sunGeometry.setAttribute('color', new THREE.Uint8BufferAttribute([255, 236, 214], 3, true))
    const sunPoint = createStarPoints(sunGeometry, CHUNK_AT_SUN)
    scene.add(sunPoint)

    const state = { volume, sectors, deepSpace, lens, post, atmospheres, promoter, fade, catalog: null, catalogPoints: null, nearestTimer: 0, disposed: false }
    stateRef.current = state

    loadStarCatalog()
      .then((catalog) => {
        if (state.disposed) return
        state.catalog = catalog
        state.nameByIndex = new Map(catalog.names.map(({ i, n }) => [i, n]))
        state.catalogPoints = createStarPoints(catalog.geometry, CHUNK_AT_SUN)
        scene.add(state.catalogPoints)
        setPoiGroup('stars', namedStarPois(catalog))
      })
      .catch((error) => console.warn('Star catalog unavailable:', error))

    return () => {
      state.disposed = true
      volume.dispose()
      sectors.dispose()
      neighbors.dispose()
      deepSpace.dispose()
      lens.dispose()
      post.dispose()
      atmospheres.dispose()
      promoter.dispose()
      fade.dispose()
      scene.remove(sunPoint)
      sunGeometry.dispose()
      sunPoint.material.dispose()
      if (state.catalogPoints) {
        scene.remove(state.catalogPoints)
        state.catalogPoints.geometry.dispose()
        state.catalogPoints.material.dispose()
      }
      setPoiGroup('stars', [])
      nearestStar.valid = false
      stateRef.current = null
    }
  }, [sceneRef, rendererRef])

  const camPc = useRef(new THREE.Vector3())
  const hitA = useRef({})
  const hitB = useRef({})

  /** After camera moved (origin final for this frame). */
  const update = (deltaSeconds, camera, renderer) => {
    const state = stateRef.current
    if (!state) return
    updateStarUniforms(camera, renderer)
    camPc.current.copy(origin).divideScalar(PC_KM)
    state.sectors.update(deltaSeconds, camPc.current)
    state.deepSpace.update(deltaSeconds)
    state.promoter.update(deltaSeconds, nearestStar, starUniforms.uFocalPx.value)

    state.nearestTimer -= deltaSeconds
    if (state.nearestTimer > 0) return
    state.nearestTimer = cfg.nearestIntervalS
    const dCat = state.catalog ? state.catalog.nearest(camPc.current, cfg.nearestSearchPc, hitA.current) : Infinity
    const dProc = state.sectors.nearest(camPc.current, Math.min(dCat, cfg.nearestSearchPc), hitB.current)
    const hit = dProc < dCat ? hitB.current : dCat < Infinity ? hitA.current : null
    nearestStar.valid = Boolean(hit)
    if (hit) {
      nearestStar.world.x = hit.x * PC_KM
      nearestStar.world.y = hit.y * PC_KM
      nearestStar.world.z = hit.z * PC_KM
      nearestStar.radiusKm = starRadiusKm(hit.absMag, hit.temp)
      nearestStar.temp = hit.temp
      nearestStar.absMag = hit.absMag
      nearestStar.id = hit.id
      nearestStar.name = hit.id.startsWith('c') ? (state.nameByIndex?.get(Number(hit.id.slice(1))) ?? null) : null
    }
  }

  const warpCenter = useRef(new THREE.Vector2(0.5, 0.5))
  const warpDir = useRef(new THREE.Vector3())
  const warpSmooth = useRef({ strength: 0, tunnel: 0 })

  /** Full frame (HDR): sky glow → world → atmospheres → lens → bloom → composite (warp, tone map) → fade. */
  const render = (renderer, scene, camera, deltaSeconds) => {
    const state = stateRef.current
    if (!state) return
    const target = state.post.begin(renderer)
    state.volume.render(renderer, camera, deltaSeconds, target)
    renderer.setRenderTarget(target)
    renderer.clearDepth()
    renderer.render(scene, camera)

    const stages = state.atmospheres.collect(getSolarCollisionBodies(), camera, starUniforms.uFocalPx.value, quality)
    const lensStage = state.lens.collect(renderer, camera, state.deepSpace.blackHoles)
    if (lensStage) stages.push(lensStage)

    // Warp vanishing point = travel direction on screen. Behind cam → fade out. Strength + center eased (no pops).
    const warp = getWarp()
    const sm = warpSmooth.current
    const dt = Math.min(deltaSeconds ?? 1 / 60, 0.1)
    let warpTarget = warp.strength
    warpDir.current.set(warp.x, warp.y, warp.z).transformDirection(camera.matrixWorldInverse)
    if (warpDir.current.z < -0.05) {
      const tanY = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
      const cx = 0.5 + (warpDir.current.x / -warpDir.current.z) / (tanY * camera.aspect) / 2
      const cy = 0.5 + (warpDir.current.y / -warpDir.current.z) / tanY / 2
      // Center far off-screen → streaks fade instead of jumping.
      warpTarget *= 1 - THREE.MathUtils.smoothstep(Math.max(Math.abs(cx - 0.5), Math.abs(cy - 0.5)), 0.6, 1.2)
      if (sm.strength < 0.01) warpCenter.current.set(cx, cy)
      else warpCenter.current.lerp(_center.set(cx, cy), 1 - Math.exp(-10 * dt))
    } else {
      warpTarget = 0
    }
    sm.strength += (warpTarget - sm.strength) * (1 - Math.exp(-5 * dt))
    sm.tunnel += (getTunnel() - sm.tunnel) * (1 - Math.exp(-8 * dt))
    state.post.finish(renderer, stages, { strength: sm.strength, center: warpCenter.current, tunnel: sm.tunnel })
    state.fade.render(renderer)
  }

  return { update, render }
}
