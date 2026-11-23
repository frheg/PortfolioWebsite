// Nearest star → real body when close: emissive sphere (body LOD, sun texture tinted by Teff),
// glow sprite, label + facts. Star point sprite hands over by disc size (starMaterial), body takes it.
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'
import { createBodyLod } from './bodyLod'
import { origin, trackAnchor, untrackAnchor } from './floatingOrigin'
import { setDeepBodies, getDeepBodies, setPoiGroup } from './solarSystemRuntime'
import { PC_KM, LY_KM, SUN_ABS_MAG, SUN_RADIUS_KM, spectralClass, temperatureToRgb } from './galaxyFrame'
import sunTexUrl from '../assets/Models/solar/sun/sol/sun.webp'

const cfg = spaceConfig.galaxy.stars

let glowTexture = null
function getGlowTexture() {
  if (glowTexture) return glowTexture
  const S = 256
  const canvas = document.createElement('canvas')
  canvas.width = S
  canvas.height = S
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.12, 'rgba(255,255,255,0.55)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.12)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  glowTexture = new THREE.CanvasTexture(canvas)
  return glowTexture
}

const fmt = (n, digits = 0) => n.toLocaleString('nb-NO', { maximumFractionDigits: digits })

export function createStarPromoter(scene) {
  const texture = new THREE.TextureLoader().load(sunTexUrl)
  texture.colorSpace = THREE.SRGBColorSpace
  let current = null // { id, anchor, lod, glow, body, world }

  const demote = () => {
    if (!current) return
    untrackAnchor(current.anchor)
    scene.remove(current.anchor)
    current.lod.dispose()
    current.glow.material.dispose()
    setDeepBodies(getDeepBodies().filter((b) => b !== current.body))
    setPoiGroup('promoted', [])
    current = null
  }

  const promote = (star) => {
    const world = new THREE.Vector3(star.world.x, star.world.y, star.world.z)
    const tint = temperatureToRgb(star.temp)
    const def = { key: 'promoted', radius: star.radiusKm, emissive: true, beaconPx: 0, axialTilt: 0.2, tint }
    const anchor = new THREE.Group()
    const tiltGroup = new THREE.Group()
    tiltGroup.rotation.z = def.axialTilt
    anchor.add(tiltGroup)
    const lod = createBodyLod(def, texture, anchor, tiltGroup)
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: getGlowTexture(),
        color: new THREE.Color(...tint),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.8,
      })
    )
    glow.scale.setScalar(star.radiusKm * 9)
    anchor.add(glow)
    trackAnchor(anchor, world)
    scene.add(anchor)

    const body = { key: 'promoted', kind: 'body', position: world, radius: star.radiusKm }
    setDeepBodies([...getDeepBodies(), body])
    const distSunLy = world.length() / LY_KM
    const luminosity = Math.pow(10, -0.4 * (star.absMag - SUN_ABS_MAG))
    setPoiGroup('promoted', [
      {
        key: `promoted_${star.id}`,
        kind: 'star',
        name: star.name ?? 'Ukjent stjerne',
        position: world,
        radius: star.radiusKm,
        labelRange: Infinity,
        facts: [
          `Spektralklasse: ${spectralClass(star.temp)}`,
          `Temperatur: ~${fmt(Math.round(star.temp / 100) * 100)} K`,
          `Radius: ${fmt(star.radiusKm / SUN_RADIUS_KM, 2)} × Solen`,
          `Lysstyrke: ${fmt(luminosity, luminosity < 10 ? 2 : 0)} × Solen`,
          `Avstand fra Solen: ${fmt(distSunLy, 1)} lysår`,
        ],
      },
    ])
    current = { id: star.id, anchor, lod, glow, body, world }
  }

  /** nearest: starRuntime snapshot (+ id). focalPx: current lens. */
  const update = (deltaSeconds, nearest, focalPx) => {
    let dist = Infinity
    if (nearest.valid) {
      const w = nearest.world
      dist = Math.hypot(origin.x - w.x, origin.y - w.y, origin.z - w.z)
    }
    const inRange = dist < cfg.promoteDistancePc * PC_KM
    if (current && (!nearest.valid || nearest.id !== current.id || dist > cfg.promoteDistancePc * PC_KM * 1.3)) demote()
    if (!current && inRange) promote(nearest)
    if (!current) return
    current.lod.mesh.rotation.y += deltaSeconds * 0.02
    current.lod.update(current.world, origin, focalPx)
  }

  const dispose = () => {
    demote()
    texture.dispose()
  }

  return { update, dispose }
}
