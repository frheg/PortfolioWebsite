import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'
import { setSolarCollisionBodies } from './solarSystemRuntime'
import { sceneLoadingManager } from './sceneLoadingManager'
import {
  daysSinceJ2000,
  dateMsFromDaysSinceJ2000,
  heliocentricPositionAU,
  hasEphemeris,
  baseSemiMajorAxisAU,
  ROTATION_PERIOD_DAYS,
  MOON_SIDEREAL_ORBIT_DAYS,
} from './ephemeris'
import { getSpeedMultiplier, setSimulatedDateMs } from './ephemerisTime'

import sunTexUrl from '../assets/Models/solar/sun/sol/sun.webp'
import mercuryTexUrl from '../assets/Models/solar/mercury/mercury.webp'
import venusTexUrl from '../assets/Models/solar/venus/venus.webp'
import earthTexUrl from '../assets/Models/Earth 3D Model/textures/earth.webp'
import moonTexUrl from '../assets/Models/solar/moon/moon.webp'
import marsTexUrl from '../assets/Models/solar/mars/mars.webp'
import jupiterTexUrl from '../assets/Models/solar/jupiter/jupiter.webp'
import saturnTexUrl from '../assets/Models/solar/saturn/saturno/saturn.webp'
import saturnRingTexUrl from '../assets/Models/solar/saturn/saturno/ring.webp'
import uranusTexUrl from '../assets/Models/solar/uranus/uranus.webp'
import uranusRingTexUrl from '../assets/Models/solar/uranus/uranus_rings.webp'
import neptuneTexUrl from '../assets/Models/solar/neptune/neptune.webp'
import plutoTexUrl from '../assets/Models/solar/pluto/pluto.webp'

const textureUrls = {
  sun: sunTexUrl,
  mercury: mercuryTexUrl,
  venus: venusTexUrl,
  earth: earthTexUrl,
  moon: moonTexUrl,
  mars: marsTexUrl,
  jupiter: jupiterTexUrl,
  saturn: saturnTexUrl,
  saturnRing: saturnRingTexUrl,
  uranus: uranusTexUrl,
  uranusRing: uranusRingTexUrl,
  neptune: neptuneTexUrl,
  pluto: plutoTexUrl,
}

// Ring-texture tints, keyed by the same textureUrls key used below — chosen
// to pair with each planet's own hue-shift target rather than repeating the
// UI's lavender/mauve accents everywhere.
const RING_TINTS = {
  saturnRing: 0xfab387, // peach
  uranusRing: 0x89dceb, // sky
}

// The source ring photos paint the gaps between rings (e.g. the Cassini
// division) as a flat dark color rather than as actual transparency, so at
// any uniform material opacity those gaps render as a hard, opaque-looking
// band instead of a see-through gap — that's the "harsh" line you get across
// the ring. This redraws each ring as a flat tint whose alpha comes from the
// source pixel's own luminance, so dark bands become genuinely transparent
// (letting space show through) while bright bands stay solid, and recolors
// the whole thing to match the site's palette instead of the source photo's
// warm grey-brown.
function processRingTexture(image, tintHex) {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0)

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  const tint = new THREE.Color(tintHex)
  const tintR = Math.round(tint.r * 255)
  const tintG = Math.round(tint.g * 255)
  const tintB = Math.round(tint.b * 255)

  for (let i = 0; i < data.length; i += 4) {
    const luminance = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255
    data[i] = tintR
    data[i + 1] = tintG
    data[i + 2] = tintB
    data[i + 3] = Math.round(Math.pow(Math.min(1, Math.max(0, luminance)), 1.4) * 255)
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas
}

