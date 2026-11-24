// Real nebulae + black holes.
// Nebula: cloud of world-size soft sprites (pc), RTE chunk at nebula center. Shape per type:
//   emission → clumpy fbm blob (Hα shell, OIII core), snr → filament shell, planetary → ring/torus.
// Black hole: body (shadow radius) for collision/speed, optional accretion disk mesh (km, anchored).
// Shadow + bending drawn by lensPass.js.
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'
import { nebulae, blackHoles } from '../data/deepSpaceObjects'
import { GALAXY_CENTER_PC, PC_KM, raDecToScene, temperatureToRgb } from './galaxyFrame'
import { origin, trackAnchor, untrackAnchor } from './floatingOrigin'
import { createStarPoints, starUniforms } from './starMaterial'
import { setDeepBodies, setPoiGroup } from './solarSystemRuntime'

const cfg = spaceConfig.galaxy.deepSpace
const SCHWARZSCHILD_KM_PER_MSUN = 2.95325
export const SHADOW_FACTOR = 2.598 // shadow radius / Rs (3√3/2)

// ─── deterministic noise (JS) ────────────────────────────────────────────────

export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash3(x, y, z, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647) ^ Math.imul(seed, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function noise3(x, y, z, seed) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const s = (t) => t * t * (3 - 2 * t)
  const u = s(x - xi)
  const v = s(y - yi)
  const w = s(z - zi)
  const l = (a, b, t) => a + (b - a) * t
  const h = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz, seed)
  return l(
    l(l(h(0, 0, 0), h(1, 0, 0), u), l(h(0, 1, 0), h(1, 1, 0), u), v),
    l(l(h(0, 0, 1), h(1, 0, 1), u), l(h(0, 1, 1), h(1, 1, 1), u), v),
    w
  )
}

export function fbm3(x, y, z, seed) {
  return noise3(x, y, z, seed) * 0.5 + noise3(x * 2.1, y * 2.1, z * 2.1, seed + 1) * 0.3 + noise3(x * 4.3, y * 4.3, z * 4.3, seed + 2) * 0.2
}

function randInBall(rand) {
  for (;;) {
    const x = rand() * 2 - 1
    const y = rand() * 2 - 1
    const z = rand() * 2 - 1
    if (x * x + y * y + z * z <= 1) return [x, y, z]
  }
}

export function gauss(rand) {
  return Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand())
}

// Catppuccin-leaning emission palette (linear-ish).
const H_ALPHA = [1.0, 0.3, 0.42]
const OIII = [0.32, 0.86, 0.82]
const SII = [1.0, 0.55, 0.32]
const SYNCHRO = [0.5, 0.6, 1.0]
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

// Unit-space sprite list: [x,y,z, size, r,g,b, alpha] × n. Scaled by radius later.
function buildNebulaUnit(def, count) {
  const rand = mulberry32(def.seed * 7919)
  const out = []
  const push = (p, size, col, a) => out.push(p[0], p[1], p[2], size, col[0], col[1], col[2], a)
  const sd = def.seed

  if (def.type === 'emission') {
    let attempts = 0
    while (out.length / 8 < count && attempts < count * 40) {
      attempts += 1
      const p = randInBall(rand)
      const r = Math.hypot(...p)
      // Clumps + voids: threshold fbm, envelope falls off to rim.
      const n = fbm3(p[0] * 2.6 + 5, p[1] * 2.6, p[2] * 2.6, sd)
      let d = Math.min(1, Math.max(0, (n - 0.42) / 0.3)) * (1 - r * r)
      if (def.hollow) d *= Math.min(1, Math.max(0, (r - 0.2) / 0.3))
      if (rand() > d * d) continue
      const core = Math.max(0, 1 - r * 1.8) * fbm3(p[0] * 5, p[1] * 5, p[2] * 5, sd + 9)
      const col = mix3(mix3(H_ALPHA, SII, rand() * 0.35), OIII, Math.min(1, core * 1.6))
      push(p, 0.06 + rand() * 0.12, col, 0.35 + d * 0.9)
    }
  } else if (def.type === 'snr') {
    let attempts = 0
    while (out.length / 8 < count && attempts < count * 60) {
      attempts += 1
      const p = randInBall(rand)
      const len = Math.hypot(...p)
      const dir = p.map((c) => c / len)
      const ridge = Math.abs(fbm3(dir[0] * 3 + 2, dir[1] * 3, dir[2] * 3, sd) - 0.5)
      const filament = ridge < 0.03
      if (def.fill && !filament && rand() < 0.35) {
        // Synchrotron haze inside (Crab).
        const q = p.map((c) => c * 0.8)
        push(q, 0.1 + rand() * 0.12, SYNCHRO, 0.1)
        continue
      }
      if (!filament) continue
      const r = 0.88 + rand() * 0.12
      const shell = [dir[0] * r * 1.15, dir[1] * r, dir[2] * r * 0.9] // slightly ellipsoid
      push(shell, 0.02 + rand() * 0.04, mix3(H_ALPHA, SII, rand()), 0.8)
    }
  } else {
    // planetary: torus, axis = local +y. Outer red, inner teal, faint halo.
    for (let i = 0; i < count; i += 1) {
      const halo = rand() < 0.06
      const th = rand() * Math.PI * 2
      const rr = halo ? 1.2 + rand() * 0.6 : 0.75 + gauss(rand) * 0.12
      const h = gauss(rand) * (halo ? 0.5 : 0.22)
      const p = [Math.cos(th) * rr, h, Math.sin(th) * rr]
      const t = Math.min(1, Math.max(0, (rr - 0.55) / 0.45))
      const col = halo ? H_ALPHA : mix3(OIII, H_ALPHA, t)
      push(p, 0.08 + rand() * 0.1, col, halo ? 0.08 : 0.6)
    }
  }
  return out
}

