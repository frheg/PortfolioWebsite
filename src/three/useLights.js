// Adds ambient and point light
import { useEffect } from 'react'
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'

export function useLights(sceneRef) {
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    const ambient = new THREE.AmbientLight(spaceConfig.lights.ambient.color, spaceConfig.lights.ambient.intensity)
    const point = new THREE.PointLight(
      spaceConfig.lights.point.color,
      spaceConfig.lights.point.intensity,
      spaceConfig.lights.point.distance
    )
    point.position.set(spaceConfig.lights.point.position.x, spaceConfig.lights.point.position.y, spaceConfig.lights.point.position.z)

    scene.add(ambient, point)

    return () => {
      scene.remove(ambient)
      scene.remove(point)
    }
  }, [sceneRef])
}
