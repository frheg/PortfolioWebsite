// Planet atmosphere = post pass (needs scene depth → haze stops at mountains, not sea level).
// Single scattering, Rayleigh + Mie, sun shadowed by planet. out = scene·T(rgb) + inscatter.
// Math in planet-radius units relative to planet center (float32-safe near & far).
// Sun-ray optical depth from a lookup table (precomputed once per planet, CPU) → no inner march per sample.
import * as THREE from 'three'
import { FULLSCREEN_VERT } from './postFx'
import { origin } from './floatingOrigin'
import { spaceConfig } from './spaceConfig'

const LUT_W = 128 // cos sun zenith
const LUT_H = 64 // altitude
const LUT_STEPS = 64

const FRAG = /* glsl */ `
uniform sampler2D uSrc;
uniform sampler2D uDepth;
uniform vec3 uCenter;      // render space, km (cam at 0)
uniform float uR;          // km
uniform float uTop;        // atmosphere top / R
uniform vec3 uBetaR;       // 1/km
uniform float uBetaM;      // 1/km
uniform float uHr;         // km
uniform float uHm;         // km
uniform float uG;
uniform vec3 uSunDir;
uniform float uSunI;
uniform mat3 uViewBasis;   // dir = basis · (ndc, 1)
uniform vec2 uTan;
uniform float uLogFar;     // log2(far + 1)
uniform int uSteps;
uniform sampler2D uTransLut; // rg = Rayleigh / Mie optical depth (km) to top of atmosphere
varying vec2 vUv;

// LUT coords: x = cos(sun zenith) (sqrt-warped → fine near horizon), y = sqrt(altitude / top). Texel centers.
vec2 lutUv(float hKm, float mu) {
  float x = 0.5 + 0.5 * sign(mu) * sqrt(abs(mu));
  float y = sqrt(clamp(hKm / ((uTop - 1.0) * uR), 0.0, 1.0));
  return (vec2(x, y) * vec2(${LUT_W - 1}.0, ${LUT_H - 1}.0) + 0.5) / vec2(${LUT_W}.0, ${LUT_H}.0);
}

vec2 sphere(vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - r * r;
  float d = b * b - c;
  if (d < 0.0) return vec2(1e9, -1e9);
  float s = sqrt(d);
  return vec2(-b - s, -b + s);
}

void main() {
  vec3 src = texture2D(uSrc, vUv).rgb;
  vec2 ndc = vUv * 2.0 - 1.0;
  vec3 dirV = vec3(ndc * uTan, -1.0);
  vec3 rd = normalize(uViewBasis * vec3(ndc, 1.0));
  vec3 ro = -uCenter / uR;

  vec2 atm = sphere(ro, rd, uTop);
  if (atm.y <= 0.0) { gl_FragColor = vec4(src, 1.0); return; }
  float t0 = max(atm.x, 0.0);
  float t1 = atm.y;
  vec2 ground = sphere(ro, rd, 1.0);
  if (ground.x > 0.0) t1 = min(t1, ground.x);
  // Scene depth (log) → distance along ray.
  float d = texture2D(uDepth, vUv).r;
  if (d < 1.0) {
    float w = exp2(d * uLogFar) - 1.0;
    t1 = min(t1, w * length(dirV) / uR);
  }
  if (t1 <= t0) { gl_FragColor = vec4(src, 1.0); return; }

  float ds = (t1 - t0) / float(uSteps);
  float dsKm = ds * uR;
  vec3 sumR = vec3(0.0);
  vec3 sumM = vec3(0.0);
  float odR = 0.0;
  float odM = 0.0;
  for (int i = 0; i < 32; i++) {
    if (i >= uSteps) break;
    vec3 p = ro + rd * (t0 + (float(i) + 0.5) * ds);
    float h = (length(p) - 1.0) * uR;
    float dR = exp(-h / uHr) * dsKm;
    float dM = exp(-h / uHm) * dsKm;
    odR += dR;
    odM += dM;
    // Light ray to sun. Blocked by planet → no direct light.
    if (sphere(p, uSunDir, 1.0).x > 0.0) continue;
    vec2 l = texture2D(uTransLut, lutUv(max(h, 0.0), dot(p, uSunDir) / length(p))).rg;
    vec3 tau = uBetaR * (odR + l.x) + uBetaM * 1.1 * (odM + l.y);
    vec3 att = exp(-tau);
    sumR += att * dR;
    sumM += att * dM;
  }
  float mu = dot(rd, uSunDir);
  float phaseR = 0.0596831 * (1.0 + mu * mu);
  float g2 = uG * uG;
  float phaseM = 0.1193662 * ((1.0 - g2) * (1.0 + mu * mu)) / ((2.0 + g2) * pow(1.0 + g2 - 2.0 * uG * mu, 1.5));
  vec3 inscatter = uSunI * (sumR * uBetaR * phaseR + sumM * uBetaM * phaseM);
  vec3 T = exp(-(uBetaR * odR + uBetaM * 1.1 * odM));
  // Bright sky swamps faint background (stars, galaxy glow) → eye can't see them by day.
  if (d >= 1.0) T *= 1.0 - smoothstep(0.015, 0.12, dot(inscatter, vec3(0.2126, 0.7152, 0.0722)));
  gl_FragColor = vec4(src * T + inscatter, 1.0);
}
`