// ─── nebula material ─────────────────────────────────────────────────────────

const NEBULA_VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute float size;
attribute vec4 tint;
uniform vec3 uCamHigh;
uniform vec3 uCamLow;
uniform float uFocalPx;
uniform float uPixelRatio;
uniform float uGain;
uniform float uMaxPx;
varying vec3 vColor;
const float PC_KM = ${PC_KM.toExponential(8)};
void main() {
  vec3 rel = (position - uCamHigh) - uCamLow;
  float d = max(length(rel), 1e-9);
  float px = size / d * uFocalPx;
  // Inside sprite → fade (overdraw + no giant blobs). Sub-px → keep 1 px, dim by area.
  float a = tint.a * smoothstep(size * 0.8, size * 2.5, d) * min(px * px, 1.0);
  if (a < 0.002) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  gl_PointSize = clamp(px, 1.0, uMaxPx) * uPixelRatio;
  vColor = tint.rgb * a * uGain;
  vec3 v = mat3(viewMatrix) * (rel * PC_KM);
  gl_Position = projectionMatrix * vec4(v, 1.0);
  #include <logdepthbuf_vertex>
}
`

const NEBULA_FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
varying vec3 vColor;
void main() {
  #include <logdepthbuf_fragment>
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  gl_FragColor = vec4(vColor * exp(-r2 * 3.0) * (1.0 - r2), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

const _rel = new THREE.Vector3()

/**
 * Glowing world-size sprite cloud (RTE). positions: pc local to chunk (scene pc, float64 {x,y,z}),
 * sizes: pc, tints: rgba (a = weight). Shared by nebulae + neighbor galaxies.
 */
export function createSpriteCloud(positions, sizes, tints, chunk, gain) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
  geometry.setAttribute('tint', new THREE.BufferAttribute(tints, 4))
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uCamHigh: { value: new THREE.Vector3() },
      uCamLow: { value: new THREE.Vector3() },
      uFocalPx: starUniforms.uFocalPx,
      uPixelRatio: starUniforms.uPixelRatio,
      uGain: { value: gain },
      uMaxPx: { value: cfg.nebulaMaxPx },
    },
    vertexShader: NEBULA_VERT,
    fragmentShader: NEBULA_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  points.matrixAutoUpdate = false
  rteHook(points, chunk, material.uniforms)
  return points
}

function rteHook(points, chunk, uniforms) {
  points.onBeforeRender = () => {
    _rel.set(origin.x / PC_KM - chunk.x, origin.y / PC_KM - chunk.y, origin.z / PC_KM - chunk.z)
    const hi = uniforms.uCamHigh.value
    hi.set(Math.fround(_rel.x), Math.fround(_rel.y), Math.fround(_rel.z))
    uniforms.uCamLow.value.set(_rel.x - hi.x, _rel.y - hi.y, _rel.z - hi.z)
  }
}

function buildNebula(def, isMobile) {
  const center = raDecToScene(def.ra, def.dec, def.dist)
  const chunk = { x: center[0], y: center[1], z: center[2] }
  const base = def.type === 'snr' ? cfg.nebulaSprites * 1.4 : cfg.nebulaSprites
  const count = Math.round(base * (def.scale ?? 1) * (isMobile ? cfg.mobileFactor : 1))
  const unit = buildNebulaUnit(def, count)
  const n = unit.length / 8
  let overlap = 0
  for (let i = 0; i < n; i += 1) overlap += unit[i * 8 + 3] ** 2 * unit[i * 8 + 7]

  // Planetary axis → toward Sun (we see Ring/Helix ~face-on). Others: seeded tilt.
  const q = new THREE.Quaternion()
  if (def.type === 'planetary') {
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-center[0], -center[1], -center[2]).normalize())
  } else {
    q.setFromEuler(new THREE.Euler(def.seed * 0.7, def.seed * 1.3, def.seed * 0.4))
  }
  const v = new THREE.Vector3()
  const positions = new Float32Array(n * 3)
  const sizes = new Float32Array(n)
  const tints = new Float32Array(n * 4)
  for (let i = 0; i < n; i += 1) {
    v.set(unit[i * 8], unit[i * 8 + 1], unit[i * 8 + 2]).applyQuaternion(q).multiplyScalar(def.radius)
    positions.set([v.x, v.y, v.z], i * 3)
    sizes[i] = unit[i * 8 + 3] * def.radius
    tints.set([unit[i * 8 + 4], unit[i * 8 + 5], unit[i * 8 + 6], unit[i * 8 + 7]], i * 4)
  }
  const points = createSpriteCloud(positions, sizes, tints, chunk, cfg.nebulaGain / Math.max(overlap, 1))

  // Embedded stars: hot young cluster (emission) or central remnant.
  const rand = mulberry32(def.seed)
  const stars = []
  if (def.type === 'emission') {
    for (let i = 0; i < (def.clusterStars ?? 0); i += 1) {
      const p = randInBall(rand).map((c) => c * def.radius * 0.35)
      stars.push({ p, M: -4 + rand() * 3.5, T: 22000 + rand() * 18000 })
    }
  } else {
    stars.push({ p: [0, 0, 0], M: def.type === 'planetary' ? 6 : 4, T: def.type === 'planetary' ? 60000 : 20000 })
  }
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(stars.flatMap((s) => s.p), 3))
  starGeo.setAttribute('absMag', new THREE.Float32BufferAttribute(stars.map((s) => s.M), 1))
  starGeo.setAttribute('temp', new THREE.Float32BufferAttribute(stars.map((s) => s.T), 1))
  starGeo.setAttribute(
    'color',
    new THREE.Uint8BufferAttribute(stars.flatMap((s) => temperatureToRgb(s.T).map((c) => Math.round(c * 255))), 3, true)
  )
  const starPoints = createStarPoints(starGeo, chunk)

  const poi = {
    key: `neb_${def.key}`,
    kind: 'nebula',
    name: def.name,
    position: new THREE.Vector3(center[0] * PC_KM, center[1] * PC_KM, center[2] * PC_KM),
    radius: def.radius * PC_KM,
    labelRange: Infinity,
    factsRange: def.radius * 6 * PC_KM,
    // Name while it reads as an object (not too far, not when inside).
    labelVisibility: (distKm) => {
      const k = distKm / (def.radius * PC_KM)
      return (1 - THREE.MathUtils.smoothstep(k, 150, 260)) * THREE.MathUtils.smoothstep(k, 1.2, 2.5)
    },
    facts: def.facts,
  }
  return { points, starPoints, poi }
}

// ─── black holes ─────────────────────────────────────────────────────────────

const DISK_VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vLocal;
varying vec3 vPosL;
void main() {
  vLocal = position.xy;
  vPosL = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`

