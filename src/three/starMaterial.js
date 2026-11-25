// Star point sprites. Positions: float32 pc, local to a chunk origin (float64, JS).
// Relative-to-eye: cam pos split hi/lo per chunk → subtraction exact near cam, no jitter at any range.
// Brightness from apparent magnitude. Fades out once own disc ≥ few px (body LOD takes over).
import * as THREE from 'three'
import { getRenderScale } from './frameGovernor'
import { spaceConfig } from './spaceConfig'
import { PC_KM } from './galaxyFrame'
import { origin } from './floatingOrigin'

const cfg = spaceConfig.galaxy.stars

// Shared across all star materials → retune in one place.
export const starUniforms = {
  uMagLimit: { value: cfg.magLimit },
  uFocalPx: { value: 1000 },
  uPixelRatio: { value: 1 },
  uGain: { value: cfg.gain },
}

const VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute float absMag;
attribute float temp;
attribute vec3 color;
uniform vec3 uCamHigh;
uniform vec3 uCamLow;
uniform float uMagLimit;
uniform float uFocalPx;
uniform float uPixelRatio;
uniform float uGain;
uniform float uFade;
varying vec3 vColor;
varying float vSharp;

const float PC_KM = ${PC_KM.toExponential(8)};
const float SUN_R_PC = 2.25461e-8;
const float LOG10_2 = 0.30103;
const float POGSON = 1.3287712; // 0.4·log2(10)

void main() {
  vec3 rel = (position - uCamHigh) - uCamLow;
  float d = max(length(rel), 1e-14);
  float mApp = absMag + 5.0 * log2(d) * LOG10_2 - 5.0;
  float b = exp2(-POGSON * (mApp - uMagLimit)); // flux / flux at limit

  // Own disc in px: R ∝ √L / T².
  float tr = 5778.0 / temp;
  float radiusPc = SUN_R_PC * sqrt(exp2(-POGSON * (absMag - 4.83))) * tr * tr;
  float discPx = radiusPc / d * uFocalPx;

  float alpha = (b >= 1.0 ? 1.0 : b * b) * (1.0 - smoothstep(1.5, 4.0, discPx)) * uFade;
  if (alpha < 0.003) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // off clip → culled
    gl_PointSize = 0.0;
    return;
  }

  float size = clamp(1.8 * pow(max(b, 1.0), 0.2), 1.8, 40.0);
  gl_PointSize = size * uPixelRatio;
  vSharp = size; // bigger sprite → relatively smaller core
  vColor = color * alpha * uGain * (0.6 + 0.4 * min(b, 4.0));

  vec3 v = mat3(viewMatrix) * (rel * PC_KM);
  gl_Position = projectionMatrix * vec4(v, 1.0);
  #include <logdepthbuf_vertex>
}
`

const FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
varying vec3 vColor;
varying float vSharp;
void main() {
  #include <logdepthbuf_fragment>
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  float coreK = mix(6.0, 40.0, smoothstep(2.0, 30.0, vSharp));
  float profile = exp(-r2 * coreK) + 0.12 * exp(-r2 * 4.0) * smoothstep(1.0, 0.4, r2);
  gl_FragColor = vec4(vColor * profile, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

const _rel = new THREE.Vector3()

/**
 * Points for one chunk. chunkOriginPc: float64 {x,y,z} scene pc. Attributes: position (pc, local),
 * absMag, temp, color (Uint8 normalized).
 */
export function createStarPoints(geometry, chunkOriginPc) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...starUniforms,
      uCamHigh: { value: new THREE.Vector3() },
      uCamLow: { value: new THREE.Vector3() },
      uFade: { value: 1 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false // pc-space geometry, bounds meaningless in km scene
  points.matrixAutoUpdate = false

  const hi = material.uniforms.uCamHigh.value
  const lo = material.uniforms.uCamLow.value
  // Per-draw RTE split. origin = this frame's cam (km, float64).
  points.onBeforeRender = () => {
    _rel.set(
      origin.x / PC_KM - chunkOriginPc.x,
      origin.y / PC_KM - chunkOriginPc.y,
      origin.z / PC_KM - chunkOriginPc.z
    )
    hi.set(Math.fround(_rel.x), Math.fround(_rel.y), Math.fround(_rel.z))
    lo.set(_rel.x - hi.x, _rel.y - hi.y, _rel.z - hi.z)
  }
  return points
}

// Per-frame shared lens params. Call once per frame before render.
export function updateStarUniforms(camera, renderer) {
  starUniforms.uFocalPx.value = window.innerHeight / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
  starUniforms.uPixelRatio.value = renderer.getPixelRatio() * getRenderScale() // scene target px
}
