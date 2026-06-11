import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'
import { setSolarCollisionBodies } from './solarSystemRuntime'

import sunTexUrl from '../assets/Models/solar/sun/sol/2k_sun.jpg'
import mercuryTexUrl from '../assets/Models/solar/mercury/2k_mercury.jpg'
import venusTexUrl from '../assets/Models/solar/venus/venusmap.jpg'
import earthTexUrl from '../assets/Models/Earth 3D Model/textures/1_earth_2k.jpg'
import moonTexUrl from '../assets/Models/solar/moon/Moon_photorealistic.jpg'
import marsTexUrl from '../assets/Models/solar/mars/mars_1k_color.jpg'
import jupiterTexUrl from '../assets/Models/solar/jupiter/Jupiter/Maps/jupitermap.jpg'
import saturnTexUrl from '../assets/Models/solar/saturn/saturno/2k_saturn.jpg'
import saturnRingTexUrl from '../assets/Models/solar/saturn/saturno/ring.PNG'
import uranusTexUrl from '../assets/Models/solar/uranus/Uranus_v2_L3.123cca176b4e-b004-4e02-8841-1970086e0076/13907_Uranus_planet_diff.jpg'
import uranusRingTexUrl from '../assets/Models/solar/uranus/Uranus_v2_L3.123cca176b4e-b004-4e02-8841-1970086e0076/13907_Uranus_Rings_diff.jpg'
import neptuneTexUrl from '../assets/Models/solar/neptune/Neptune/Maps/neptunemap.jpg'
import plutoTexUrl from '../assets/Models/solar/pluto/Pluto_diff.jpg'

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
  bg.addColorStop(0.00, 'rgba(255, 252, 210, 0.65)')
  bg.addColorStop(0.07, 'rgba(255, 230, 120, 0.40)')
  bg.addColorStop(0.22, 'rgba(255, 170,  40, 0.18)')
  bg.addColorStop(0.50, 'rgba(255, 100,  10, 0.06)')
  bg.addColorStop(1.00, 'rgba(255,  60,   0, 0.00)')
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
      sg.addColorStop(0.0, `rgba(255, 240, 180, ${op * 0.40})`)
      sg.addColorStop(0.2, `rgba(255, 210, 100, ${op * 0.20})`)
      sg.addColorStop(0.6, `rgba(255, 160,  50, ${op * 0.06})`)
      sg.addColorStop(1.0, 'rgba(255, 100, 0, 0)')
      ctx.fillStyle = sg
      ctx.fillRect(dir > 0 ? 0 : endX, -softW / 2, Math.abs(endX), softW)

      const cg = ctx.createLinearGradient(0, 0, endX, 0)
      cg.addColorStop(0.00, `rgba(255, 252, 220, ${op})`)
      cg.addColorStop(0.15, `rgba(255, 235, 160, ${op * 0.70})`)
      cg.addColorStop(0.45, `rgba(255, 190,  80, ${op * 0.20})`)
      cg.addColorStop(1.00, 'rgba(255, 140, 30, 0)')
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
 *  50 %        →  30  (sun surface — glow starts)
 *  55 %        →  33  (peak brightness, just outside sun)
 *  75 %        →  45  (mostly faded)
 * 100 %        →  60  (transparent edge)
 */
function buildSunRimGlowTexture() {
  const S = 512
  const canvas = document.createElement('canvas')
  canvas.width = S
  canvas.height = S
  const ctx = canvas.getContext('2d')
  const cx = S / 2

  const grd = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx)
  grd.addColorStop(0.00, 'rgba(255, 255, 210, 0.00)') // fully transparent — sun texture shows
  grd.addColorStop(0.43, 'rgba(255, 252, 195, 0.00)') // still inside sun body
  grd.addColorStop(0.48, 'rgba(255, 244, 165, 0.12)') // approaching surface
  grd.addColorStop(0.53, 'rgba(255, 228, 110, 0.82)') // peak: warm rim at/just outside surface
  grd.addColorStop(0.60, 'rgba(255, 200,  65, 0.48)') // quick outer fade
  grd.addColorStop(0.70, 'rgba(255, 162,  32, 0.16)')
  grd.addColorStop(0.84, 'rgba(255, 115,  10, 0.04)')
  grd.addColorStop(1.00, 'rgba(255,  75,   0, 0.00)')
  ctx.fillStyle = grd
  ctx.fillRect(0, 0, S, S)

  return new THREE.CanvasTexture(canvas)
}

/**
 * Adds the full layered glow system to the sun's anchor.
 *
 * Layer 0 — rim glow sprite: transparent inside sun, peaks at sun surface,
 *            smooth outward fade → no hard seam at the sphere edge.
 * Layers 1–4 — wide soft-gradient corona Sprites for the ambient warm glow.
 * Layer 5 — astigmatism/spike halo Sprite.
 *
 * No BackSide spheres are used anywhere — they produce hard concentric rings.
 */