// Local units: Rs. Disk in xy plane, spins CCW about +z.
const DISK_FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uTime;
uniform vec3 uCamLocal;
uniform float uInner;
uniform float uOuter;
uniform float uGain;
varying vec2 vLocal;
varying vec3 vPosL;

float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y);
}

void main() {
  #include <logdepthbuf_fragment>
  float r = length(vLocal);
  float phi = atan(vLocal.y, vLocal.x);
  // Keplerian shear: ω ∝ r^-1.5 → spiral streaks.
  float omega = pow(uInner / r, 1.5);
  float a = phi + uTime * omega;
  float streak = noise2(vec2(log(r) * 9.0, a * 4.0 / 6.2831853 * 6.0)) * 0.6
               + noise2(vec2(log(r) * 23.0, a * 11.0)) * 0.4;
  // Temperature ∝ r^-3/4 → hot white-blue inside, peach outside.
  float tNorm = pow(uInner / r, 0.75);
  vec3 col = mix(vec3(0.98, 0.55, 0.32), vec3(0.85, 0.9, 1.0), smoothstep(0.35, 0.95, tNorm));
  // Doppler beaming: approaching side brighter.
  vec3 vel = normalize(vec3(-vLocal.y, vLocal.x, 0.0)) * 0.55 * sqrt(uInner / r);
  vec3 toCam = normalize(uCamLocal - vPosL);
  float D = 1.0 / max(1.0 - dot(vel, toCam), 0.2);
  float edge = smoothstep(uInner, uInner * 1.15, r) * (1.0 - smoothstep(uOuter * 0.6, uOuter, r));
  float lum = tNorm * tNorm * (0.45 + streak) * edge * D * D * D;
  gl_FragColor = vec4(col * lum * uGain, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

function buildBlackHole(def) {
  const rsKm = SCHWARZSCHILD_KM_PER_MSUN * def.mass
  const centerPc = def.galacticCenter ? GALAXY_CENTER_PC : raDecToScene(def.ra, def.dec, def.dist)
  const world = new THREE.Vector3(...centerPc).multiplyScalar(PC_KM)

  const anchor = new THREE.Group()
  let disk = null
  if (def.disk) {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCamLocal: { value: new THREE.Vector3() },
        uInner: { value: 3 },
        uOuter: { value: cfg.diskOuterRs },
        uGain: { value: cfg.diskGain },
      },
      vertexShader: DISK_VERT,
      fragmentShader: DISK_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })
    disk = new THREE.Mesh(new THREE.RingGeometry(3, cfg.diskOuterRs, 192, 12), material)
    disk.scale.setScalar(rsKm)
    disk.rotation.set(def.tilt[0], 0, def.tilt[1])
    anchor.add(disk)
  }

  // Far beacon: disk glow as a warm point (dormant BHs: none).
  let beacon = null
  if (def.disk) {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3))
    geo.setAttribute('absMag', new THREE.Float32BufferAttribute([def.galacticCenter ? -2 : 1], 1))
    geo.setAttribute('temp', new THREE.Float32BufferAttribute([9000], 1))
    geo.setAttribute('color', new THREE.Uint8BufferAttribute([255, 214, 170], 3, true))
    beacon = createStarPoints(geo, { x: centerPc[0], y: centerPc[1], z: centerPc[2] })
  }

  // Portal: no collision, crossing horizon (Rs) → wormhole. Others: solid at shadow.
  const body = def.portal
    ? { key: `bh_${def.key}`, kind: 'body', portal: true, position: world, radius: rsKm, rsKm }
    : { key: `bh_${def.key}`, kind: 'body', position: world, radius: rsKm * SHADOW_FACTOR * 1.2 }
  const poi = {
    key: `bh_${def.key}`,
    kind: 'blackhole',
    name: def.name,
    position: world,
    radius: rsKm * SHADOW_FACTOR,
    labelRange: def.galacticCenter ? Infinity : 3000 * PC_KM,
    factsRange: rsKm * 400,
    facts: [...def.facts, `Hendelseshorisont: ${Math.round(rsKm).toLocaleString('nb-NO')} km`],
  }
  return { def, rsKm, world, anchor, disk, beacon, body, poi }
}

