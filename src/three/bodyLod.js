// Body LOD by projected radius (px): dot → impostor → mesh (+ mesh geometry levels).
// Impostor + mesh share shadeBody() → swap pixel-identical, hysteresis only.
// Dot ↔ impostor crossfade over a few px. Dot dims with phase (crescent = darker).
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'

const lodCfg = spaceConfig.solarSystem.lod

// Same objects in every body material → one place to retune lights.
const sharedLight = {
  uSunLight: { value: new THREE.Color(spaceConfig.lights.sun.color).multiplyScalar(spaceConfig.lights.sun.intensity) },
  uAmbientLight: { value: new THREE.Color(spaceConfig.lights.ambient.color).multiplyScalar(spaceConfig.lights.ambient.intensity) },
}

// ─── GLSL ────────────────────────────────────────────────────────────────────

// Lambert, matches old MeshStandard (rough 1, metal 0) diffuse term. World space.
const SHADE_GLSL = /* glsl */ `
uniform sampler2D map;
uniform vec3 uSunDir;
uniform vec3 uSunLight;
uniform vec3 uAmbientLight;
uniform float uEmissive;
uniform vec3 uTint;
uniform float uTintMix;
uniform sampler2D uNightMap;
uniform float uNightGain;

// City lights on the dark side. localDir: body-local (equirect lookup, same convention as map).
vec3 nightLights(vec3 localDir, vec3 nW) {
  if (uNightGain <= 0.0) return vec3(0.0);
  vec3 d = normalize(localDir);
  float u = atan(-d.z, d.x) / PI2 + 0.5;
  vec2 uv = vec2(u, asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5);
  vec2 uvAlt = vec2(fract(u + 0.5) - 0.5, uv.y);
  vec2 g = fwidth(uv.x) <= fwidth(uvAlt.x) ? uv : uvAlt; // seam-safe grads
  vec3 lights = textureGrad(uNightMap, uv, dFdx(g), dFdy(g)).rgb;
  float dark = 1.0 - smoothstep(-0.12, 0.06, dot(nW, uSunDir));
  // Map is ~20 km/texel: magnified past ~3 px/texel it's a blob, not lights → fade out up close.
  float texelsPerPx = max(fwidth(g.x), fwidth(g.y)) * float(textureSize(uNightMap, 0).x);
  float far = smoothstep(0.15, 0.5, texelsPerPx);
  return lights * lights * vec3(1.0, 0.82, 0.55) * uNightGain * dark * far;
}

vec3 shadeBody(vec3 albedo, vec3 nW) {
  if (uEmissive > 0.5) return mix(albedo, vec3(dot(albedo, vec3(0.3, 0.59, 0.11))) * uTint * 1.6, uTintMix);
  float ndl = max(dot(nW, uSunDir), 0.0);
  return albedo * (uSunLight * ndl + uAmbientLight) * RECIPROCAL_PI;
}
`

