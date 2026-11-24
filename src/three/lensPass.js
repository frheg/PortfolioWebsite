// Black hole post stage: per-pixel null-geodesic ray trace (Schwarzschild), HDR in/out.
// Active while the strongest black hole's Einstein ring ≥ few px on screen.
// Units: Rs = 1. Photon accel in flat coords: a = −1.5 h² x / r⁵ (h = |x × v|) → exact Schwarzschild orbits.
// Inside RMAX: integrate (horizon, photon ring, multiple disk images). Outside: weak-field bend α = (1/b)(1 − s/|x|).
// Disk: thin, opaque-ish, ISCO 3 Rs, Novikov–Thorne-ish emissivity, Keplerian β, Doppler + gravitational shift (g⁴), blackbody color.
// Background: escaped ray → screen uv of the already-rendered frame (lensed stars / galaxy glow).
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'
import { origin } from './floatingOrigin'
import { FULLSCREEN_VERT } from './postFx'

const cfg = spaceConfig.galaxy.deepSpace

const frag = (maxSteps) => /* glsl */ `
uniform sampler2D uFrame;
uniform mat3 uCamRot;   // view → world
uniform mat3 uToLocal;  // world → BH-local (disk plane z = 0, spin +z)
uniform vec3 uCam;      // camera, BH-local, Rs
uniform float uTanHalf;
uniform float uAspect;
uniform float uStrength;
uniform float uDisk;    // disk gain (0 = dormant BH)
uniform float uInner;
uniform float uOuter;
uniform float uTime;
varying vec2 vUv;

const float RMAX = 60.0;
const float TWO_PI = 6.2831853;

float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y);
}

// Blackbody K → linear rgb (Helland fit, normalized).
vec3 blackbody(float t) {
  t = clamp(t, 1000.0, 40000.0) / 100.0;
  float r = t <= 66.0 ? 1.0 : clamp(1.292936 * pow(t - 60.0, -0.1332047), 0.0, 1.0);
  float g = t <= 66.0 ? clamp(0.3900816 * log(t) - 0.6318414, 0.0, 1.0) : clamp(1.1298909 * pow(t - 60.0, -0.0755148), 0.0, 1.0);
  float b = t >= 66.0 ? 1.0 : (t <= 19.0 ? 0.0 : clamp(0.5432068 * log(t - 10.0) - 1.1962541, 0.0, 1.0));
  return pow(vec3(r, g, b), vec3(2.2));
}

// Disk texture: Keplerian shear (Ω ∝ r^-1.5) → spiral streaks. Two phases crossfaded → no endless wind-up.
float streaks(vec2 p, float r) {
  float om = sqrt(0.5 / (r * r * r));
  float s = 0.0;
  for (int k = 0; k < 2; k++) {
    float ph = fract(uTime * 0.05 + float(k) * 0.5);
    float w = 1.0 - abs(2.0 * ph - 1.0);
    float a = -om * ph * 60.0; // inner rim ~8 rad per cycle, outer ~0.4
    vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * p;
    float ang = atan(q.y, q.x);
    // Periodic in angle: sample on circle of radius ∝ r (no seam).
    vec2 c = vec2(cos(ang), sin(ang));
    float n = noise2(c * 3.0 + vec2(log(r) * 7.0, float(k) * 13.0)) * 0.6 + noise2(c * 9.0 + vec2(log(r) * 21.0, 5.0)) * 0.4;
    s += w * n;
  }
  return s;
}

vec3 bend(vec3 d, vec3 x, float a) {
  vec3 xc = x - d * dot(x, d);
  float l = length(xc);
  if (l < 1e-6) return d;
  return normalize(d * cos(a) - (xc / l) * sin(a));
}

vec3 background(vec3 dLocal) {
  vec3 v = transpose(uCamRot) * (transpose(uToLocal) * dLocal);
  if (v.z > -1e-3) return vec3(0.0);
  vec2 uv = v.xy / (-v.z) / vec2(uTanHalf * uAspect, uTanHalf) * 0.5 + 0.5;
  vec2 e = min(uv, 1.0 - uv);
  return texture2D(uFrame, clamp(uv, 0.0, 1.0)).rgb * smoothstep(-0.03, 0.05, min(e.x, e.y));
}

void main() {
  vec3 orig = texture2D(uFrame, vUv).rgb;
  vec2 ndc = vUv * 2.0 - 1.0;
  vec3 d = normalize(uToLocal * (uCamRot * normalize(vec3(ndc.x * uTanHalf * uAspect, ndc.y * uTanHalf, -1.0))));
  vec3 c = uCam;
  float cr = length(c);
  float b = length(cross(c, d));
  float tc = -dot(c, d);
  vec3 col;

  if (cr >= RMAX && (b >= RMAX || tc <= 0.0)) {
    // Weak field (whole remaining path).
    col = background(bend(d, c, (1.0 / max(b, 1e-3)) * (1.0 - dot(c, d) / cr)));
  } else {
    vec3 x = c;
    if (cr >= RMAX) x = c + d * (tc - sqrt(max(RMAX * RMAX - b * b, 0.0)));
    vec3 v = d;
    float h2 = b * b;
    vec3 acc = vec3(0.0);
    float T = 1.0;
    bool captured = false;
    for (int i = 0; i < ${maxSteps}; i++) {
      float r = length(x);
      if (r < 1.0) { captured = true; break; }
      if (r > RMAX && dot(x, v) > 0.0) break;
      float dt = clamp(0.07 * r, 0.015, 3.0);
      v += -1.5 * h2 * x / (r * r * r * r * r) * dt;
      vec3 xn = x + v * dt;
      if (uDisk > 0.0 && x.z * xn.z < 0.0) {
        vec3 p = mix(x, xn, x.z / (x.z - xn.z));
        float rr = length(p.xy);
        if (rr > uInner && rr < uOuter) {
          // Emissivity ∝ (1 − √(r_in/r)) / r³, peak-normalized.
          float f = max(1.0 - sqrt(uInner / rr), 0.0) / (rr * rr * rr) * 476.0;
          float beta = min(sqrt(0.5 / (rr - 1.0)), 0.75);
          vec3 phiHat = normalize(vec3(-p.y, p.x, 0.0));
          float cosT = dot(phiHat, -normalize(v));
          float g = sqrt(1.0 - 1.0 / rr) * sqrt(1.0 - beta * beta) / (1.0 - beta * cosT);
          float tex = 0.45 + 1.1 * streaks(p.xy, rr);
          float edge = smoothstep(uInner, uInner * 1.08, rr) * (1.0 - smoothstep(uOuter * 0.55, uOuter, rr));
          float alpha = clamp(f * 4.0, 0.0, 0.92) * edge;
          vec3 e = blackbody(4800.0 * pow(f, 0.25) * g) * f * tex * g * g * g * g * uDisk;
          acc += T * e * alpha;
          T *= 1.0 - alpha;
        }
      }
      x = xn;
      if (T < 0.01) break;
    }
    vec3 bg = vec3(0.0);
    float rEnd = length(x);
    if (!captured && rEnd > 2.0) {
      vec3 dOut = normalize(v);
      bg = background(bend(dOut, x, (1.0 / max(b, 1e-3)) * (1.0 - dot(x, dOut) / rEnd)));
    }
    col = acc + T * bg;
  }
  gl_FragColor = vec4(mix(orig, col, uStrength), 1.0);
}
`

