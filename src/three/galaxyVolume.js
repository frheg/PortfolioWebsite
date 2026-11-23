// Milky Way glow: raymarched emission + dust absorption through galaxyModel density.
// Two sources, crossfaded:
// - cube: cached cubemap at a capture point. Recaptured 1 face/frame once cam drifts > tol. Near-free.
// - live: screen-space low-res march, only while flying fast at galactic scale.
// Composite: dst = dst·T + E (premult emission, transmittance in alpha). Drawn in sky pass.
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'
import { GALAXY, GALAXY_GLSL, stellarDensity } from './galaxyModel'
import { GALAXY_AXES, PC_KM, sceneToGalaxyKpc } from './galaxyFrame'
import { origin } from './floatingOrigin'

const cfg = spaceConfig.galaxy.volume

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

// Ray dir (galaxy frame) = uRayBasis · (ndc.x, ndc.y, 1). Same shader for screen + cube faces.
const MARCH_FRAG = /* glsl */ `
precision highp float;
${GALAXY_GLSL}
uniform vec3 uCamG;
uniform mat3 uRayBasis;
uniform float uExposure;
uniform float uDustOpacity;
uniform float uMaxSteps;
uniform float uKnee;
varying vec2 vUv;

vec2 boundsHit(vec3 ro, vec3 rd) {
  // Cylinder r < R, |z| < H.
  float R = ${GALAXY.bounds.radius.toFixed(1)};
  float H = ${GALAXY.bounds.halfHeight.toFixed(1)};
  float tz0 = -1e9, tz1 = 1e9;
  if (abs(rd.z) > 1e-6) {
    float a = (-H - ro.z) / rd.z;
    float b = (H - ro.z) / rd.z;
    tz0 = min(a, b);
    tz1 = max(a, b);
  } else if (abs(ro.z) > H) {
    return vec2(1.0, -1.0);
  }
  float A = dot(rd.xy, rd.xy);
  float B = dot(ro.xy, rd.xy);
  float C = dot(ro.xy, ro.xy) - R * R;
  float tr0 = -1e9, tr1 = 1e9;
  if (A > 1e-9) {
    float disc = B * B - A * C;
    if (disc < 0.0) return vec2(1.0, -1.0);
    float sq = sqrt(disc);
    tr0 = (-B - sq) / A;
    tr1 = (-B + sq) / A;
  } else if (C > 0.0) {
    return vec2(1.0, -1.0);
  }
  return vec2(max(max(tz0, tr0), 0.0), min(tz1, tr1));
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec3 rd = normalize(uRayBasis * vec3(ndc, 1.0));
  vec2 span = boundsHit(uCamG, rd);
  vec3 E = vec3(0.0);
  float T = 1.0;
  if (span.y > span.x) {
    // Interleaved gradient noise → dithered start, hides step banding.
    float dither = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    float t = span.x;
    float tNear = t;
    for (int i = 0; i < 160; i++) {
      if (float(i) >= uMaxSteps || t > span.y || T < 0.01) break;
      vec3 p = uCamG + rd * t;
      // Step: grows w/ distance (near detail), shrinks near plane (thin disk not skipped).
      float byDist = 0.03 + 0.07 * (t - tNear);
      float byPlane = 0.03 + 0.6 * abs(p.z) / max(abs(rd.z), 0.04);
      float dt = min(byDist, byPlane);
      vec3 ps = uCamG + rd * (t + dt * dither);
      vec4 s = galaxySample(ps);
      E += T * s.rgb * dt;
      T *= exp(-uDustOpacity * s.a * dt);
      t += dt;
    }
  }
  // Soft knee: lift faint outer disk w/o blowing out core. Then sqrt encode → 8-bit RT
  // keeps dark gradients smooth; composite squares back.
  E *= uExposure;
  E /= 1.0 + dot(E, vec3(0.3, 0.5, 0.2)) * uKnee;
  gl_FragColor = vec4(sqrt(E), T);
}
`

