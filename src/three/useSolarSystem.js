// Solar system at true scale. World = km, sun at 0. Positions: real ephemeris.
// Anchors tracked by floating origin. Sub-pixel bodies → beacon dot (fixed px).
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { spaceConfig, AU_KM } from './spaceConfig'
import { setPoiGroup, setSolarCollisionBodies } from './solarSystemRuntime'
import { surfacePlaces } from '../data/surfacePlaces'
import { sceneLoadingManager } from './sceneLoadingManager'
import { loadPlanetTextures, planetMapImage } from './planetTextures'
import { getRenderScale } from './frameGovernor'
import { origin, trackAnchor, untrackAnchor } from './floatingOrigin'
import { createBodyLod } from './bodyLod'
import { createEarthTerrain, getEarthHeightAt as earthHeightAt } from './earthTerrain'
import { createSatellites } from './satellites'
import { createMultiplayer } from './multiplayer'
import { createComets } from './comets'
import { getHomeProgress } from './scrollChapters'
import { gstime } from 'satellite.js'
import {
  daysSinceJ2000,
  dateMsFromDaysSinceJ2000,
  heliocentricPositionAU,
  hasEphemeris,
  ROTATION_PERIOD_DAYS,
  MOON_SIDEREAL_ORBIT_DAYS,
} from './ephemeris'
import { getSpeedMultiplier, setSimulatedDateMs } from './ephemerisTime'

import sunTexUrl from '../assets/Models/solar/sun/sol/sun.webp'
import mercuryTexUrl from '../assets/Models/solar/mercury/mercury.webp'
import venusTexUrl from '../assets/Models/solar/venus/venus.webp'
import earthTexUrl from '../assets/Models/Earth 3D Model/textures/earth.webp'
import earthLightsTexUrl from '../assets/Models/Earth 3D Model/textures/earth_lights_2048.png' // NASA, public domain
import moonTexUrl from '../assets/Models/solar/moon/moon.webp'
import marsTexUrl from '../assets/Models/solar/mars/mars.webp'
import jupiterTexUrl from '../assets/Models/solar/jupiter/jupiter.webp'
import saturnTexUrl from '../assets/Models/solar/saturn/saturno/saturn.webp'
import saturnRingTexUrl from '../assets/Models/solar/saturn/saturno/ring.webp'
import uranusTexUrl from '../assets/Models/solar/uranus/uranus.webp'
import uranusRingTexUrl from '../assets/Models/solar/uranus/uranus_rings.webp'
import neptuneTexUrl from '../assets/Models/solar/neptune/neptune.webp'
import plutoTexUrl from '../assets/Models/solar/pluto/pluto.webp'