// Per-planet hue-shift target, keyed by textureUrls key. The source photos
// are realistic NASA imagery, which reads as an odd mismatch against a
// stylized, hand-tinted scene — this recolors each one toward a distinct
// Catppuccin color deliberately spread across the palette (not just
// lavender/mauve, which the UI chrome already leans on heavily) so each
// planet reads as its own color rather than a variation on the same hue.
const PLANET_HUE_TARGETS = {
  sun: { hex: 0xfab387, strength: 0.6 }, // peach — matches its own glow sprites, pushed harder since the source photo's natural color was already close to the old gentle target
  mercury: { hex: 0x9399b2, strength: 0.55 }, // overlay2
  venus: { hex: 0xfab387, strength: 0.55 }, // peach
  earth: { hex: 0x94e2d5, strength: 0.5 }, // teal
  moon: { hex: 0xa6adc8, strength: 0.5 }, // subtext0
  mars: { hex: 0xeba0ac, strength: 0.55 }, // maroon
  jupiter: { hex: 0xf9e2af, strength: 0.5 }, // yellow
  saturn: { hex: 0xf5e0dc, strength: 0.5 }, // rosewater
  uranus: { hex: 0x89dceb, strength: 0.55 }, // sky
  neptune: { hex: 0x74c7ec, strength: 0.55 }, // sapphire
  pluto: { hex: 0xf2cdcd, strength: 0.5 }, // flamingo
}

// Shortest-path lerp around the hue circle (0..1), so e.g. going from 0.95
// to 0.05 shifts +0.1 through the wrap point rather than the long way round
// through 0.5.
function lerpHue(a, b, t) {
  let diff = b - a
  if (diff > 0.5) diff -= 1
  if (diff < -0.5) diff += 1
  let result = a + diff * t
  if (result < 0) result += 1
  if (result >= 1) result -= 1
  return result
}

// Recolors a texture toward targetHex while keeping each pixel's original
// lightness — that's where all the photographic detail (craters, cloud
// bands, terrain shading) actually lives, so preserving it keeps the planet
// recognizable while the hue/saturation shift makes it match the palette.
function applyHueShift(image, targetHex, strength) {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0)

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  const target = new THREE.Color(targetHex)
  const targetHsl = target.getHSL({})
  const pixel = new THREE.Color()
  const hsl = {}

  for (let i = 0; i < data.length; i += 4) {
    pixel.setRGB(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255)
    pixel.getHSL(hsl)
    const h = lerpHue(hsl.h, targetHsl.h, strength)
    const s = hsl.s + (targetHsl.s - hsl.s) * strength
    pixel.setHSL(h, s, hsl.l)
    data[i] = Math.round(pixel.r * 255)
    data[i + 1] = Math.round(pixel.g * 255)
    data[i + 2] = Math.round(pixel.b * 255)
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas
}

// ─── Real-ephemeris scale ────────────────────────────────────────────────────
// The scene's orbitRadius values are already hand-compressed (outer planets
// pulled in much more than a true linear AU scale would) so the whole system
// stays flyable. Deriving a per-body AU→scene-units factor from each body's
// own existing orbitRadius keeps that layout, while still giving each body
// its true elliptical shape, eccentricity and orbital phase relative to
// itself — only the distance unit is rescaled, not the orbit's geometry.
const AU_SCALE = Object.fromEntries(
  spaceConfig.solarSystem.bodies
    .filter((def) => hasEphemeris(def.key))
    .map((def) => [def.key, def.orbitRadius / baseSemiMajorAxisAU(def.key)])
)

// ─── Singleton glow texture cache ────────────────────────────────────────────
// Canvas textures are created exactly once per page load and reused across all
// mounts/remounts — avoids allocating new GPU texture objects every time the
// explore page is visited.

const _glowCache = new Map()

function cachedGlowTex(key, factory) {
  if (!_glowCache.has(key)) _glowCache.set(key, factory())
  return _glowCache.get(key)
}

// ─── Shared texture helper ────────────────────────────────────────────────────

/**
 * Creates a radial-gradient canvas texture that fades smoothly from [r,g,b]
 * at the centre to fully transparent at the edge.  Using these as Sprite
 * materials guarantees zero hard edges regardless of world-space scale.
 */