const _rel = new THREE.Vector3()
const _ndc = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _m4 = new THREE.Matrix4()

export function createLensPass(isMobile = false) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uFrame: { value: null },
      uCamRot: { value: new THREE.Matrix3() },
      uToLocal: { value: new THREE.Matrix3() },
      uCam: { value: new THREE.Vector3() },
      uTanHalf: { value: 1 },
      uAspect: { value: 1 },
      uStrength: { value: 0 },
      uDisk: { value: 0 },
      uInner: { value: 3 },
      uOuter: { value: cfg.diskOuterRs },
      uTime: { value: 0 },
    },
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: frag(isMobile ? cfg.rayStepsMobile : cfg.raySteps),
    depthTest: false,
    depthWrite: false,
  })
  const size = new THREE.Vector2()
  const stage = {
    material,
    prepare(src) {
      material.uniforms.uFrame.value = src
    },
  }

  /** Strongest on-screen black hole → pipeline stage, or null. Fades that hole's mesh disk + beacon (traced instead). */
  const collect = (renderer, camera, blackHoles) => {
    renderer.getDrawingBufferSize(size)
    const focalPx = size.y / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
    let best = null
    for (const bh of blackHoles) {
      _rel.subVectors(bh.world, origin)
      const d = _rel.length()
      const rEpx = Math.sqrt((2 * bh.rsKm) / d) * focalPx
      const inside = d < 60 * bh.rsKm // in the strong field: always on
      if (!inside && (rEpx < cfg.lensMinPx || (best && rEpx <= best.rEpx))) continue
      _ndc.copy(_rel).project(camera)
      if (!inside && (_ndc.z > 1 || Math.abs(_ndc.x) > 3 || Math.abs(_ndc.y) > 3)) continue // behind / far off-screen
      best = { bh, rEpx: inside ? Infinity : rEpx }
    }
    const strength = best ? THREE.MathUtils.smoothstep(best.rEpx, cfg.lensMinPx, cfg.lensMinPx * 3) : 0
    for (const bh of blackHoles) {
      const s = best && bh === best.bh ? strength : 0
      if (bh.disk) bh.disk.material.uniforms.uGain.value = cfg.diskGain * (1 - s)
      if (bh.beacon) bh.beacon.visible = s < 0.5
    }
    if (!best) return null

    const { bh } = best
    const u = material.uniforms
    if (bh.disk) bh.disk.getWorldQuaternion(_q)
    else _q.identity()
    u.uToLocal.value.setFromMatrix4(_m4.makeRotationFromQuaternion(_q.invert()))
    _rel.subVectors(origin, bh.world).divideScalar(bh.rsKm).applyMatrix3(u.uToLocal.value)
    u.uCam.value.copy(_rel)
    u.uCamRot.value.setFromMatrix4(camera.matrixWorld)
    u.uTanHalf.value = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
    u.uAspect.value = camera.aspect
    u.uDisk.value = bh.disk ? cfg.diskGain * cfg.rayDiskGain : 0
    u.uTime.value = bh.disk ? bh.disk.material.uniforms.uTime.value : 0
    u.uStrength.value = strength
    return stage
  }

  // Compile the ray-trace program up front (behind the loading screen) → no hitch the first time a black hole fills the view.
  const warm = (renderer, camera) => {
    const sc = new THREE.Scene()
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
    quad.frustumCulled = false
    sc.add(quad)
    renderer.compile(sc, camera)
    quad.geometry.dispose()
  }

  const dispose = () => material.dispose()

  return { collect, dispose, warm }
}