// webp/png = fallback only (KTX2 bakes in src/assets/ktx2).
const textureUrls = {
  sun: sunTexUrl,
  mercury: mercuryTexUrl,
  venus: venusTexUrl,
  earth: earthTexUrl,
  earthLights: earthLightsTexUrl,
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

// ─── Sun corona ──────────────────────────────────────────────────────────────
// Camera-facing billboard at the Sun (behind-disc part depth-hidden by the photosphere).
// K-corona falloff ~ r^-3.5 plus faint radial streamers + thin chromosphere rim. Faint by design:
// real corona is ~1e-6 of the disc; glare comes from bloom on the HDR photosphere, not sprites.
const CORONA_EXTENT = 7 // × radius (half-size of quad)

const CORONA_VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform float uRadius;
varying vec2 vQuad;
void main() {
  vec3 c = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 f = normalize(c);
  vec3 r = normalize(cross(f, abs(f.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)));
  vec3 u = cross(r, f);
  vQuad = position.xy * ${CORONA_EXTENT.toFixed(1)};
  gl_Position = projectionMatrix * vec4(c + (r * vQuad.x + u * vQuad.y) * uRadius, 1.0);
  #include <logdepthbuf_vertex>
}
`

const CORONA_FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uTime;
uniform float uGain;
varying vec2 vQuad;
float hash1(float n) { return fract(sin(n) * 43758.5453); }
// Periodic (period n cells) → no seam where atan wraps.
float noise1(float x, float n) {
  float i = floor(x);
  float f = fract(x);
  return mix(hash1(mod(i, n)), hash1(mod(i + 1.0, n)), f * f * (3.0 - 2.0 * f));
}
void main() {
  #include <logdepthbuf_fragment>
  float r = length(vQuad);
  if (r < 0.995) discard;
  float a = atan(vQuad.y, vQuad.x);
  // Streamers: angular noise (periodic: wrap via 48 cells), slow drift; stronger toward equator (y≈0).
  float cells = 48.0;
  float x = a / PI2 + 0.5;
  float s = noise1(x * cells + uTime * 0.003, cells) * 0.55 + noise1(x * cells * 3.0 - uTime * 0.002, cells * 3.0) * 0.45;
  float eq = 0.55 + 0.45 * abs(cos(a));
  float streak = mix(0.7, 1.3, s * eq);
  float k = pow(r, -3.5) * streak;
  float edge = 1.0 - smoothstep(${(CORONA_EXTENT * 0.6).toFixed(1)}, ${CORONA_EXTENT.toFixed(1)}, r);
  vec3 col = vec3(1.0, 0.94, 0.86) * k * 0.35 * edge;
  // Chromosphere: thin H-alpha pink rim just above the limb.
  col += vec3(1.0, 0.32, 0.36) * exp(-pow((r - 1.004) / 0.006, 2.0)) * 0.6;
  gl_FragColor = vec4(col * uGain, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

function buildSunCorona(radius, anchor) {
  const material = new THREE.ShaderMaterial({
    uniforms: { uRadius: { value: radius }, uTime: { value: 0 }, uGain: { value: 1 } },
    vertexShader: CORONA_VERT,
    fragmentShader: CORONA_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  quad.frustumCulled = false
  anchor.add(quad)
  return { material }
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
function addUfoGlow(anchor, lightIntensity) {
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
  const light = new THREE.PointLight(0x94e2d5, lightIntensity, 0, 2)
  anchor.add(light)
}


// RingGeometry UVs are planar. Strip textures need u = radial fraction.
function remapRingUvRadial(geometry, inner, outer) {
  const pos = geometry.attributes.position
  const uv = geometry.attributes.uv
  for (let i = 0; i < pos.count; i += 1) {
    const r = Math.hypot(pos.getX(i), pos.getY(i))
    uv.setXY(i, (r - inner) / (outer - inner), 0.5)
  }
  uv.needsUpdate = true
}

// Ecliptic (x, y, z=north) → scene (x, z, -y). Proper rotation, no mirror:
// north = +y, orbits CCW seen from north, prograde spin = +rotation.y.
const smoothstepN = (x) => {
  const t = Math.min(1, Math.max(0, x))
  return t * t * (3 - 2 * t)
}

// Local solar hours of sunset / sunrise (sun at altDeg) for lat on date. Polar → fallbacks.
function sunEventHours({ lat, sunAltDeg, fallbackSet, fallbackRise }, date) {
  const doy = (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86400000
  const decl = -23.44 * Math.cos(((2 * Math.PI) / 365) * (doy + 10)) * (Math.PI / 180)
  const phi = lat * (Math.PI / 180)
  const cosH = (Math.sin(sunAltDeg * (Math.PI / 180)) - Math.sin(phi) * Math.sin(decl)) / (Math.cos(phi) * Math.cos(decl))
  if (cosH <= -1 || cosH >= 1) return { set: fallbackSet, rise: fallbackRise }
  const H = (Math.acos(cosH) * 180) / Math.PI / 15
  return { set: 12 + H, rise: 12 - H }
}

function eclipticToScene(au, out) {
  return out.set(au.x * AU_KM, au.z * AU_KM, -au.y * AU_KM)
}

const TWO_PI = Math.PI * 2
const _toCam = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _m = new THREE.Matrix4()
const _zero = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

// ─── Surface places ──────────────────────────────────────────────────────────
// Labels pinned to bodies, spin with them. Visibility: rank vs cam altitude, horizon, near-horizon range.

const _placeQ = new THREE.Quaternion()
const _placeN = new THREE.Vector3()
const _placeToCam = new THREE.Vector3()

function placeVisibility(place, body) {
  const R = body.def.radius
  return (distKm) => {
    const camAlt = origin.distanceTo(body.world) - R
    const ss = THREE.MathUtils.smoothstep
    let v
    if (place.rank === 1) v = ss(camAlt, R * 0.04, R * 0.08) * (1 - ss(camAlt, R * 3, R * 6))
    else if (place.rank === 2) v = 1 - ss(camAlt, R * 0.25, R * 0.45)
    else v = 1 - ss(camAlt, R * 0.02, R * 0.04)
    if (v <= 0) return 0
    // Behind the limb → hidden.
    _placeN.subVectors(place.position, body.world).normalize()
    _placeToCam.subVectors(origin, place.position)
    v *= ss(_placeN.dot(_placeToCam) / Math.max(distKm, 1e-6), -0.02, 0.06)
    // Low: only what's within ~horizon range (no clutter piled at the horizon).
    if (place.rank > 1) {
      const horizon = Math.sqrt(2 * R * Math.max(camAlt, 0.05)) + R * 0.02
      v *= 1 - ss(distKm, horizon, horizon * 1.6)
    }
    return v
  }
}

function buildPlaces(bodyMap) {
  const out = []
  Object.entries(surfacePlaces).forEach(([key, list]) => {
    const body = bodyMap.get(key)
    if (!body) return
    list.forEach((def, i) => {
      const lat = THREE.MathUtils.degToRad(def.lat)
      const lon = THREE.MathUtils.degToRad(def.lon + (body.def.textureLonOffset ?? 0))
      const place = {
        key: `place_${key}_${i}`,
        kind: 'place',
        placeKind: def.kind,
        rank: def.rank,
        bodyKey: key,
        name: def.name,
        facts: def.facts ?? [],
        radius: 0,
        labelRange: Infinity,
        factsRange: Math.max(body.def.radius * 0.01, 20),
        // Body-local dir (same convention as textures/terrain): lon 0 → +x, north → +y.
        local: new THREE.Vector3(Math.cos(lon) * Math.cos(lat), Math.sin(lat), -Math.sin(lon) * Math.cos(lat)).multiplyScalar(
          body.def.radius + (def.alt ?? 0) + 0.005
        ),
        alt: def.alt ?? 0,
        position: new THREE.Vector3(),
      }
      place.labelVisibility = placeVisibility(place, body)
      out.push(place)
    })
  })
  return out
}

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || navigator.maxTouchPoints > 2
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSolarSystem(sceneRef, isExplore = false, rendererRef = null) {
  const bodyMapRef = useRef(new Map())
  const ufosRef = useRef([])
  const terrainRef = useRef(null)
  const placesRef = useRef([])
  const satellitesRef = useRef(null)
  const multiplayerRef = useRef(null)
  const cometsRef = useRef(null)
  const earthSpinOffsetRef = useRef(0) // rad; scroll mode → Bergen at a fixed local hour (eased)
  const sunGlowRef = useRef(null)
  const timeRef = useRef(0)
  const isExploreRef = useRef(isExplore)
  const wasExploreRef = useRef(isExplore)
  // Positions: simDays. Spin: simDays + spinOffsetDays (scroll-mode speedup, no position jump).
  const simDaysRef = useRef(daysSinceJ2000())
  const spinOffsetDaysRef = useRef(0)
  isExploreRef.current = isExplore

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return undefined

    const cfg = spaceConfig.solarSystem
    // Textures arrive async (KTX2) → consumers wait via whenTexture(key, fn).
    const textures = {}
    const waiting = {}
    const whenTexture = (key, fn) => (textures[key] ? fn(textures[key]) : (waiting[key] ??= []).push(fn))
    const cancelTextures = loadPlanetTextures(rendererRef.current, sceneLoadingManager, textureUrls, (key, tex) => {
      tex.anisotropy = cfg.textureAnisotropy
      textures[key] = tex
      waiting[key]?.forEach((fn) => fn(tex))
      delete waiting[key]
    })

    const system = new THREE.Group()
    scene.add(system)

    const bodyMap = new Map()
    const collisions = []
    const anchors = []

    for (const def of cfg.bodies) {
      const world = new THREE.Vector3()
      const anchor = new THREE.Group()
      trackAnchor(anchor, world)
      anchors.push(anchor)

      const tiltGroup = new THREE.Group()
      tiltGroup.rotation.set(def.axialTiltX || 0, 0, def.axialTilt || 0)
      anchor.add(tiltGroup)

      let ring = null
      if (def.ringTexture) {
        const ringGeo = new THREE.RingGeometry(def.ringInner, def.ringOuter, 192)
        if (def.ringUv === 'radial') remapRingUvRadial(ringGeo, def.ringInner, def.ringOuter)
        ring = new THREE.Mesh(
          ringGeo,
          new THREE.MeshBasicMaterial({
            map: null,
            transparent: true,
            opacity: def.ringOpacity,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        )
        ring.rotation.x = Math.PI / 2
        const ringMat = ring.material
        whenTexture(def.ringTexture, (tex) => {
          ringMat.map = tex
          ringMat.needsUpdate = true
        })
        tiltGroup.add(ring)
      }

      if (def.emissive) {
        sunGlowRef.current = buildSunCorona(def.radius, anchor)
        const { color, intensity, decay } = spaceConfig.lights.sun
        anchor.add(new THREE.PointLight(color, intensity, 0, decay))
      }

      const lod = createBodyLod(def, null, anchor, tiltGroup, ring)
      whenTexture(def.texture, (tex) => (lod.map.value = tex))
      if (def.nightTexture) whenTexture(def.nightTexture, (tex) => (lod.nightMap.value = tex))

      system.add(anchor)
      const entry = {
        key: def.key,
        kind: 'body',
        position: world,
        radius: def.radius,
        labelRange: def.labelRange ?? (def.emissive ? Infinity : cfg.lod.planetLabelRange),
        axis: new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(def.axialTiltX || 0, 0, def.axialTilt || 0)), // north pole dir (tilt static)
        atmosphere: def.atmosphere ?? null,
        // Per-frame motion → camera co-moving frame (useScrollCamera carry).
        delta: new THREE.Vector3(),
        spinDelta: 0,
        // HUD minimap: body-fixed frame (tilt · spin), equirect texture (lon 0 = u 0.5), texture lon shift (deg).
        frameQ: new THREE.Quaternion(),
        mapImage: () => planetMapImage(def.texture),
        lonOffset: def.textureLonOffset ?? 0,
      }
      collisions.push(entry)
      bodyMap.set(def.key, { def, world, anchor, tiltGroup, mesh: lod.mesh, lod, entry, prev: new THREE.Vector3(), prevSpin: null })
    }

    bodyMapRef.current = bodyMap

    // UFOs: local offset from Earth, LEO-ish shell.
    const ufoCfg = cfg.ufo
    const earthRadius = bodyMap.get('earth').def.radius
    // Old tuning: 500 cd at anchor scale 0.45. Inverse-square → scale² keeps same look.
    const ufoLight = 500 * (ufoCfg.scale / 0.45) ** 2
    const ufos = []
    for (let i = 0; i < ufoCfg.count; i += 1) {
      const anchor = new THREE.Group()
      anchor.scale.setScalar(ufoCfg.scale)
      buildSaucer(anchor)
      addUfoGlow(anchor, ufoLight)
      system.add(anchor)

      const world = new THREE.Vector3()
      trackAnchor(anchor, world)
      anchors.push(anchor)

      const angle = (i / ufoCfg.count) * TWO_PI
      const r = earthRadius + (ufoCfg.shellInner + ufoCfg.shellOuter) / 2
      ufos.push({
        group: anchor,
        world,
        local: new THREE.Vector3(Math.cos(angle) * r, (i - (ufoCfg.count - 1) / 2) * 500, Math.sin(angle) * r),
        velocity: new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle)).multiplyScalar(ufoCfg.speed),
        steer: new THREE.Vector3(),
        phase: i * Math.E,
      })
      collisions.push({
        key: `ufo_${i}`,
        kind: 'ufo',
        position: world,
        radius: ufoCfg.collisionRadius,
        labelRange: ufoCfg.labelRange,
      })
    }
    ufosRef.current = ufos

    // Real Earth surface (explore, close range). Collision follows terrain.
    const terrain = createEarthTerrain(
      bodyMap.get('earth'),
      isMobileDevice(),
      rendererRef?.current?.capabilities.getMaxAnisotropy() ?? 8,
      () => (rendererRef?.current?.getPixelRatio() ?? 1) * getRenderScale() // scene target px
    )
    terrainRef.current = terrain
    const satellites = createSatellites(bodyMap.get('earth'), isMobileDevice())
    satellitesRef.current = satellites
    const multiplayer = createMultiplayer(scene)
    multiplayerRef.current = multiplayer
    const comets = createComets(scene)
    cometsRef.current = comets
    const earthEntry = collisions.find((c) => c.key === 'earth')
    earthEntry.heightAt = terrain.heightAt

    setSolarCollisionBodies(collisions)
    const places = buildPlaces(bodyMap)
    placesRef.current = places
    setPoiGroup('places', places)

    return () => {
      setSolarCollisionBodies([])
      anchors.forEach(untrackAnchor)
      system.traverse((obj) => {
        obj.geometry?.dispose?.()
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach((m) => m?.dispose?.())
      })
      scene.remove(system)
      cancelTextures()
      Object.values(textures).forEach((t) => t.dispose())
      terrain.dispose()
      terrainRef.current = null
      satellites.dispose()
      satellitesRef.current = null
      multiplayer.dispose()
      multiplayerRef.current = null
      comets.dispose()
      cometsRef.current = null
      setPoiGroup('places', [])
      placesRef.current = []
      bodyMapRef.current = new Map()
      ufosRef.current = []
      sunGlowRef.current = null
    }
  }, [sceneRef, rendererRef])

  const update = (deltaSeconds = 1 / 60, camera = null) => {
    const bodyMap = bodyMapRef.current
    if (!bodyMap.size) return

    const explore = isExploreRef.current
    // Leaving explore → snap back to real now (time may have been fast-forwarded).
    if (!explore && wasExploreRef.current) simDaysRef.current = daysSinceJ2000()
    wasExploreRef.current = explore

    timeRef.current += deltaSeconds
    const time = timeRef.current

    if (explore) {
      simDaysRef.current += (deltaSeconds * getSpeedMultiplier()) / 86400
    } else {
      simDaysRef.current += deltaSeconds / 86400
      spinOffsetDaysRef.current += (deltaSeconds * (spaceConfig.solarSystem.scrollSpinScale - 1)) / 86400
    }
    setSimulatedDateMs(dateMsFromDaysSinceJ2000(simDaysRef.current))
    const simDays = simDaysRef.current
    const spinDays = simDays + spinOffsetDaysRef.current

    // Bodies (config order: parents before children).
    bodyMap.forEach((body) => body.prev.copy(body.world))
    bodyMap.forEach(({ def, world, mesh }) => {
      if (def.parent) {
        const parent = bodyMap.get(def.parent).world
        const theta = ((simDays / MOON_SIDEREAL_ORBIT_DAYS) % 1) * TWO_PI
        const r = def.orbitRadius
        const inc = def.orbitInclination || 0
        world.set(
          parent.x + Math.cos(theta) * r,
          parent.y + Math.sin(theta) * r * Math.sin(inc),
          parent.z - Math.sin(theta) * r * Math.cos(inc)
        )
        // Local +x (texture lon 0 = near side) → faces parent.
        if (def.tidallyLocked) mesh.rotation.y = Math.PI + theta
      } else if (hasEphemeris(def.key)) {
        eclipticToScene(heliocentricPositionAU(def.key, simDays), world)
      } else {
        world.set(0, 0, 0)
      }

      if (def.realSpin) {
        // Greenwich (lon 0 = local +x) at RA = GMST. Same fn as satellite propagation → ground tracks match.
        // Scroll mode: + offset so the home stop (Bergen) sits at scroll.localHour (no black page at night). Explore: real.
        const date = new Date(dateMsFromDaysSinceJ2000(simDays))
        let target = 0
        if (!explore) {
          const ht = spaceConfig.camera.scroll.homeTime
          const { set, rise } = sunEventHours(ht, date)
          // Scroll scrubs sunset → night → next sunrise. Linger in dusk (first 35 %) and dawn (last 35 %),
          // rush through deep night in between (it's just dark).
          const hp = getHomeProgress()
          const riseNext = rise + 24
          const wantLocal =
            hp < 0.35
              ? set + (hp / 0.35) * 1.2
              : hp > 0.65
                ? riseNext - 1.2 + ((hp - 0.65) / 0.35) * 1.2
                : set + 1.2 + (riseNext - set - 2.4) * smoothstepN((hp - 0.35) / 0.3)
          const localNow = date.getUTCHours() + date.getUTCMinutes() / 60 + ht.lon / 15
          const dh = ((((wantLocal - localNow) % 24) + 36) % 24) - 12
          target = (dh / 24) * TWO_PI
          // Continuous across the ±12 h wrap (don't spin the long way round).
          const cur = earthSpinOffsetRef.current
          target = cur + Math.atan2(Math.sin(target - cur), Math.cos(target - cur))
        }
        earthSpinOffsetRef.current += (target - earthSpinOffsetRef.current) * (1 - Math.exp(-1.5 * deltaSeconds))
        mesh.rotation.y = gstime(date) + earthSpinOffsetRef.current
      } else if (!def.tidallyLocked && ROTATION_PERIOD_DAYS[def.key]) {
        mesh.rotation.y = def.rotationSign * ((spinDays / ROTATION_PERIOD_DAYS[def.key]) % 1) * TWO_PI
      }
    })

    cometsRef.current?.update(simDays)

    // Places follow their body's tilt + spin.
    placesRef.current.forEach((place) => {
      const body = bodyMap.get(place.bodyKey)
      _placeQ.multiplyQuaternions(body.tiltGroup.quaternion, body.mesh.quaternion)
      place.position.copy(place.local).applyQuaternion(_placeQ).add(body.world)
      // Earth tiles on: sit on real ground (sea-level defaults float/sink inland).
      if (place.bodyKey === 'earth' && earthHeightAt) {
        const h = earthHeightAt(place.position)
        if (h > 0) place.position.sub(body.world).setLength(body.def.radius + Math.max(h, place.alt) + 0.002).add(body.world)
      }
    })

    bodyMap.forEach((body) => body.entry.frameQ.multiplyQuaternions(body.tiltGroup.quaternion, body.mesh.quaternion))

    // Frame motion for co-moving camera. First frame: no delta.
    bodyMap.forEach((body) => {
      const first = body.prevSpin === null
      body.entry.delta.subVectors(body.world, body.prev)
      const spin = body.mesh.rotation.y
      body.entry.spinDelta = first ? 0 : Math.atan2(Math.sin(spin - body.prevSpin), Math.cos(spin - body.prevSpin))
      if (first) body.entry.delta.set(0, 0, 0)
      body.prevSpin = spin
    })

    // LOD tiers. Last frame's origin → 1-frame lag on tier/fade, invisible.
    if (camera) {
      const focalPx = window.innerHeight / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
      bodyMap.forEach(({ world, lod }) => lod.update(world, origin, focalPx))
      terrainRef.current?.update(focalPx, explore)
      satellitesRef.current?.update()
      multiplayerRef.current?.update(camera, focalPx, explore)
    }

    // Corona: slow streamer drift. Exposure follows photosphere adaptation (bright disc → corona swamped, as real).
    if (sunGlowRef.current) {
      const u = sunGlowRef.current.material.uniforms
      u.uTime.value = time
      u.uGain.value = (bodyMap.get('sun')?.lod.sunGain?.value ?? 1) * spaceConfig.solarSystem.lod.coronaGain
    }

    // UFOs: wander inside shell round Earth.
    const earth = bodyMap.get('earth')
    const ufoCfg = spaceConfig.solarSystem.ufo
    const inner = earth.def.radius + ufoCfg.shellInner
    const outer = earth.def.radius + ufoCfg.shellOuter
    ufosRef.current.forEach((ufo) => {
      const t = time * 0.074 + ufo.phase
      ufo.steer.set(
        Math.sin(t * 0.71) + Math.cos(t * 1.17) * 0.45,
        Math.sin(t * 0.43 + 1.2) * 0.32,
        Math.cos(t * 0.53 + 0.4) + Math.sin(t * 0.91) * 0.45
      ).normalize()

      const r = ufo.local.length()
      _dir.copy(ufo.local).divideScalar(Math.max(r, 1e-6))
      if (r > outer) ufo.steer.addScaledVector(_dir, -2.6)
      if (r < inner) ufo.steer.addScaledVector(_dir, 3)
      ufo.steer.normalize()

      ufo.velocity.lerp(_toCam.copy(ufo.steer).multiplyScalar(ufoCfg.speed), Math.min(1, ufoCfg.steering * deltaSeconds))
      ufo.local.addScaledVector(ufo.velocity, deltaSeconds)
      const clamped = THREE.MathUtils.clamp(ufo.local.length(), earth.def.radius + ufoCfg.shellInner * 0.5, outer * 1.2)
      ufo.local.setLength(clamped)

      ufo.world.addVectors(earth.world, ufo.local)
      if (ufo.velocity.lengthSq() > 1e-6) {
        _m.lookAt(ufo.velocity, _zero, _up)
        ufo.group.quaternion.setFromRotationMatrix(_m)
      }
      ufo.group.rotateZ(Math.sin(time * 6.5 + ufo.phase) * ufoCfg.wobble * 0.1)
    })
  }

  return { update }
}
