// Gravitational lensing post pass. Active only while a black hole's Einstein ring ≥ few px on screen:
// frame → HDR MSAA target → point-lens remap to screen. Shadow (2.6 Rs) black + photon ring.
// Point lens, source at ∞: θ_src = θ − θE²/θ, θE = √(2Rs/D). Negative → secondary image (Einstein ring).
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'
import { origin } from './floatingOrigin'
import { SHADOW_FACTOR } from './deepSpace'

const cfg = spaceConfig.galaxy.deepSpace

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

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
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

const _rel = new THREE.Vector3()
const _ndc = new THREE.Vector3()

export function createLensPass(isMobile) {
  const target = new THREE.WebGLRenderTarget(4, 4, {
    type: THREE.HalfFloatType,
    samples: isMobile ? 0 : 4,
  })
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uFrame: { value: target.texture },
      uRes: { value: new THREE.Vector2() },
      uCenter: { value: new THREE.Vector2() },
      uRE: { value: 0 },
      uRS: { value: 0 },
      uStrength: { value: 0 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    depthTest: false,
    depthWrite: false,
  })
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  const quadScene = new THREE.Scene()
  quadScene.add(quad)
  const size = new THREE.Vector2()

  /** Pick strongest on-screen lens. Returns target to render into, or null (no lens). */
  const prepare = (renderer, camera, blackHoles) => {
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
    if (target.width !== size.x || target.height !== size.y) target.setSize(size.x, size.y)
    const u = material.uniforms
    u.uRes.value.copy(size)
    u.uCenter.value.set(best.x, best.y)
    u.uRE.value = best.rEpx
    u.uRS.value = best.rSpx
    // Ease in over a few px → no pop when lens switches on.
    u.uStrength.value = THREE.MathUtils.smoothstep(best.rEpx, cfg.lensMinPx, cfg.lensMinPx * 3)
    return target
  }

  const finish = (renderer) => {
    renderer.setRenderTarget(null)
    renderer.render(quadScene, quadCam)
  }

  const dispose = () => {
    target.dispose()
    material.dispose()
    quad.geometry.dispose()
  }

  return { prepare, finish, dispose }
}
