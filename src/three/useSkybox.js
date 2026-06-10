// Loads a cube skybox and sets scene.background
import { useEffect } from 'react'
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'

export function useSkybox(sceneRef) {
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    let texture = null
    try {
      const loader = new THREE.CubeTextureLoader()
      const { faces } = spaceConfig.skybox
      const skyPaths = [
        new URL(faces.back, import.meta.url).href,
        new URL(faces.down, import.meta.url).href,
        new URL(faces.front, import.meta.url).href,
        new URL(faces.left, import.meta.url).href,
        new URL(faces.right, import.meta.url).href,
        new URL(faces.up, import.meta.url).href,
      ]
      texture = loader.load(skyPaths)
      scene.background = texture
    } catch {
      // Keep the default background if the skybox cannot be loaded.
    }

    return () => {
      if (scene.background === texture) {
        scene.background = null
      }
      texture?.dispose?.()
    }
  }, [sceneRef])
}
