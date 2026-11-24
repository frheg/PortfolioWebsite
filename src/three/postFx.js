// HDR post chain. Scene → float target (+depth) → [atmospheres] → [lens] → bloom → composite → screen.
// Composite: radial warp streaks (fast flight) + tone mapping + sRGB. Passes ping-pong two float targets.
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'

const cfg = spaceConfig.postFx

export const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

// Dual-filter (Kawase) bloom: cheap, wide, stable.
const DOWN_FRAG = /* glsl */ `
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uThreshold; // < 0 → no prefilter
varying vec2 vUv;
// Soft threshold: keep the part of each pixel above uThreshold (by max channel).
vec3 pre(vec3 c) {
  if (uThreshold < 0.0) return c;
  float l = max(c.r, max(c.g, c.b));
  return c * max(l - uThreshold, 0.0) / max(l, 1e-4);
}
void main() {
  vec3 c = pre(texture2D(uSrc, vUv).rgb) * 4.0;
  c += pre(texture2D(uSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb);
  c += pre(texture2D(uSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb);
  c += pre(texture2D(uSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb);
  c += pre(texture2D(uSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb);
  gl_FragColor = vec4(min(c / 8.0, vec3(64.0)), 1.0);
}
`

const UP_FRAG = /* glsl */ `
uniform sampler2D uSrc;
uniform sampler2D uPrev;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(uSrc, vUv + uTexel * vec2(-2.0, 0.0)).rgb;
  c += texture2D(uSrc, vUv + uTexel * vec2(2.0, 0.0)).rgb;
  c += texture2D(uSrc, vUv + uTexel * vec2(0.0, -2.0)).rgb;
  c += texture2D(uSrc, vUv + uTexel * vec2(0.0, 2.0)).rgb;
  c += texture2D(uSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb * 2.0;
  c += texture2D(uSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb * 2.0;
  c += texture2D(uSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb * 2.0;
  c += texture2D(uSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb * 2.0;
  gl_FragColor = vec4(c / 12.0 + texture2D(uPrev, vUv).rgb, 1.0);
}
`

const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D uSrc;
uniform sampler2D uBloom;
uniform float uBloomStrength;
uniform vec2 uWarpCenter;
uniform float uWarp;
uniform float uTunnel;  // boost tunnel vision 0..1
uniform float uAspect;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(uSrc, vUv).rgb;
  if (uWarp > 0.001) {
    // Streaks: average along ray to vanishing point (direction of travel).
    vec2 d = (vUv - uWarpCenter) * uWarp * 0.06;
    vec3 acc = c;
    for (int i = 1; i < 10; i++) acc += texture2D(uSrc, vUv - d * float(i)).rgb;
    c = mix(c, acc / 10.0 * 1.15, smoothstep(0.0, 0.25, length(vUv - uWarpCenter)));
  }
  c += texture2D(uBloom, vUv).rgb * uBloomStrength;
  if (uTunnel > 0.001) {
    // Tunnel vision: soft radial dim + faint cool edge glow (aspect-correct, 0 center → 1 corner).
    vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
    float r = length(q) / length(vec2(uAspect, 1.0) * 0.5);
    float v = smoothstep(0.3, 1.05, r);
    c *= 1.0 - uTunnel * 0.55 * v * v;
    c += vec3(0.45, 0.5, 1.0) * uTunnel * 0.03 * v;
  }
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export function createFullscreen() {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const geometry = new THREE.PlaneGeometry(2, 2)
  const mesh = new THREE.Mesh(geometry)
  mesh.frustumCulled = false
  const scene = new THREE.Scene()
  scene.add(mesh)
  return {
    draw(renderer, material, target) {
      mesh.material = material
      renderer.setRenderTarget(target)
      renderer.render(scene, camera)
    },
    dispose() {
      geometry.dispose()
    },
  }
}

const pass = (fragmentShader, uniforms, extra = {}) =>
  new THREE.ShaderMaterial({ vertexShader: FULLSCREEN_VERT, fragmentShader, uniforms, depthTest: false, depthWrite: false, ...extra })