const MESH_VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vLocalPos;
uniform vec3 uTileCenter; // terrain tiles: tile-local → body-local. Sphere mesh: 0.
void main() {
  vUv = uv;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vLocalPos = position + uTileCenter;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`

const MESH_FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
${SHADE_GLSL}
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vLocalPos;
uniform sampler2D uNormalMap;   // terrain: body-local normals, rgb = n·0.5+0.5
uniform float uUseNormalMap;
uniform mat3 uNormalRot;        // body-local → world rotation
void main() {
  #include <logdepthbuf_fragment>
  vec3 albedo = texture2D(map, vUv).rgb;
  vec3 n = uUseNormalMap > 0.5
    ? normalize(uNormalRot * (texture2D(uNormalMap, vUv).xyz * 2.0 - 1.0))
    : normalize(vNormalW);
  gl_FragColor = vec4(shadeBody(albedo, n) + nightLights(vLocalPos, n), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

// Billboard ⟂ view ray to center. Ortho sphere math inside tier (≤ ~24 px → error ~rn²):
// avoids float32 cancellation of ray-sphere at 1e9 km.
const IMPOSTOR_VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform float uRadius;
varying vec2 vQuad;
varying vec3 vRight;
varying vec3 vUp;
varying vec3 vFwd;
varying vec3 vCenter;
void main() {
  vec3 c = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 f = normalize(c);
  vec3 r = normalize(cross(f, abs(f.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)));
  vec3 u = cross(r, f);
  vQuad = position.xy * 1.1; // margin for AA edge
  vRight = r;
  vUp = u;
  vFwd = f;
  vCenter = c;
  gl_Position = projectionMatrix * vec4(c + (r * vQuad.x + u * vQuad.y) * uRadius, 1.0);
  #include <logdepthbuf_vertex>
}
`

const IMPOSTOR_FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
${SHADE_GLSL}
uniform mat3 uBodyRot;
uniform float uRadius;
uniform float uFade;
varying vec2 vQuad;
varying vec3 vRight;
varying vec3 vUp;
varying vec3 vFwd;
varying vec3 vCenter;
void main() {
  float len = length(vQuad);
  float aa = fwidth(len);
  float cov = 1.0 - smoothstep(1.0 - aa, 1.0, len);
  if (cov <= 0.0) discard;

  vec2 q = vQuad / max(len, 1.0); // edge px → clamp onto rim
  float z = sqrt(max(1.0 - dot(q, q), 0.0));
  vec3 nV = normalize(vRight * q.x + vUp * q.y - vFwd * z);
  vec3 nW = (vec4(nV, 0.0) * viewMatrix).xyz; // inverse view rot
  vec3 nL = nW * uBodyRot;                    // inverse body rot

  // SphereGeometry UV convention: x = -cos(phi) sin(theta), z = sin(phi) sin(theta).
  float phi = atan(nL.z, -nL.x);
  if (phi < 0.0) phi += PI2;
  vec2 uv = vec2(phi / PI2, 1.0 - acos(clamp(nL.y, -1.0, 1.0)) / PI);
  // Seam: grads from whichever u param is continuous here (Tarini).
  vec2 uvAlt = vec2(fract(uv.x + 0.5) - 0.5, uv.y);
  vec2 g = fwidth(uv.x) <= fwidth(uvAlt.x) ? uv : uvAlt;
  vec3 albedo = textureGrad(map, uv, dFdx(g), dFdy(g)).rgb;

  gl_FragColor = vec4(shadeBody(albedo, nW) + nightLights(nL, nW), cov * uFade);

  #ifdef USE_LOGDEPTHBUF
    // Depth of hit point, not quad → correct sort vs rings/moons.
    float w = -(vCenter.z + nV.z * uRadius);
    gl_FragDepth = log2(1.0 + w) * logDepthBufFC * 0.5;
  #endif

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

/**
 * Lit surface material w/ same shading as body mesh/impostor (terrain tiles use it).
 * sunDir: shared { value: Vector3 } from the owning body → identical lighting.
 */
export function createSurfaceMaterial(map, sunDir, options = {}) {
  const { nightMap, nightGain, normalRot, ...materialOptions } = options
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: map },
      uSunDir: sunDir,
      uEmissive: { value: 0 },
      uTint: { value: new THREE.Color(1, 1, 1) },
      uTintMix: { value: 0 },
      uNightMap: nightMap ?? { value: null },
      uNightGain: nightGain ?? { value: 0 },
      uTileCenter: { value: new THREE.Vector3() },
      uNormalMap: { value: null },
      uUseNormalMap: { value: 0 },
      uNormalRot: normalRot ?? { value: new THREE.Matrix3() },
      ...sharedLight,
    },
    vertexShader: MESH_VERT,
    fragmentShader: MESH_FRAG,
    ...materialOptions,
  })
}

// ─── Shared GPU resources (module cache, reused across remounts) ─────────────

const sphereCache = new Map()
function getSphere(level) {
  if (!sphereCache.has(level)) {
    const [w, h] = lodCfg.meshLevels[level].segments
    sphereCache.set(level, new THREE.SphereGeometry(1, w, h))
  }
  return sphereCache.get(level)
}

let quadGeometry = null
function getQuad() {
  quadGeometry ??= new THREE.PlaneGeometry(2, 2)
  return quadGeometry
}

let dotTexture = null
function getDotTexture() {
  if (dotTexture) return dotTexture
  const S = 32
  const canvas = document.createElement('canvas')
  canvas.width = S
  canvas.height = S
  const ctx = canvas.getContext('2d')
  const grd = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  grd.addColorStop(0.0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.45, 'rgba(255,255,255,0.9)')
  grd.addColorStop(1.0, 'rgba(255,255,255,0)')
  ctx.fillStyle = grd
  ctx.fillRect(0, 0, S, S)
  dotTexture = new THREE.CanvasTexture(canvas)
  return dotTexture
}

// ─── Builders ────────────────────────────────────────────────────────────────

function buildDot(def) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3))
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: def.beaconPx,
      sizeAttenuation: false,
      color: def.beaconColor,
      map: getDotTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  )
  points.frustumCulled = false
  return points
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

const _toCam = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _m4 = new THREE.Matrix4()

/**
 * Builds mesh (in tiltGroup), impostor + dot (in anchor) for one body.
 * Returns { mesh, update(world, origin, focalPx) }. Caller owns mesh.rotation.
 */
