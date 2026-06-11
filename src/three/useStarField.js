// Creates a rotating/twinkling star field; returns update() and cleanup
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { getExploreMovement } from './exploreControls'
import { spaceConfig } from './spaceConfig'

function createCircleSpriteTexture() {
  const spriteCanvas = document.createElement('canvas')
  spriteCanvas.width = spaceConfig.starfield.sprite.size
  spriteCanvas.height = spaceConfig.starfield.sprite.size

  const context = spriteCanvas.getContext('2d')
  if (!context) return null

  const center = spaceConfig.starfield.sprite.size / 2
  const gradient = context.createRadialGradient(center, center, 0, center, center, center)
  spaceConfig.starfield.sprite.gradientStops.forEach(({ offset, color: stopColor }) => {
    gradient.addColorStop(offset, stopColor)
  })
  context.fillStyle = gradient
  context.fillRect(0, 0, spaceConfig.starfield.sprite.size, spaceConfig.starfield.sprite.size)

  const texture = new THREE.CanvasTexture(spriteCanvas)
  texture.needsUpdate = true
  return texture
}

function createWarpSpriteTexture() {
  const size = spaceConfig.starfield.sprite.size
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const context = canvas.getContext('2d')
  if (!context) return null

  const center = size / 2
  const lineHeight = size * 0.12
  const horizontal = context.createLinearGradient(0, center, size, center)
  horizontal.addColorStop(0, 'rgba(255,255,255,0)')
  horizontal.addColorStop(0.2, 'rgba(125,211,252,0.18)')
  horizontal.addColorStop(0.5, 'rgba(255,255,255,0.95)')
  horizontal.addColorStop(0.8, 'rgba(192,132,252,0.18)')
  horizontal.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = horizontal
  context.fillRect(0, center - lineHeight / 2, size, lineHeight)

  const vertical = context.createLinearGradient(center, 0, center, size)
  vertical.addColorStop(0, 'rgba(255,255,255,0)')
  vertical.addColorStop(0.35, 'rgba(125,211,252,0.08)')
  vertical.addColorStop(0.5, 'rgba(255,255,255,0.35)')
  vertical.addColorStop(0.65, 'rgba(192,132,252,0.08)')
  vertical.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = vertical
  context.fillRect(center - lineHeight * 0.35, 0, lineHeight * 0.7, size)

  const core = context.createRadialGradient(center, center, 0, center, center, size * 0.18)
  core.addColorStop(0, 'rgba(255,255,255,1)')
  core.addColorStop(0.35, 'rgba(255,255,255,0.92)')
  core.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = core
  context.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.center.set(0.5, 0.5)
  texture.rotation = Math.PI / 2
  texture.needsUpdate = true
  return texture
}

