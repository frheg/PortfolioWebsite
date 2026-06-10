// Creates a rotating/twinkling star field; returns update() and cleanup
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'

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
    const spriteCanvas = document.createElement('canvas')
    spriteCanvas.width = spaceConfig.starfield.sprite.size
    spriteCanvas.height = spaceConfig.starfield.sprite.size

    const context = spriteCanvas.getContext('2d')
    if (!context) return

    const center = spaceConfig.starfield.sprite.size / 2
    const gradient = context.createRadialGradient(center, center, 0, center, center, center)
    spaceConfig.starfield.sprite.gradientStops.forEach(({ offset, color: stopColor }) => {
      gradient.addColorStop(offset, stopColor)
    })
    context.fillStyle = gradient
    context.fillRect(0, 0, spaceConfig.starfield.sprite.size, spaceConfig.starfield.sprite.size)

    const spriteTexture = new THREE.CanvasTexture(spriteCanvas)
    spriteTexture.needsUpdate = true

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
      starsRef.current = null
    }
  }, [sceneRef, count, fieldRadius, rotationSpeed])

  const update = () => {
    const stars = starsRef.current
    if (!stars) return

    timeRef.current += spaceConfig.starfield.twinkle.timeStep
    const time = timeRef.current
    const {
      count: starCount,
      positions,
      colors,
      baseColors,
      radii,
      heights,
      speeds,
      positionAttribute,
      colorAttribute,
    } = stars

    for (let i = 0; i < starCount; i++) {
      const theta = time * speeds[i] + i * spaceConfig.starfield.twinkle.orbitPhaseStep
      const x = radii[i] * Math.cos(theta)
      const z = radii[i] * Math.sin(theta)
      const index = i * 3

      positions[index] = x
      positions[index + 1] = heights[i]
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
