// Creates an Earth planet; returns update() to rotate
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export function usePlanet(sceneRef) {
  const planetRef = useRef(null)

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    const planetRadius = 10
    const planetVector = new THREE.Vector3(-50, 10, -50)
    const planetSize = 1
    const planetGeometry = new THREE.SphereGeometry(planetRadius, 32, 32)
    const planetMaterial = new THREE.MeshBasicMaterial()
    const planet = new THREE.Mesh(planetGeometry, planetMaterial)
    planet.position.copy(planetVector)
    planet.scale.set(planetSize, planetSize, planetSize)
    scene.add(planet)

    try {
      const earthTexUrl = new URL('../assets/Models/Earth 3D Model/textures/1_earth_8k.jpg', import.meta.url).href
      const textureLoader = new THREE.TextureLoader()
      textureLoader.load(earthTexUrl, (tex) => {
        planetMaterial.map = tex
        planetMaterial.needsUpdate = true
      })
    } catch (_) {}

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
      planetRef.current.rotation.y += 0.001
    }
  }

  return { update }
}
