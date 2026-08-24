// Procedurally generates the space skybox instead of loading stitched photo
// faces. Each pixel is sampled from a 3D value-noise field using that
// pixel's actual cube-face direction vector (not 2D per-face coordinates),
// so adjacent faces agree exactly at shared edges with no seam-blending
// needed — the old photo-based version had to blend edges by hand because
// six independently-sourced images never lined up on their own. Being
// procedural also means no fixed source-image resolution ceiling: the noise
// is evaluated on a small grid for speed, then upscaled onto a much larger
// canvas per face (nebulae are low-frequency by nature, so this reads as
// detail, not blur), with sharp star points drawn on top at full resolution.
import { useEffect } from 'react'
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'

const FACE_KEYS = ['rt', 'lf', 'up', 'dn', 'ft', 'bk']

function hash3(x, y, z) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453
  return n - Math.floor(n)
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value))
}

function valueNoise3D(x, y, z) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const u = fade(x - xi)
  const v = fade(y - yi)
  const w = fade(z - zi)

  const x00 = lerp(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u)
  const x10 = lerp(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u)
  const x01 = lerp(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u)
  const x11 = lerp(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u)
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w)
}

function fbm3D(x, y, z, octaves) {
  let amplitude = 0.5
  let frequency = 1
  let sum = 0
  let max = 0
  for (let i = 0; i < octaves; i += 1) {
    sum += amplitude * valueNoise3D(x * frequency, y * frequency, z * frequency)
    max += amplitude
    amplitude *= 0.5
    frequency *= 2
  }
  return sum / max
}

// mulberry32 — small, deterministic PRNG so star placement is stable across
// reloads instead of reshuffling every visit.
function mulberry32(seed) {
  let t = seed
  return function random() {
    t |= 0
    t = (t + 0x6d2b79f5) | 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

// Standard cubemap face parameterization: mapping every face through these
// six formulas is what guarantees two faces agree on the direction vector
// along the edge they share.
function faceDirection(faceKey, u, v) {
  switch (faceKey) {
    case 'rt': return [1, -v, -u]
    case 'lf': return [-1, -v, u]
    case 'up': return [u, 1, v]
    case 'dn': return [u, -1, -v]
    case 'ft': return [u, -v, 1]
    default: return [-u, -v, -1] // 'bk'
  }
}

function sampleGradient(stops, t, colorHelper) {
  const scaled = clamp01(t) * (stops.length - 1)
  const i0 = Math.floor(scaled)
  const i1 = Math.min(stops.length - 1, i0 + 1)
  const localT = scaled - i0
  const a = stops[i0]
  const b = stops[i1]
  colorHelper.setHSL(lerp(a.h, b.h, localT), lerp(a.s, b.s, localT), lerp(a.l, b.l, localT))
  return colorHelper
}

function buildNebulaGrid(faceKey, cfg, colorHelper) {
  const { gridSize, baseColor } = cfg
  const data = new Uint8ClampedArray(gridSize * gridSize * 4)

  for (let py = 0; py < gridSize; py += 1) {
    for (let px = 0; px < gridSize; px += 1) {
      const u = (2 * (px + 0.5)) / gridSize - 1
      const v = (2 * (py + 0.5)) / gridSize - 1
      const [rawX, rawY, rawZ] = faceDirection(faceKey, u, v)
      const length = Math.hypot(rawX, rawY, rawZ) || 1
      const dx = rawX / length
      const dy = rawY / length
      const dz = rawZ / length

      const cloud = fbm3D(dx * cfg.cloudScale, dy * cfg.cloudScale, dz * cfg.cloudScale, cfg.octaves)
      const detail = fbm3D(
        dx * cfg.detailScale + 91.7,
        dy * cfg.detailScale + 12.3,
        dz * cfg.detailScale + 55.1,
        cfg.detailOctaves
      )
      let density = clamp01(cloud * 0.72 + detail * 0.28)
      density = Math.pow(density, cfg.densityPower)
      density = Math.min(1, density + cfg.densityFloor)

      const colorT = fbm3D(
        dx * cfg.cloudScale * 0.55 + 200,
        dy * cfg.cloudScale * 0.55 + 200,
        dz * cfg.cloudScale * 0.55 + 200,
        3
      )
      sampleGradient(cfg.colorStops, colorT, colorHelper)

      const index = (py * gridSize + px) * 4
      data[index] = lerp(baseColor.r, colorHelper.r * 255, density)
      data[index + 1] = lerp(baseColor.g, colorHelper.g * 255, density)
      data[index + 2] = lerp(baseColor.b, colorHelper.b * 255, density)
      data[index + 3] = 255
    }
  }

  return new ImageData(data, gridSize, gridSize)
}

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || navigator.maxTouchPoints > 2
}

function drawStars(context, size, count, seed, cfg, radiusScale) {
  const random = mulberry32(seed)
  for (let i = 0; i < count; i += 1) {
    const x = random() * size
    const y = random() * size
    const radius = (cfg.starMinRadius + random() * (cfg.starMaxRadius - cfg.starMinRadius)) * radiusScale
    const alpha = 0.35 + random() * 0.55
    const glowRadius = radius * cfg.starGlowMultiplier
    const gradient = context.createRadialGradient(x, y, 0, x, y, glowRadius)
    gradient.addColorStop(0, `rgba(255,255,255,${alpha})`)
    gradient.addColorStop(0.35, `rgba(210,228,255,${alpha * 0.45})`)
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = gradient
    context.beginPath()
    context.arc(x, y, glowRadius, 0, Math.PI * 2)
    context.fill()
  }
}

function buildNebulaFace(faceKey, faceIndex, cfg, textureSize, colorHelper) {
  const gridCanvas = document.createElement('canvas')
  gridCanvas.width = cfg.gridSize
  gridCanvas.height = cfg.gridSize
  gridCanvas.getContext('2d').putImageData(buildNebulaGrid(faceKey, cfg, colorHelper), 0, 0)

  const canvas = document.createElement('canvas')
  canvas.width = textureSize
  canvas.height = textureSize
  const context = canvas.getContext('2d')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(gridCanvas, 0, 0, textureSize, textureSize)

  const radiusScale = textureSize / cfg.referenceTextureSize
  drawStars(context, textureSize, cfg.starCount, cfg.seed + faceIndex * 97, cfg, radiusScale)

  return canvas
}

export function useSkybox(sceneRef) {
  const cfg = spaceConfig.nebula
  const cfgKey = JSON.stringify(cfg)

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return undefined

    const textureSize = isMobileDevice() ? Math.min(cfg.textureSize, cfg.mobileTextureSize) : cfg.textureSize
    const colorHelper = new THREE.Color()
    const faces = FACE_KEYS.map((faceKey, index) => buildNebulaFace(faceKey, index, cfg, textureSize, colorHelper))

    const texture = new THREE.CubeTexture(faces)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
    scene.background = texture

    return () => {
      if (scene.background === texture) {
        scene.background = null
      }
      texture.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneRef, cfgKey])
}