function buildSoftGlowTexture(rgb) {
  const S = 256
  const canvas = document.createElement('canvas')
  canvas.width = S
  canvas.height = S
  const ctx = canvas.getContext('2d')
  const cx = S / 2
  const [r, g, b] = rgb

  const grd = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx)
  grd.addColorStop(0.00, `rgba(${r}, ${g}, ${b}, 1.00)`)
  grd.addColorStop(0.15, `rgba(${r}, ${g}, ${b}, 0.80)`)
  grd.addColorStop(0.40, `rgba(${r}, ${g}, ${b}, 0.35)`)
  grd.addColorStop(0.70, `rgba(${r}, ${g}, ${b}, 0.08)`)
  grd.addColorStop(1.00, `rgba(${r}, ${g}, ${b}, 0.00)`)
  ctx.fillStyle = grd
  ctx.fillRect(0, 0, S, S)

  return new THREE.CanvasTexture(canvas)
}

// ─── Sun glow helpers ────────────────────────────────────────────────────────

/** Outer halo sprite: wide radial gradient + 6-spike diffraction pattern. */
function buildSunHaloTexture() {
  const S = 512
  const canvas = document.createElement('canvas')
  canvas.width = S
  canvas.height = S
  const ctx = canvas.getContext('2d')
  const cx = S / 2
  const r = S / 2

  // Soft background radial gradient
  const bg = ctx.createRadialGradient(cx, cx, 0, cx, cx, r)
  bg.addColorStop(0.00, 'rgba(245, 224, 220, 0.65)') // rosewater
  bg.addColorStop(0.07, 'rgba(249, 226, 175, 0.40)') // yellow
  bg.addColorStop(0.22, 'rgba(250, 179, 135, 0.18)') // peach
  bg.addColorStop(0.50, 'rgba(235, 160, 172, 0.06)') // maroon
  bg.addColorStop(1.00, 'rgba(243, 139, 168, 0.00)') // red
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, S, S)

  // 6 diffraction spikes on 3 axes
  const axes = [
    { angle: 0,                   len: 0.47, coreW: 3.5, softW: 14, op: 0.85 },
    { angle: Math.PI / 3,         len: 0.42, coreW: 2.5, softW: 11, op: 0.65 },
    { angle: (Math.PI * 2) / 3,   len: 0.38, coreW: 2.5, softW: 10, op: 0.55 },
  ]

  axes.forEach(({ angle, len, coreW, softW, op }) => {
    ctx.save()
    ctx.translate(cx, cx)
    ctx.rotate(angle)

    for (const dir of [-1, 1]) {
      const endX = dir * r * len

      const sg = ctx.createLinearGradient(0, 0, endX, 0)
      sg.addColorStop(0.0, `rgba(249, 226, 175, ${op * 0.40})`) // yellow
      sg.addColorStop(0.2, `rgba(250, 179, 135, ${op * 0.20})`) // peach
      sg.addColorStop(0.6, `rgba(235, 160, 172, ${op * 0.06})`) // maroon
      sg.addColorStop(1.0, 'rgba(243, 139, 168, 0)') // red
      ctx.fillStyle = sg
      ctx.fillRect(dir > 0 ? 0 : endX, -softW / 2, Math.abs(endX), softW)

      const cg = ctx.createLinearGradient(0, 0, endX, 0)
      cg.addColorStop(0.00, `rgba(245, 224, 220, ${op})`) // rosewater
      cg.addColorStop(0.15, `rgba(249, 226, 175, ${op * 0.70})`) // yellow
      cg.addColorStop(0.45, `rgba(250, 179, 135, ${op * 0.20})`) // peach
      cg.addColorStop(1.00, 'rgba(235, 160, 172, 0)') // maroon
      ctx.fillStyle = cg
      ctx.fillRect(dir > 0 ? 0 : endX, -coreW / 2, Math.abs(endX), coreW)
    }
    ctx.restore()
  })

  return new THREE.CanvasTexture(canvas)
}