// Transmittance LUT: optical depth (Rayleigh, Mie; km) from altitude h toward cos-zenith mu, to atmosphere top.
// Exact march, once per planet (few ms). Half float RG → linear filtering everywhere (WebGL2 core).
function buildTransLut(R, atmo) {
  const top = R + atmo.height
  const data = new Uint16Array(LUT_W * LUT_H * 2)
  for (let j = 0; j < LUT_H; j += 1) {
    const y = j / (LUT_H - 1)
    const r = R + y * y * atmo.height
    for (let i = 0; i < LUT_W; i += 1) {
      const m = (i / (LUT_W - 1) - 0.5) * 2
      const mu = Math.sign(m) * m * m
      // Distance to top along ray from (0, r), direction (√(1−mu²), mu).
      const b = r * mu
      const len = -b + Math.sqrt(Math.max(0, b * b - (r * r - top * top)))
      const ds = len / LUT_STEPS
      let odR = 0
      let odM = 0
      for (let k = 0; k < LUT_STEPS; k += 1) {
        const t = (k + 0.5) * ds
        // Through the planet (shadowed anyway) → clamp h ≥ 0, stays finite.
        const hk = Math.max(0, Math.hypot(Math.sqrt(1 - mu * mu) * t, r + mu * t) - R)
        odR += Math.exp(-hk / atmo.Hr) * ds
        odM += Math.exp(-hk / atmo.Hm) * ds
      }
      const o = (j * LUT_W + i) * 2
      data[o] = THREE.DataUtils.toHalfFloat(Math.min(odR, 6e4))
      data[o + 1] = THREE.DataUtils.toHalfFloat(Math.min(odM, 6e4))
    }
  }
  const tex = new THREE.DataTexture(data, LUT_W, LUT_H, THREE.RGFormat, THREE.HalfFloatType)
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return tex
}

const _rel = new THREE.Vector3()
const _fwd = new THREE.Vector3()
const _camRot = new THREE.Matrix3()
const _lens = new THREE.Matrix3()

function createPass(atmo, R) {
  return new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: FRAG,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uSrc: { value: null },
      uDepth: { value: null },
      uCenter: { value: new THREE.Vector3() },
      uR: { value: 1 },
      uTop: { value: 1 + atmo.height / 1 },
      uBetaR: { value: new THREE.Vector3(...atmo.betaR) },
      uBetaM: { value: atmo.betaM },
      uHr: { value: atmo.Hr },
      uHm: { value: atmo.Hm },
      uG: { value: atmo.g ?? 0.76 },
      uSunDir: { value: new THREE.Vector3() },
      uSunI: { value: atmo.sunIntensity },
      uViewBasis: { value: new THREE.Matrix3() },
      uTan: { value: new THREE.Vector2() },
      uLogFar: { value: 1 },
      uSteps: { value: 16 },
      uTransLut: { value: buildTransLut(R, atmo) },
    },
  })
}

/**
 * Bodies: solar collision entries with .atmosphere. Returns passes for visible ones (≤ max).
 * quality: { atmoSteps }.
 */
export function createAtmospheres() {
  const cache = new Map() // key → material

  const collect = (bodies, camera, focalPx, quality) => {
    camera.getWorldDirection(_fwd)
    const active = []
    for (const body of bodies) {
      const atmo = body.atmosphere
      if (!atmo) continue
      _rel.subVectors(body.position, origin)
      const d = _rel.length()
      const top = body.radius + atmo.height
      if ((top / d) * focalPx < 1.5) continue // sub-pixel
      if (d > top && _rel.dot(_fwd) < -top) continue // fully behind
      active.push({ body, d })
    }
    active.sort((a, b) => a.d - b.d)

    const tanY = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
    _camRot.setFromMatrix4(camera.matrixWorld)
    _lens.set(tanY * camera.aspect, 0, 0, 0, tanY, 0, 0, 0, -1)

    return active.slice(0, spaceConfig.postFx.maxAtmospheres).map(({ body }) => {
      let material = cache.get(body.key)
      if (!material) cache.set(body.key, (material = createPass(body.atmosphere, body.radius)))
      const u = material.uniforms
      u.uCenter.value.subVectors(body.position, origin)
      u.uR.value = body.radius
      u.uTop.value = 1 + body.atmosphere.height / body.radius
      u.uSunDir.value.copy(body.position).negate().normalize() // sun at world 0
      u.uViewBasis.value.multiplyMatrices(_camRot, _lens)
      u.uTan.value.set(tanY * camera.aspect, tanY)
      u.uLogFar.value = Math.log2(camera.far + 1)
      u.uSteps.value = quality.atmoSteps
      return {
        material,
        prepare(src, depth) {
          u.uSrc.value = src
          u.uDepth.value = depth
        },
      }
    })
  }

  const dispose = () =>
    cache.forEach((m) => {
      m.uniforms.uTransLut.value.dispose()
      m.dispose()
    })

  return { collect, dispose }
}
