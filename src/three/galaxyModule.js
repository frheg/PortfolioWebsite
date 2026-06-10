import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'

export function createGalaxy({ position, colorBase, scene }) {
  const galaxyGroup = new THREE.Group()
  galaxyGroup.position.copy(position)

  const { star, rotationSpeed } = spaceConfig.galaxies

  for (let i = 0; i < star.count; i++) {
    const theta = Math.random() * 2 * Math.PI
    const radius = Math.random() * star.galaxySize * star.radiusFactor
    const height = (Math.random() - 0.5) * star.galaxySize * star.heightFactor

    const x = radius * Math.cos(theta)
    const z = radius * Math.sin(theta)
    const y = height

    const hueVariation = (Math.random() - 0.5) * star.hueVariation
    const color = new THREE.Color().setHSL(
      colorBase.h + hueVariation,
      colorBase.s,
      colorBase.l
    )

    const starMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: star.opacity,
      depthWrite: false,
    })

    const galaxyStar = new THREE.Mesh(new THREE.SphereGeometry(star.size, star.segments, star.segments), starMaterial)
    galaxyStar.position.set(x, y, z)
    galaxyGroup.add(galaxyStar)
  }

  galaxyGroup.userData = {
    rotationSpeed: rotationSpeed.min + Math.random() * (rotationSpeed.max - rotationSpeed.min),
  }
  scene.add(galaxyGroup)
  return galaxyGroup
}

export function animateGalaxies(galaxies) {
  galaxies.forEach((galaxy) => {
    galaxy.rotation.y += galaxy.userData.rotationSpeed
  })
}