function buildSunGlowEffect(radius, anchor, disposables) {
  const glowSprites = []

  // ── Layer 0: rim glow ── transparent centre, peak at sun surface, fade out
  // Sprite sized so that 50 % of canvas radius = sun sphere radius (see docstring).
  const rimTex = buildSunRimGlowTexture()
  disposables.push(rimTex)
  const rimSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: rimTex,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  )
  rimSprite.scale.setScalar(radius * 4.0) // 50 % of half-scale = sun surface radius
  rimSprite.userData.baseOpacity = 0.88
  rimSprite.userData.baseSize   = radius * 4.0
  anchor.add(rimSprite)
  glowSprites.push(rimSprite)

  // ── Layers 1–4: wide soft-gradient corona ── (tight → wide)
  const coronaLayers = [
    { size: radius *  3.0, baseOpacity: 0.50, rgb: [255, 252, 225] },
    { size: radius *  6.5, baseOpacity: 0.42, rgb: [255, 220, 120] },
    { size: radius * 12.0, baseOpacity: 0.20, rgb: [255, 165,  50] },
    { size: radius * 22.0, baseOpacity: 0.09, rgb: [255, 100,  15] },
  ]

  coronaLayers.forEach(({ size, baseOpacity, rgb }) => {
    const tex = buildSoftGlowTexture(rgb)
    disposables.push(tex)
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: baseOpacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    sprite.scale.setScalar(size)
    sprite.userData.baseOpacity = baseOpacity
    sprite.userData.baseSize = size
    anchor.add(sprite)
    glowSprites.push(sprite)
  })

  // Outer halo + astigmatism diffraction spike sprite
  const haloTex = buildSunHaloTexture()
  disposables.push(haloTex)
  const haloSize = radius * 26
  const haloSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: haloTex,
      transparent: true,
      opacity: 0.80,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
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
  const hullGeo = new THREE.CylinderGeometry(5.2, 6.8, 1.2, 36, 1)
  const hull = new THREE.Mesh(
    hullGeo,
    new THREE.MeshStandardMaterial({ color: 0x8899aa, metalness: 0.88, roughness: 0.15 })
  )

  // Flat underside plate
  const plateGeo = new THREE.CylinderGeometry(6.8, 6.8, 0.22, 36, 1)
  const plate = new THREE.Mesh(
    plateGeo,
    new THREE.MeshStandardMaterial({
      color: 0x556677,
      metalness: 0.92,
      roughness: 0.10,
      emissive: new THREE.Color(0x002211),
      emissiveIntensity: 0.4,
    })
  )
  plate.position.y = -0.70

  // Dome
  const domeGeo = new THREE.SphereGeometry(4.0, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2)
  const dome = new THREE.Mesh(
    domeGeo,
    new THREE.MeshStandardMaterial({
      color: 0xccffee, transparent: true, opacity: 0.42, roughness: 0.03, metalness: 0.10,
    })
  )
  dome.position.y = 0.50

  // Thin emissive light band at the rim edge (replaces the ugly torus)
  const bandGeo = new THREE.CylinderGeometry(6.95, 6.95, 0.18, 40, 1, true)
  const band = new THREE.Mesh(
    bandGeo,
    new THREE.MeshBasicMaterial({
      color: 0x44ffcc,
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
function addUfoGlow(anchor, disposables) {
  // Soft radial glow sprite — full-centre, smooth edge, no ring artifact
  const tex = buildSoftGlowTexture([0, 210, 160])
  disposables.push(tex)
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
  const light = new THREE.PointLight(0x44ffcc, 500, 0, 2)
  anchor.add(light)
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSolarSystem(sceneRef) {
  const systemRef = useRef(null)
  const timeRef = useRef(0)
  const bodyMapRef = useRef(new Map())
  const collisionBodiesRef = useRef([])
  const ufosRef = useRef([])
  const sunGlowRef = useRef(null)

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return undefined

    const disposables = []

    const textureLoader = new THREE.TextureLoader()
    const textures = Object.fromEntries(
      Object.entries(textureUrls).map(([key, url]) => {
        const texture = textureLoader.load(url)
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
        sunGlowRef.current = buildSunGlowEffect(def.radius, anchor, disposables)
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
      addUfoGlow(ufoAnchor, disposables)

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

    timeRef.current += deltaSeconds * spaceConfig.solarSystem.timeScale
    const time = timeRef.current
    const collisions = []

    bodyMap.forEach((body) => {
      const { def, anchor, mesh } = body
      let x = spaceConfig.solarSystem.center.x
      let y = spaceConfig.solarSystem.center.y
      let z = spaceConfig.solarSystem.center.z

      if (def.parent) {
        const parent = bodyMap.get(def.parent)
        const theta = time * def.orbitSpeed + def.phase
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
        // θ is already computed above for child bodies; recompute for clarity.
        const lockTheta = time * def.orbitSpeed + def.phase
        mesh.rotation.y = Math.PI / 2 + lockTheta
      } else {
        mesh.rotation.y += def.rotationSpeed * deltaSeconds * 60
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
