// Adds ambient and point light
import { useEffect } from 'react'
import * as THREE from 'three'

export function useLights(sceneRef) {
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    const ambient = new THREE.AmbientLight(0xffffff, 0.5)
    const point = new THREE.PointLight(0xffffff, 1, 500)
    point.position.set(50, 50, 50)

    scene.add(ambient, point)

    return () => {
      scene.remove(ambient)
      scene.remove(point)
    }
  }, [sceneRef])
}
