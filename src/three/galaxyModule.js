import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'

// One small circular sprite shared by every galaxy's star field, instead of
// each star being its own sphere mesh — same soft round-dot look, but all
// stars in a galaxy become a single Points draw call sharing one geometry,
// one material, and this one texture (mirrors useStarField's approach).
let sharedSpriteTexture = null
function getSpriteTexture() {
  if (sharedSpriteTexture) return sharedSpriteTexture

  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  const center = size / 2
  const gradient = context.createRadialGradient(center, center, 0, center, center, center)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.85)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)

  sharedSpriteTexture = new THREE.CanvasTexture(canvas)
  return sharedSpriteTexture
}

export function createGalaxy({ position, colorBase, scene }) {
  const galaxyGroup = new THREE.Group()
  galaxyGroup.position.copy(position)

  const { star, rotationSpeed } = spaceConfig.galaxies

  const positions = new Float32Array(star.count * 3)
  const colors = new Float32Array(star.count * 3)
  const color = new THREE.Color()

  for (let i = 0; i < star.count; i++) {
    const theta = Math.random() * 2 * Math.PI
    const radius = Math.random() * star.galaxySize * star.radiusFactor
    const height = (Math.random() - 0.5) * star.galaxySize * star.heightFactor

    const index = i * 3
    positions[index] = radius * Math.cos(theta)
    positions[index + 1] = height
    positions[index + 2] = radius * Math.sin(theta)

    const hueVariation = (Math.random() - 0.5) * star.hueVariation
    color.setHSL(colorBase.h + hueVariation, colorBase.s, colorBase.l)
    colors[index] = color.r
    colors[index + 1] = color.g
    colors[index + 2] = color.b
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const material = new THREE.PointsMaterial({
    size: star.size * 2.2,
    map: getSpriteTexture(),
    vertexColors: true,
    transparent: true,
    opacity: star.opacity,
    depthWrite: false,
    sizeAttenuation: true,
  })

  const points = new THREE.Points(geometry, material)
  galaxyGroup.add(points)
  galaxyGroup.userData = {
    rotationSpeed: rotationSpeed.min + Math.random() * (rotationSpeed.max - rotationSpeed.min),
    geometry,
    material,
  }
  scene.add(galaxyGroup)
  return galaxyGroup
}

export function animateGalaxies(galaxies) {
  galaxies.forEach((galaxy) => {
    galaxy.rotation.y += galaxy.userData.rotationSpeed
  })
}