export function createBodyLod(def, map, anchor, tiltGroup, ring = null) {
  const emissive = { value: def.emissive ? 1 : 0 }
  const tint = { value: new THREE.Color(...(def.tint ?? [1, 1, 1])) }
  const tintMix = { value: def.tint ? 1 : 0 }
  const nightMap = { value: def.nightMap ?? null }
  const nightGain = { value: def.nightMap ? (def.nightGain ?? 1) : 0 }
  const sunDir = { value: new THREE.Vector3(1, 0, 0) }
  const mapUniform = { value: map }

  const mesh = new THREE.Mesh(
    getSphere(0),
    new THREE.ShaderMaterial({
      uniforms: {
        map: mapUniform,
        uSunDir: sunDir,
        uEmissive: emissive,
        uTint: tint,
        uTintMix: tintMix,
        uNightMap: nightMap,
        uNightGain: nightGain,
        uTileCenter: { value: new THREE.Vector3() },
        uNormalMap: { value: null },
        uUseNormalMap: { value: 0 },
        uNormalRot: { value: new THREE.Matrix3() },
        ...sharedLight,
      },
      vertexShader: MESH_VERT,
      fragmentShader: MESH_FRAG,
    })
  )
  mesh.scale.setScalar(def.radius)
  tiltGroup.add(mesh)

  const bodyRot = { value: new THREE.Matrix3() }
  const fade = { value: 0 }
  const impostor = new THREE.Mesh(
    getQuad(),
    new THREE.ShaderMaterial({
      uniforms: {
        map: mapUniform,
        uSunDir: sunDir,
        uEmissive: emissive,
        uTint: tint,
        uTintMix: tintMix,
        uNightMap: nightMap,
        uNightGain: nightGain,
        uBodyRot: bodyRot,
        uRadius: { value: def.radius },
        uFade: fade,
        ...sharedLight,
      },
      vertexShader: IMPOSTOR_VERT,
      fragmentShader: IMPOSTOR_FRAG,
      transparent: true,
      depthWrite: true,
    })
  )
  impostor.frustumCulled = false // quad geometry ≠ real extent
  anchor.add(impostor)

  const dot = def.beaconPx > 0 ? buildDot(def) : null
  if (dot) anchor.add(dot)

  const levels = lodCfg.meshLevels
  let meshTier = false
  let level = 0

  const update = (world, origin, focalPx) => {
    _toCam.subVectors(origin, world)
    const dist = _toCam.length()
    const radiusPx = dist > def.radius ? (def.radius / dist) * focalPx : Infinity

    if (!def.emissive) sunDir.value.copy(world).negate().normalize() // sun at world 0
    _q.multiplyQuaternions(tiltGroup.quaternion, mesh.quaternion)
    bodyRot.value.setFromMatrix4(_m4.makeRotationFromQuaternion(_q))

    // Impostor ↔ mesh, hysteresis.
    meshTier = meshTier ? radiusPx >= lodCfg.meshOut : radiusPx >= lodCfg.meshIn
    mesh.visible = meshTier

    // Mesh detail level, hysteresis.
    if (meshTier) {
      const h = lodCfg.levelHysteresis
      while (level < levels.length - 1 && radiusPx > levels[level].maxPx * (1 + h)) level += 1
      while (level > 0 && radiusPx < levels[level - 1].maxPx * (1 - h)) level -= 1
      const geometry = getSphere(level)
      if (mesh.geometry !== geometry) mesh.geometry = geometry
    }

    // Dot ↔ impostor crossfade.
    const t = smoothstep(lodCfg.dotFade[0], lodCfg.dotFade[1], radiusPx)
    fade.value = t
    impostor.visible = !meshTier && t > 0.001

    if (dot) {
      const phaseCos = def.emissive ? 1 : -_toCam.dot(world) / Math.max(dist * world.length(), 1e-9)
      const lit = def.emissive ? 1 : THREE.MathUtils.lerp(lodCfg.dotNightFloor, 1, (1 + phaseCos) / 2)
      const far = 1 - smoothstep(lodCfg.dotFadeFar[0], lodCfg.dotFadeFar[1], dist)
      const dotAlpha = (1 - t) * lit * far
      dot.visible = dotAlpha > 0.01 && dist > def.radius
      dot.material.opacity = dotAlpha
      // Just in front of surface → own sphere never hides it.
      if (dist > 0) dot.position.copy(_toCam).multiplyScalar((def.radius * 1.05) / dist)
    }

    if (ring) ring.visible = radiusPx > lodCfg.dotFade[0]
  }

  const dispose = () => {
    mesh.material.dispose()
    impostor.material.dispose()
    if (dot) {
      dot.geometry.dispose()
      dot.material.dispose()
    }
  }

  return { mesh, update, dispose, sunDir, nightMap, nightGain }
}