/**
 * Ring-profile glow sprite for the sun surface edge.
 *
 * The texture is TRANSPARENT at the centre and peaks at exactly 50% of the
 * canvas radius.  When rendered as a Sprite sized to `radius * 4.0`, the
 * world-space centre-to-edge = radius * 2.0, so stop 0.50 lands precisely on
 * the sun sphere's surface — the glow appears only at and just outside the
 * visible edge, with zero contribution inside the sphere area.
 *
 *  Canvas %   →  world distance (radius=30 example)
 *   0 %        →   0  (sun centre, fully transparent)
 *  44 %        →  26  (just inside the surface — glow starts blooming in)
 *  50 %        →  30  (sun surface)
 *  58 %        →  35  (peak brightness, just outside sun)
 *  82 %        →  49  (mostly faded)
 * 100 %        →  60  (transparent edge)
 */
function buildSunRimGlowTexture() {
  const S = 512
  const canvas = document.createElement('canvas')
  canvas.width = S
  canvas.height = S
  const ctx = canvas.getContext('2d')
  const cx = S / 2

  // Wide, gradual ramp rather than mostly-flat-then-a-spike — that shape is
  // what read as a hard ring right at the sun's edge instead of a soft bloom.
  const grd = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx)
  grd.addColorStop(0.00, 'rgba(245, 224, 220, 0.00)') // rosewater — fully transparent, sun texture shows
  grd.addColorStop(0.32, 'rgba(245, 224, 220, 0.00)') // still inside sun body
  grd.addColorStop(0.44, 'rgba(249, 226, 175, 0.18)') // yellow — first hint of glow, before the surface
  grd.addColorStop(0.50, 'rgba(250, 179, 135, 0.55)') // peach — at the surface, a bright limb rather than a hard edge
  grd.addColorStop(0.58, 'rgba(250, 179, 135, 0.85)') // peach — peak, just outside the surface
  grd.addColorStop(0.68, 'rgba(235, 160, 172, 0.42)') // maroon
  grd.addColorStop(0.82, 'rgba(243, 139, 168, 0.10)') // red
  grd.addColorStop(1.00, 'rgba(243, 139, 168, 0.00)')
  ctx.fillStyle = grd
  ctx.fillRect(0, 0, S, S)

  return new THREE.CanvasTexture(canvas)
}

/**
 * Adds the full layered glow system to the sun's anchor.
 * All canvas textures are module-level singletons (see _glowCache) so they are
 * created once per page load — NOT pushed to disposables.
 */
function buildSunGlowEffect(radius, anchor) {
  const glowSprites = []

  // Layer 0: rim glow (transparent centre, peak at sun surface). Scale is
  // fixed at radius * 4.0 — that's load-bearing for buildSunRimGlowTexture's
  // gradient stops to land where the doc comment above it says they do,
  // shrink the corona/halo layers below instead for a smaller glow overall.
  const rimTex = cachedGlowTex('sun-rim', buildSunRimGlowTexture)
  const rimSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: rimTex, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false })
  )
  rimSprite.scale.setScalar(radius * 4.0)
  rimSprite.userData.baseOpacity = 0.78
  rimSprite.userData.baseSize    = radius * 4.0
  anchor.add(rimSprite)
  glowSprites.push(rimSprite)

  // Layers 1–4: wide soft-gradient corona. Opacities stay short of the
  // original values — these layers overlap heavily near the surface, and
  // with additive blending even pastel Catppuccin colors sum toward white
  // fast once several of them stack, which is what read as a plain white
  // halo originally.
  const coronaLayers = [
    { size: radius *  2.8, baseOpacity: 0.38, rgb: [245, 224, 220] }, // rosewater
    { size: radius *  5.5, baseOpacity: 0.32, rgb: [249, 226, 175] }, // yellow
    { size: radius * 10.0, baseOpacity: 0.18, rgb: [250, 179, 135] }, // peach
    { size: radius * 17.0, baseOpacity: 0.09, rgb: [235, 160, 172] }, // maroon
  ]

  coronaLayers.forEach(({ size, baseOpacity, rgb }) => {
    const tex = cachedGlowTex(`soft-${rgb.join(',')}`, () => buildSoftGlowTexture(rgb))
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: baseOpacity, blending: THREE.AdditiveBlending, depthWrite: false })
    )
    sprite.scale.setScalar(size)
    sprite.userData.baseOpacity = baseOpacity
    sprite.userData.baseSize = size
    anchor.add(sprite)
    glowSprites.push(sprite)
  })

  // Outer halo + diffraction spike sprite
  const haloTex = cachedGlowTex('sun-halo', buildSunHaloTexture)
  const haloSize = radius * 22
  const haloSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: haloTex, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false })
  )
  haloSprite.scale.setScalar(haloSize)
  haloSprite.userData.baseScale = haloSize
  anchor.add(haloSprite)

  return { glowSprites, haloSprite }
}

