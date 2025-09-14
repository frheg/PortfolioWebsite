// Loads a cube skybox and sets scene.background
import { useEffect } from 'react'
import * as THREE from 'three'

export function useSkybox(sceneRef) {
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    let disposed = false
    try {
      const loader = new THREE.CubeTextureLoader()
      const skyPaths = [
        new URL('../assets/Pictures/SkyBox/kurt/space_bk.png', import.meta.url).href,
        new URL('../assets/Pictures/SkyBox/kurt/space_dn.png', import.meta.url).href,
        new URL('../assets/Pictures/SkyBox/kurt/space_ft.png', import.meta.url).href,
        new URL('../assets/Pictures/SkyBox/kurt/space_lf.png', import.meta.url).href,
        new URL('../assets/Pictures/SkyBox/kurt/space_rt.png', import.meta.url).href,
        new URL('../assets/Pictures/SkyBox/kurt/space_up.png', import.meta.url).href,
      ]
      const tex = loader.load(skyPaths)
      scene.background = tex
    } catch (_) {
      // keep default background
    }

    return () => {
      if (disposed) return
      // Three manages cube texture disposal when scene disposed; no-op
      disposed = true
    }
  }, [sceneRef])
}