export function useStarField(
  sceneRef,
  {
    count = spaceConfig.counts.stars,
    fieldRadius = Math.min(spaceConfig.half.x, spaceConfig.half.z) * spaceConfig.starfield.fieldRadiusFactor,
    rotationSpeed = spaceConfig.starfield.rotationSpeed,
  } = {}
) {
  const starsRef = useRef(null)
  const timeRef = useRef(0)
  const boostBlendRef = useRef(0)

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const baseColors = new Float32Array(count * 3)
    const radii = new Float32Array(count)
    const heights = new Float32Array(count)
    const speeds = new Float32Array(count)

    const geometry = new THREE.BufferGeometry()
    const color = new THREE.Color()
    const spriteTexture = createCircleSpriteTexture()
    const warpTexture = createWarpSpriteTexture()
    if (!spriteTexture || !warpTexture) return

    for (let i = 0; i < count; i++) {
      const h = spaceConfig.starfield.hRange.min + Math.random() * (spaceConfig.starfield.hRange.max - spaceConfig.starfield.hRange.min)
      const s = spaceConfig.starfield.sRange.min + Math.random() * (spaceConfig.starfield.sRange.max - spaceConfig.starfield.sRange.min)
      const l = spaceConfig.starfield.lRange.min + Math.random() * (spaceConfig.starfield.lRange.max - spaceConfig.starfield.lRange.min)
      color.setHSL(h, s, l)

      const radius = Math.random() * fieldRadius - fieldRadius / 2
      const theta = Math.random() * Math.PI * 2
      const x = radius * Math.cos(theta)
      const z = radius * Math.sin(theta)
      const y = Math.random() * fieldRadius - fieldRadius / 2
      const speed = Math.random() * rotationSpeed

      const index = i * 3
      positions[index] = x
      positions[index + 1] = y
      positions[index + 2] = z

      baseColors[index] = color.r
      baseColors[index + 1] = color.g
      baseColors[index + 2] = color.b
      colors[index] = color.r
      colors[index + 1] = color.g
      colors[index + 2] = color.b

      radii[i] = radius
      heights[i] = y
      speeds[i] = speed
    }

    const positionAttribute = new THREE.BufferAttribute(positions, 3)
    positionAttribute.setUsage(THREE.DynamicDrawUsage)
    const colorAttribute = new THREE.BufferAttribute(colors, 3)
    colorAttribute.setUsage(THREE.DynamicDrawUsage)

    geometry.setAttribute('position', positionAttribute)
    geometry.setAttribute('color', colorAttribute)

    const material = new THREE.PointsMaterial({
      size: spaceConfig.starfield.pointSize,
      map: spriteTexture,
      vertexColors: true,
      transparent: true,
      opacity: spaceConfig.starfield.opacity,
      depthWrite: false,
      sizeAttenuation: true,
      alphaTest: spaceConfig.starfield.alphaTest,
    })

    const starField = new THREE.Points(geometry, material)
    scene.add(starField)

      starsRef.current = {
        starField,
        geometry,
        material,
        spriteTexture,
        warpTexture,
        positionAttribute,
        colorAttribute,
        positions,
      colors,
      baseColors,
      radii,
      heights,
      speeds,
      count,
    }

    return () => {
      scene.remove(starField)
      geometry.dispose()
      material.dispose()
      spriteTexture.dispose()
      warpTexture.dispose()
      starsRef.current = null
    }
  }, [sceneRef, count, fieldRadius, rotationSpeed])

  const update = () => {
    const stars = starsRef.current
    if (!stars) return

    timeRef.current += spaceConfig.starfield.twinkle.timeStep
    const time = timeRef.current
    const boosting = getExploreMovement().boost
    const boostTarget = boosting ? 1 : 0
    boostBlendRef.current += (boostTarget - boostBlendRef.current) * spaceConfig.starfield.boost.lerp
    const boostBlend = boostBlendRef.current
    const {
      count: starCount,
      positions,
      colors,
      baseColors,
      radii,
      heights,
      speeds,
      material,
      spriteTexture,
      warpTexture,
      positionAttribute,
      colorAttribute,
    } = stars

    const spread = 1 + (spaceConfig.starfield.boost.spreadMultiplier - 1) * boostBlend
    const size = spaceConfig.starfield.pointSize * (1 + (spaceConfig.starfield.boost.sizeMultiplier - 1) * boostBlend)
    const opacity = Math.min(1, spaceConfig.starfield.opacity + spaceConfig.starfield.boost.opacityBoost * boostBlend)
    const desiredMap = boostBlend > spaceConfig.starfield.boost.textureThreshold ? warpTexture : spriteTexture

    if (material.map !== desiredMap) {
      material.map = desiredMap
      material.needsUpdate = true
    }
    material.size = size
    material.opacity = opacity

    for (let i = 0; i < starCount; i++) {
      const theta = time * speeds[i] + i * spaceConfig.starfield.twinkle.orbitPhaseStep
      const x = radii[i] * spread * Math.cos(theta)
      const z = radii[i] * spread * Math.sin(theta)
      const index = i * 3

      positions[index] = x
      positions[index + 1] = heights[i] * spread
      positions[index + 2] = z

      const intensity = Math.abs(Math.sin(time + i * spaceConfig.starfield.twinkle.colorPhaseStep)) * spaceConfig.starfield.twinkle.amplitude + spaceConfig.starfield.twinkle.base
      colors[index] = baseColors[index] * intensity
      colors[index + 1] = baseColors[index + 1] * intensity
      colors[index + 2] = baseColors[index + 2] * intensity
    }

    positionAttribute.needsUpdate = true
    colorAttribute.needsUpdate = true
  }

  return { update }
}
