// Creates an Earth planet; returns update() to rotate
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'
import earthTexUrl from '../assets/Models/Earth 3D Model/textures/1_earth_2k.jpg'

export function usePlanet(sceneRef) {
  const planetRef = useRef(null)

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    const planetGeometry = new THREE.SphereGeometry(
      spaceConfig.planet.radius,
      spaceConfig.planet.segments.width,
      spaceConfig.planet.segments.height
    )
    const planetMaterial = new THREE.MeshBasicMaterial()
    const planet = new THREE.Mesh(planetGeometry, planetMaterial)
    planet.position.set(spaceConfig.planet.position.x, spaceConfig.planet.position.y, spaceConfig.planet.position.z)
    planet.scale.set(spaceConfig.planet.scale, spaceConfig.planet.scale, spaceConfig.planet.scale)
    scene.add(planet)

    try {
      const textureLoader = new THREE.TextureLoader()
      textureLoader.load(earthTexUrl, (tex) => {
        tex.anisotropy = spaceConfig.planet.texture.anisotropy
        planetMaterial.map = tex
        planetMaterial.needsUpdate = true
      })
    } catch {
      // Keep the planet visible even if the texture cannot be loaded.
    }

    planetRef.current = planet

    return () => {
      scene.remove(planet)
      planet.geometry?.dispose?.()
      planet.material?.dispose?.()
      planetRef.current = null
    }
  }, [sceneRef])

  const update = () => {
    if (planetRef.current) {
      planetRef.current.rotation.y += spaceConfig.planet.rotationSpeed
    }
  }

  return { update }
}