// ─── UFO helpers ─────────────────────────────────────────────────────────────

/**
 * Classic flying saucer shape:
 *  - CylinderGeometry disc for the main hull (proper taper)
 *  - SphereGeometry dome (glass-like)
 *  - A subtle emissive under-panel ring instead of an obtrusive torus
 */
function buildSaucer(anchor) {
  // Main disc — tapered rim edge
  const hullGeo = new THREE.CylinderGeometry(5.2, 6.8, 1.2, 24, 1)
  const hull = new THREE.Mesh(
    hullGeo,
    new THREE.MeshStandardMaterial({ color: 0x9399b2, metalness: 0.88, roughness: 0.15 }) // overlay2
  )

  // Flat underside plate
  const plateGeo = new THREE.CylinderGeometry(6.8, 6.8, 0.22, 24, 1)
  const plate = new THREE.Mesh(
    plateGeo,
    new THREE.MeshStandardMaterial({
      color: 0x585b70, // surface2
      metalness: 0.92,
      roughness: 0.10,
      emissive: new THREE.Color(0x140d1c), // dark mauve
      emissiveIntensity: 0.4,
    })
  )
  plate.position.y = -0.70

  // Dome
  const domeGeo = new THREE.SphereGeometry(4.0, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)
  const dome = new THREE.Mesh(
    domeGeo,
    new THREE.MeshStandardMaterial({
      color: 0xcbd2fb, transparent: true, opacity: 0.42, roughness: 0.03, metalness: 0.10, // light sky
    })
  )
  dome.position.y = 0.50

  // Thin emissive light band at the rim edge (replaces the ugly torus)
  const bandGeo = new THREE.CylinderGeometry(6.95, 6.95, 0.18, 24, 1, true)
  const band = new THREE.Mesh(
    bandGeo,
    new THREE.MeshBasicMaterial({
      color: 0x94e2d5,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  )
  band.position.y = -0.52

  const group = new THREE.Group()
  group.add(hull, plate, dome, band)
  anchor.add(group)
}

/**
 * Adds a soft diffuse glow to each UFO anchor.
 *
 * Uses a plain radial-gradient sprite (bright-centre → transparent edge) sized
 * moderately so it forms a soft halo rather than a hard ring.  The sprite is
 * semi-transparent so it never looks harsh against dark space.
 *
 * A small dim PointLight is also attached so the saucer body itself is lightly
 * self-illuminated from below — this makes the UFO visible even in dark areas
 * without creating an over-bright glow that competes with the sun.
 */
function addUfoGlow(anchor) {
  // Singleton glow texture — created once, reused for all UFO instances
  const tex = cachedGlowTex('ufo-glow', () => buildSoftGlowTexture([0, 210, 160]))
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0.45,          // deliberately low — subtle ambient glow, not neon ring
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  )
  sprite.scale.setScalar(22) // anchor-space → ~10 world units (scale 0.45 applied)
  anchor.add(sprite)

  // Dim cyan PointLight: illuminates the saucer body and nearby space
  // decay=2 (quadratic), intensity tuned so lit side shows at ~5–15 anchor units
  const light = new THREE.PointLight(0x94e2d5, 500, 0, 2)
  anchor.add(light)
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSolarSystem(sceneRef, isExplore = false) {
  const systemRef = useRef(null)
  const timeRef = useRef(0)
  const bodyMapRef = useRef(new Map())
  const collisionBodiesRef = useRef([])
  const ufosRef = useRef([])
  const sunGlowRef = useRef(null)
  const isExploreRef = useRef(isExplore)
  const wasExploreRef = useRef(isExplore)
  const simDaysRef = useRef(daysSinceJ2000())
  isExploreRef.current = isExplore

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return undefined

    const disposables = []

    const textureLoader = new THREE.TextureLoader(sceneLoadingManager)
    const textures = Object.fromEntries(
      Object.entries(textureUrls).map(([key, url]) => {
        const ringTint = RING_TINTS[key]
        const hueTarget = PLANET_HUE_TARGETS[key]
        const onLoad = ringTint
          ? (loaded) => {
              loaded.image = processRingTexture(loaded.image, ringTint)
              loaded.needsUpdate = true
            }
          : hueTarget
          ? (loaded) => {
              loaded.image = applyHueShift(loaded.image, hueTarget.hex, hueTarget.strength)
              loaded.needsUpdate = true
            }
          : undefined
        const texture = textureLoader.load(url, onLoad)
        texture.anisotropy = spaceConfig.solarSystem.textureAnisotropy
        texture.colorSpace = THREE.SRGBColorSpace
        return [key, texture]
      })
    )

    const system = new THREE.Group()
    scene.add(system)
    systemRef.current = system

    const bodyMap = new Map()
    const sphereGeometry = new THREE.SphereGeometry(
      1,
      spaceConfig.solarSystem.segments.width,
      spaceConfig.solarSystem.segments.height
    )

    for (const [index, def] of spaceConfig.solarSystem.bodies.entries()) {
      const anchor = new THREE.Group()
      const tiltGroup = new THREE.Group()
      tiltGroup.rotation.z = def.axialTilt || 0
      anchor.add(tiltGroup)

      const material = def.emissive
        ? new THREE.MeshBasicMaterial({ map: textures[def.texture] })
        : new THREE.MeshStandardMaterial({ map: textures[def.texture], metalness: 0, roughness: 1 })

      const mesh = new THREE.Mesh(sphereGeometry, material)
      mesh.scale.setScalar(def.radius)
      tiltGroup.add(mesh)

      if (def.ringTexture) {
        const ringGeo = new THREE.RingGeometry(def.ringInner, def.ringOuter, 96)
        const ring = new THREE.Mesh(
          ringGeo,
          new THREE.MeshBasicMaterial({
            map: textures[def.ringTexture],
            transparent: true,
            opacity: def.ringOpacity,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        )
        ring.rotation.x = Math.PI / 2
        tiltGroup.add(ring)
      }

      // Sun gets layered smooth-gradient glow (no hard-edged BackSide spheres)
      if (def.emissive) {
        sunGlowRef.current = buildSunGlowEffect(def.radius, anchor)
      }

      system.add(anchor)
      bodyMap.set(def.key, { def: { ...def, phase: index * 0.8 }, anchor, tiltGroup, mesh })
    }

    bodyMapRef.current = bodyMap

    // Build all UFOs
    const { count, scale, roamRadius, speed } = spaceConfig.solarSystem.ufo
    for (let i = 0; i < count; i += 1) {
      const ufoAnchor = new THREE.Group()
      ufoAnchor.scale.setScalar(scale)
      system.add(ufoAnchor)

      buildSaucer(ufoAnchor)
      addUfoGlow(ufoAnchor)

      const angle = (i / count) * Math.PI * 2
      const startR = roamRadius * 0.3
      const startPos = new THREE.Vector3(
        Math.cos(angle) * startR,
        (i - (count - 1) / 2) * 25,
        Math.sin(angle) * startR
      )
      ufoAnchor.position.copy(startPos)

      ufosRef.current.push({
        group: ufoAnchor,
        position: startPos.clone(),
        velocity: new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle)).multiplyScalar(speed),
        steer: new THREE.Vector3(Math.cos(angle + 0.5), 0.15, Math.sin(angle + 0.5)),
        phase: i * Math.E,
      })
    }

    return () => {
      setSolarCollisionBodies([])
      system.traverse((obj) => {
        obj.geometry?.dispose?.()
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach((m) => m?.dispose?.())
      })
      scene.remove(system)
      Object.values(textures).forEach((t) => t.dispose())
      disposables.forEach((t) => t.dispose())
      systemRef.current = null
      bodyMapRef.current = new Map()
      ufosRef.current = []
      sunGlowRef.current = null
    }
  }, [sceneRef])

  const update = (deltaSeconds = 1 / 60) => {
    const bodyMap = bodyMapRef.current
    if (!bodyMap.size) return

    const explore = isExploreRef.current
    if (explore && !wasExploreRef.current) {
      // Re-sync to the real "right now" each time Explore mode is entered,
      // rather than resuming from wherever a previous visit left off.
      simDaysRef.current = daysSinceJ2000()
    }
    wasExploreRef.current = explore

    timeRef.current += deltaSeconds * spaceConfig.solarSystem.timeScale
    const time = timeRef.current

    if (explore) {
      simDaysRef.current += (deltaSeconds * getSpeedMultiplier()) / 86400
      setSimulatedDateMs(dateMsFromDaysSinceJ2000(simDaysRef.current))
    }
    const simDays = simDaysRef.current

    const collisions = []

    bodyMap.forEach((body) => {
      const { def, anchor, mesh } = body
      let x = spaceConfig.solarSystem.center.x
      let y = spaceConfig.solarSystem.center.y
      let z = spaceConfig.solarSystem.center.z

      const useRealOrbit = explore && hasEphemeris(def.key)

      if (useRealOrbit) {
        // Ephemeris "z" is ecliptic-north; map it to the scene's up axis.
        const auPos = heliocentricPositionAU(def.key, simDays)
        const scale = AU_SCALE[def.key]
        x = auPos.x * scale
        y = auPos.z * scale
        z = auPos.y * scale
      } else if (def.parent) {
        const parent = bodyMap.get(def.parent)
        const theta =
          explore && def.key === 'moon'
            // Simplified real circular orbit at the Moon's true sidereal
            // period — full lunar perturbation theory is overkill here.
            ? (simDays / MOON_SIDEREAL_ORBIT_DAYS) * Math.PI * 2 + def.phase
            : time * def.orbitSpeed + def.phase
        x = parent.anchor.position.x + Math.cos(theta) * def.orbitRadius
        y = parent.anchor.position.y + Math.sin(theta * 1.7) * 1.5
        z = parent.anchor.position.z + Math.sin(theta) * def.orbitRadius
      } else if (def.orbitRadius > 0) {
        const theta = time * def.orbitSpeed + def.phase
        x = Math.cos(theta) * def.orbitRadius
        y = Math.sin(theta * 0.5 + def.phase) * 3
        z = Math.sin(theta) * def.orbitRadius
      }

      anchor.position.set(x, y, z)

      if (def.tidallyLocked && def.parent) {
        // Tidally locked: rotation tracks the orbital angle so the same face
        // always points toward the parent body (like Earth's Moon in reality).
        const lockTheta =
          explore
            ? (simDays / MOON_SIDEREAL_ORBIT_DAYS) * Math.PI * 2 + def.phase
            : time * def.orbitSpeed + def.phase
        mesh.rotation.y = Math.PI / 2 + lockTheta
      } else if (explore && ROTATION_PERIOD_DAYS[def.key]) {
        // Real sidereal rotation rate. Direction reuses the existing
        // rotationSpeed's sign — the site's already-tuned retrograde
        // convention (see spaceConfig's axialTilt for Venus/Uranus/Pluto) —
        // rather than introducing a second, possibly inconsistent encoding.
        const direction = Math.sign(def.rotationSpeed) || 1
        mesh.rotation.y = direction * (simDays / ROTATION_PERIOD_DAYS[def.key]) * Math.PI * 2
      } else {
        mesh.rotation.y += def.rotationSpeed * deltaSeconds * spaceConfig.solarSystem.timeScale * 60
      }

      collisions.push({
        key: def.key,
        position: anchor.position.clone(),
        radius: def.radius + spaceConfig.solarSystem.bodyCollisionPadding,
      })
    })

    // Animate sun glow (soft pulse on each corona layer + slow spike rotation)
    if (sunGlowRef.current) {
      const { glowSprites, haloSprite } = sunGlowRef.current
      glowSprites.forEach((sprite, i) => {
        sprite.material.opacity =
          sprite.userData.baseOpacity * (1 + Math.sin(time * (0.50 + i * 0.22) + i * 1.1) * 0.20)
        // Innermost layer also pulses slightly in scale
        if (i === 0) {
          sprite.scale.setScalar(sprite.userData.baseSize * (1 + Math.sin(time * 0.38) * 0.04))
        }
      })
      haloSprite.material.opacity  = 0.72 + Math.sin(time * 0.33) * 0.22
      haloSprite.material.rotation += deltaSeconds * 0.008
      haloSprite.scale.setScalar(
        haloSprite.userData.baseScale * (1 + Math.sin(time * 0.15) * 0.03)
      )
    }

    // Update all UFOs
    ufosRef.current.forEach((ufo, idx) => {
      const roam = spaceConfig.solarSystem.ufo.roamRadius
      const t = time * 2.3 + ufo.phase

      ufo.steer.set(
        Math.sin(t * 0.71) + Math.cos(t * 1.17) * 0.45,
        Math.sin(t * 0.43 + 1.2) * 0.32,
        Math.cos(t * 0.53 + 0.4) + Math.sin(t * 0.91) * 0.45
      ).normalize()

      const centerPull = ufo.position.clone().multiplyScalar(-1 / Math.max(ufo.position.length(), 1))
      if (ufo.position.length() > roam) {
        ufo.steer.add(centerPull.multiplyScalar(2.6))
      }

      const sunOffset = ufo.position.clone().sub(spaceConfig.solarSystem.center)
      if (sunOffset.length() < spaceConfig.solarSystem.ufo.minSunDistance) {
        ufo.steer.add(sunOffset.normalize().multiplyScalar(3))
      }

      collisions.forEach((body) => {
        const offset = ufo.position.clone().sub(body.position)
        const minDist = body.radius + spaceConfig.solarSystem.ufo.collisionRadius + 12
        if (offset.length() < minDist) {
          ufo.steer.add(offset.normalize().multiplyScalar(3.2))
        }
      })

      ufo.steer.normalize()
      const targetVelocity = ufo.steer.clone().multiplyScalar(spaceConfig.solarSystem.ufo.speed)
      ufo.velocity.lerp(targetVelocity, spaceConfig.solarSystem.ufo.steering * deltaSeconds)
      ufo.position.addScaledVector(ufo.velocity, deltaSeconds)

      if (ufo.position.length() > roam + 18) {
        ufo.position.setLength(roam + 18)
      }

      ufo.group.position.copy(ufo.position)
      if (ufo.velocity.lengthSq() > 0.001) {
        ufo.group.lookAt(ufo.position.clone().add(ufo.velocity))
      }
      ufo.group.rotation.z +=
        Math.sin(time * 6.5 + ufo.phase) * spaceConfig.solarSystem.ufo.wobble * 0.002

      collisions.push({
        key: `ufo_${idx}`,
        position: ufo.position.clone(),
        radius: spaceConfig.solarSystem.ufo.collisionRadius,
      })
    })

    collisionBodiesRef.current = collisions
    setSolarCollisionBodies(collisions)
  }

  return { update }
}