// ─── public ──────────────────────────────────────────────────────────────────

const _inv = new THREE.Matrix4()

export function createDeepSpace(scene, isMobile) {
  const neb = nebulae.map((def) => buildNebula(def, isMobile))
  neb.forEach(({ points, starPoints }) => scene.add(points, starPoints))

  const holes = blackHoles.map(buildBlackHole)
  holes.forEach((bh) => {
    trackAnchor(bh.anchor, bh.world)
    scene.add(bh.anchor)
    if (bh.beacon) scene.add(bh.beacon)
  })

  setPoiGroup('deepSpace', [...neb.map((n) => n.poi), ...holes.map((h) => h.poi)])
  setDeepBodies(holes.map((h) => h.body))

  let time = 0
  const update = (deltaSeconds) => {
    time += deltaSeconds * cfg.diskSpin
    holes.forEach((bh) => {
      if (!bh.disk) return
      const u = bh.disk.material.uniforms
      u.uTime.value = time
      // Camera (render 0) in disk-local coords.
      bh.anchor.updateMatrixWorld()
      _inv.copy(bh.disk.matrixWorld).invert()
      u.uCamLocal.value.set(0, 0, 0).applyMatrix4(_inv)
    })
  }

  const dispose = () => {
    neb.forEach(({ points, starPoints }) => {
      scene.remove(points, starPoints)
      ;[points, starPoints].forEach((p) => {
        p.geometry.dispose()
        p.material.dispose()
      })
    })
    holes.forEach((bh) => {
      untrackAnchor(bh.anchor)
      scene.remove(bh.anchor)
      if (bh.disk) {
        bh.disk.geometry.dispose()
        bh.disk.material.dispose()
      }
      if (bh.beacon) {
        scene.remove(bh.beacon)
        bh.beacon.geometry.dispose()
        bh.beacon.material.dispose()
      }
    })
    setPoiGroup('deepSpace', [])
    setDeepBodies([])
  }

  return { update, dispose, blackHoles: holes }
}
