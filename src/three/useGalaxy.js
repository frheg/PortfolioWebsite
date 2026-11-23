// Galaxy orchestrator + frame pipeline: volume glow (sky pass) → world pass → optional lens pass.
// Owns catalog/procedural/Sun star points, nebulae + black holes, nearest-star telemetry + promotion.
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'
import { createGalaxyVolume } from './galaxyVolume'
import { createDeepSpace } from './deepSpace'
import { createLensPass } from './lensPass'
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
    const lens = createLensPass(isMobile)
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

    const state = { volume, sectors, deepSpace, lens, promoter, fade, catalog: null, catalogPoints: null, nearestTimer: 0, disposed: false }
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
      deepSpace.dispose()
      lens.dispose()
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

  /** Full frame: sky glow → world → lens (only when a black hole bends ≥ few px). */
  const render = (renderer, scene, camera, deltaSeconds) => {
    const state = stateRef.current
    const target = state ? state.lens.prepare(renderer, camera, state.deepSpace.blackHoles) : null
    renderer.setRenderTarget(target)
    renderer.clear()
    state?.volume.render(renderer, camera, deltaSeconds, target)
    renderer.clearDepth()
    renderer.render(scene, camera)
    if (target) state.lens.finish(renderer)
    state?.fade.render(renderer)
  }

  return { update, render }
}
