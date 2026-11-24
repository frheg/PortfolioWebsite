// Gravitational lensing post stage. Active only while a black hole's Einstein ring ≥ few px on screen.
// Point lens, source at ∞: θ_src = θ − θE²/θ, θE = √(2Rs/D). Negative → secondary image (Einstein ring).
// Shadow (2.6 Rs) black + photon ring. HDR in/out (tone mapping in composite).
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'
import { origin } from './floatingOrigin'
import { SHADOW_FACTOR } from './deepSpace'
import { FULLSCREEN_VERT } from './postFx'

const cfg = spaceConfig.galaxy.deepSpace

const FRAG = /* glsl */ `
uniform sampler2D uFrame;
uniform vec2 uRes;
uniform vec2 uCenter;
uniform float uRE;
uniform float uRS;
uniform float uStrength;
varying vec2 vUv;
void main() {
  vec2 p = vUv * uRes;
  vec2 d = p - uCenter;
  float r = max(length(d), 1e-3);
  vec2 dir = d / r;
  float rSrc = r - uStrength * uRE * uRE / r;
  vec2 uv = (uCenter + dir * rSrc) / uRes;
  vec3 col = texture2D(uFrame, clamp(uv, vec2(0.0), vec2(1.0))).rgb;
  // Near shadow: sources from far off-screen (clamped) → fade to dark, then photon ring.
  col *= smoothstep(uRS, uRS * 1.5 + 1.0, r);
  float ring = exp(-pow((r - uRS * 1.03) / (uRS * 0.045 + 0.6), 2.0));
  col += ring * vec3(1.0, 0.82, 0.6) * ${cfg.photonRingGain.toFixed(2)} * uStrength;
  if (r < uRS) col = vec3(0.0);
  gl_FragColor = vec4(col, 1.0);
}
`

const _rel = new THREE.Vector3()
const _ndc = new THREE.Vector3()

export function createLensPass() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uFrame: { value: null },
      uRes: { value: new THREE.Vector2() },
      uCenter: { value: new THREE.Vector2() },
      uRE: { value: 0 },
      uRS: { value: 0 },
      uStrength: { value: 0 },
    },
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: FRAG,
    depthTest: false,
    depthWrite: false,
  })
  const size = new THREE.Vector2()
  const stage = {
    material,
    prepare(src, _depth, res) {
      material.uniforms.uFrame.value = src
      material.uniforms.uRes.value.copy(res)
    },
  }

  /** Strongest on-screen lens → pipeline stage, or null. */
  const collect = (renderer, camera, blackHoles) => {
    renderer.getDrawingBufferSize(size)
    const focalPx = size.y / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
    let best = null
    for (const bh of blackHoles) {
      _rel.subVectors(bh.world, origin)
      const d = _rel.length()
      const rEpx = Math.sqrt((2 * bh.rsKm) / d) * focalPx
      if (rEpx < cfg.lensMinPx || (best && rEpx <= best.rEpx)) continue
      _ndc.copy(_rel).project(camera)
      if (_ndc.z > 1 || Math.abs(_ndc.x) > 3 || Math.abs(_ndc.y) > 3) continue // behind / far off-screen
      best = { rEpx, rSpx: ((SHADOW_FACTOR * bh.rsKm) / d) * focalPx, x: (_ndc.x * 0.5 + 0.5) * size.x, y: (_ndc.y * 0.5 + 0.5) * size.y }
    }
    if (!best) return null
    const u = material.uniforms
    u.uCenter.value.set(best.x, best.y)
    u.uRE.value = best.rEpx
    u.uRS.value = best.rSpx
    // Ease in over a few px → no pop when lens switches on.
    u.uStrength.value = THREE.MathUtils.smoothstep(best.rEpx, cfg.lensMinPx, cfg.lensMinPx * 3)
    return stage
  }

  const dispose = () => material.dispose()

  return { collect, dispose }
}