export function createPostFx(quality) {
  const fs = createFullscreen()
  const size = new THREE.Vector2()
  const hdr = { type: THREE.HalfFloatType, depthBuffer: false }

  let samples = quality.msaa
  const makeSceneTarget = () => {
    const t = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples })
    t.depthTexture = new THREE.DepthTexture(4, 4)
    t.depthTexture.type = THREE.UnsignedIntType
    return t
  }
  let sceneTarget = makeSceneTarget()
  const ping = [new THREE.WebGLRenderTarget(4, 4, hdr), new THREE.WebGLRenderTarget(4, 4, hdr)]
  const mips = Array.from({ length: cfg.bloomLevels }, () => new THREE.WebGLRenderTarget(4, 4, hdr))
  const ups = Array.from({ length: cfg.bloomLevels - 1 }, () => new THREE.WebGLRenderTarget(4, 4, hdr))

  const downMat = pass(DOWN_FRAG, { uSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: -1 } })
  const upMat = pass(UP_FRAG, { uSrc: { value: null }, uPrev: { value: null }, uTexel: { value: new THREE.Vector2() } })
  const compositeMat = pass(COMPOSITE_FRAG, {
    uSrc: { value: null },
    uBloom: { value: null },
    uBloomStrength: { value: 0 },
    uWarpCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uWarp: { value: 0 },
    uTunnel: { value: 0 },
    uAspect: { value: 1 },
  })
  const black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1)
  black.needsUpdate = true

  const resize = (renderer) => {
    renderer.getDrawingBufferSize(size)
    if (quality.msaa !== samples) {
      samples = quality.msaa
      sceneTarget.dispose()
      sceneTarget = makeSceneTarget()
    }
    if (sceneTarget.width === size.x && sceneTarget.height === size.y) return
    sceneTarget.setSize(size.x, size.y)
    ping.forEach((t) => t.setSize(size.x, size.y))
    let w = size.x
    let h = size.y
    mips.forEach((t, i) => {
      w = Math.max(1, Math.round(w / 2))
      h = Math.max(1, Math.round(h / 2))
      t.setSize(w, h)
      if (i < ups.length) ups[i].setSize(w, h)
    })
  }

  // Space = black. Explicit (three writes clear colors sRGB-encoded even into linear targets).
  const clearBlack = new THREE.Color(0x000000)

  /** Bind scene target. Caller renders sky + world into it. */
  const begin = (renderer) => {
    resize(renderer)
    renderer.setRenderTarget(sceneTarget)
    renderer.setClearColor(clearBlack, 1)
    renderer.clear()
    return sceneTarget
  }

  /**
   * passes: [{ material, prepare(srcTexture, depthTexture) }] applied in order (ping-pong).
   * warp: { strength, center: Vector2 uv, tunnel 0..1 }.
   */
  const finish = (renderer, passes, warp) => {
    let src = sceneTarget.texture
    let p = 0
    for (const fx of passes) {
      fx.prepare(src, sceneTarget.depthTexture, size)
      fs.draw(renderer, fx.material, ping[p])
      src = ping[p].texture
      p = 1 - p
    }

    let bloomTex = black
    if (quality.bloom) {
      let input = src
      mips.forEach((t, i) => {
        downMat.uniforms.uSrc.value = input
        downMat.uniforms.uTexel.value.set(1 / t.width, 1 / t.height)
        downMat.uniforms.uThreshold.value = i === 0 ? cfg.bloomThreshold : -1
        fs.draw(renderer, downMat, t)
        input = t.texture
      })
      // Up: from smallest, add into next-larger level.
      let up = mips[mips.length - 1].texture
      for (let i = ups.length - 1; i >= 0; i -= 1) {
        upMat.uniforms.uSrc.value = up
        upMat.uniforms.uPrev.value = mips[i].texture
        upMat.uniforms.uTexel.value.set(1 / ups[i].width, 1 / ups[i].height)
        fs.draw(renderer, upMat, ups[i])
        up = ups[i].texture
      }
      bloomTex = up
    }

    compositeMat.uniforms.uSrc.value = src
    compositeMat.uniforms.uBloom.value = bloomTex
    compositeMat.uniforms.uBloomStrength.value = quality.bloom ? cfg.bloomStrength : 0
    compositeMat.uniforms.uWarp.value = warp.strength
    compositeMat.uniforms.uWarpCenter.value.copy(warp.center)
    compositeMat.uniforms.uTunnel.value = warp.tunnel ?? 0
    compositeMat.uniforms.uAspect.value = size.x / Math.max(size.y, 1)
    fs.draw(renderer, compositeMat, null)
  }

  const dispose = () => {
    sceneTarget.dispose()
    ping.forEach((t) => t.dispose())
    mips.forEach((t) => t.dispose())
    ups.forEach((t) => t.dispose())
    ;[downMat, upMat, compositeMat].forEach((m) => m.dispose())
    black.dispose()
    fs.dispose()
  }

  return { begin, finish, dispose }
}
