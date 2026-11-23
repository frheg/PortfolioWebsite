// Ambient only. Sun point light lives on sun anchor (useSolarSystem) → follows floating origin.
import { useEffect } from 'react'
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'

export function useLights(sceneRef) {
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    const ambient = new THREE.AmbientLight(spaceConfig.lights.ambient.color, spaceConfig.lights.ambient.intensity)
    scene.add(ambient)

    return () => {
      scene.remove(ambient)
    }
  }, [sceneRef])
}