const COMPOSITE_FRAG = /* glsl */ `
uniform samplerCube uCube;
uniform sampler2D uLive;
uniform float uMix;
uniform float uFade;
uniform mat3 uViewBasis;
varying vec2 vUv;
void main() {
  vec3 dir = normalize(uViewBasis * vec3(vUv * 2.0 - 1.0, 1.0));
  vec4 c = textureCube(uCube, dir);
  vec4 l = texture2D(uLive, vUv);
  vec4 s = mix(c, l, uMix);
  vec3 E = s.rgb * s.rgb;
  float T = s.a;
  gl_FragColor = vec4(E * uFade, mix(1.0, T, uFade));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

// GL cube face convention: dir = F · (sc, tc, 1).
const FACE_BASES = [
  [0, 0, 1, 0, -1, 0, -1, 0, 0],
  [0, 0, -1, 0, -1, 0, 1, 0, 0],
  [1, 0, 0, 0, 0, 1, 0, 1, 0],
  [1, 0, 0, 0, 0, -1, 0, -1, 0],
  [1, 0, 0, 0, -1, 0, 0, 0, 1],
  [-1, 0, 0, 0, -1, 0, 0, 0, -1],
].map((rows) => new THREE.Matrix3().set(...rows))

// Scene → galaxy-local rotation (rows = galaxy axes in scene).
const SCENE_TO_G = new THREE.Matrix3().set(...GALAXY_AXES.x, ...GALAXY_AXES.y, ...GALAXY_AXES.z)

const _camRot = new THREE.Matrix3()
const _basis = new THREE.Matrix3()
const _lens = new THREE.Matrix3()
const _camPc = new THREE.Vector3()

export function createGalaxyVolume(isMobile) {
  const cubeSize = isMobile ? cfg.cubeSizeMobile : cfg.cubeSize
  const makeCube = () =>
    new THREE.WebGLCubeRenderTarget(cubeSize, { type: THREE.UnsignedByteType, generateMipmaps: false, depthBuffer: false })
  let front = makeCube()
  let back = makeCube()
  const live = new THREE.WebGLRenderTarget(4, 4, { type: THREE.UnsignedByteType, depthBuffer: false })

  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const quad = new THREE.PlaneGeometry(2, 2)

  const marchMat = new THREE.ShaderMaterial({
    uniforms: {
      uCamG: { value: new THREE.Vector3() },
      uRayBasis: { value: new THREE.Matrix3() },
      uExposure: { value: cfg.exposure },
      uDustOpacity: { value: cfg.dustOpacity },
      uMaxSteps: { value: cfg.maxSteps },
      uKnee: { value: cfg.knee },
    },
    vertexShader: QUAD_VERT,
    fragmentShader: MARCH_FRAG,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  })
  const marchScene = new THREE.Scene()
  marchScene.add(new THREE.Mesh(quad, marchMat))

  const compositeMat = new THREE.ShaderMaterial({
    uniforms: {
      uCube: { value: front.texture },
      uLive: { value: live.texture },
      uMix: { value: 0 },
      uFade: { value: 0 },
      uViewBasis: { value: new THREE.Matrix3() },
    },
    vertexShader: QUAD_VERT,
    fragmentShader: COMPOSITE_FRAG,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.SrcAlphaFactor,
  })
  const compositeScene = new THREE.Scene()
  compositeScene.add(new THREE.Mesh(quad, compositeMat))

  const capturedAt = new THREE.Vector3(Infinity, 0, 0) // pc, scene
  const captureFrom = new THREE.Vector3()
  const lastCam = new THREE.Vector3()
  let captureFace = -1 // -1 idle, 0..5 filling back
  let hasCube = false
  let mixTarget = 0
  let speedPc = 0

  // Eye adaptation: embedded in dense disk → lower exposure (dark sky + band), outside → full.
  const exposureAt = (camG) => cfg.exposure / (1 + cfg.adaptation * Math.sqrt(stellarDensity(camG[0], camG[1], camG[2])))

  const march = (renderer, target, face, basis, camG) => {
    marchMat.uniforms.uCamG.value.set(camG[0], camG[1], camG[2])
    marchMat.uniforms.uExposure.value = exposureAt(camG)
    marchMat.uniforms.uRayBasis.value.multiplyMatrices(SCENE_TO_G, basis)
    marchMat.uniforms.uMaxSteps.value = target === live ? (isMobile ? cfg.liveStepsMobile : cfg.liveSteps) : cfg.maxSteps
    renderer.setRenderTarget(target, face)
    renderer.clear()
    renderer.render(marchScene, quadCam)
  }

  const captureFaces = (renderer, from, count) => {
    const camG = sceneToGalaxyKpc(from.x, from.y, from.z)
    for (let n = 0; n < count && captureFace < 6; n += 1) {
      march(renderer, back, captureFace, FACE_BASES[captureFace], camG)
      captureFace += 1
    }
    if (captureFace >= 6) {
      ;[front, back] = [back, front]
      compositeMat.uniforms.uCube.value = front.texture
      capturedAt.copy(from)
      captureFace = -1
      hasCube = true
    }
  }

  /** Sky pass. Call after sky scene render, before world pass. Restores screen target. */
  const render = (renderer, camera, deltaSeconds) => {
    _camPc.copy(origin).divideScalar(PC_KM)
    speedPc = speedPc * 0.8 + (_camPc.distanceTo(lastCam) / Math.max(deltaSeconds, 1e-3)) * 0.2
    lastCam.copy(_camPc)

    // Tolerance: parallax of nearest structure stays sub-degree.
    const camG = sceneToGalaxyKpc(_camPc.x, _camPc.y, _camPc.z)
    const distGc = Math.hypot(camG[0], camG[1], camG[2]) * 1000
    const tol = cfg.captureTolPc + cfg.captureTolFrac * distGc
    const drift = _camPc.distanceTo(capturedAt)

    if (!hasCube) {
      captureFace = 0
      captureFrom.copy(_camPc)
      captureFaces(renderer, captureFrom, 6) // first frame: sync, no blank sky
    } else if (captureFace >= 0) {
      captureFaces(renderer, captureFrom, 1)
    } else if (drift > tol && speedPc < tol * cfg.liveSpeedFactor) {
      captureFace = 0
      captureFrom.copy(_camPc)
      captureFaces(renderer, captureFrom, 1)
    }

    mixTarget = drift > tol && speedPc >= tol * cfg.liveSpeedFactor ? 1 : 0
    const k = 1 - Math.exp(-cfg.mixRate * deltaSeconds)
    compositeMat.uniforms.uMix.value += (mixTarget - compositeMat.uniforms.uMix.value) * k
    compositeMat.uniforms.uFade.value += (1 - compositeMat.uniforms.uFade.value) * k

    // Camera basis: dir_scene = R · diag(tanX, tanY, -1) · (ndc, 1).
    const tanY = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
    _camRot.setFromMatrix4(camera.matrixWorld)
    _lens.set(tanY * camera.aspect, 0, 0, 0, tanY, 0, 0, 0, -1)
    _basis.multiplyMatrices(_camRot, _lens)

    if (compositeMat.uniforms.uMix.value > 0.002) {
      const scale = isMobile ? cfg.liveScaleMobile : cfg.liveScale
      const size = renderer.getDrawingBufferSize(new THREE.Vector2())
      const w = Math.max(2, Math.round(size.x * scale))
      const h = Math.max(2, Math.round(size.y * scale))
      if (live.width !== w || live.height !== h) live.setSize(w, h)
      march(renderer, live, 0, _basis, camG)
    }

    renderer.setRenderTarget(null)
    compositeMat.uniforms.uViewBasis.value.copy(_basis)
    renderer.render(compositeScene, quadCam)
  }

  const dispose = () => {
    front.dispose()
    back.dispose()
    live.dispose()
    quad.dispose()
    marchMat.dispose()
    compositeMat.dispose()
  }

  return { render, dispose }
}
