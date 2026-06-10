// Loads a cube skybox and sets scene.background
import { useEffect } from 'react'
import * as THREE from 'three'
import skyBk from '../assets/Pictures/SkyBox/kurt/space_bk_1536.jpg'
import skyDn from '../assets/Pictures/SkyBox/kurt/space_dn_1536.jpg'
import skyFt from '../assets/Pictures/SkyBox/kurt/space_ft_1536.jpg'
import skyLf from '../assets/Pictures/SkyBox/kurt/space_lf_1536.jpg'
import skyRt from '../assets/Pictures/SkyBox/kurt/space_rt_1536.jpg'
import skyUp from '../assets/Pictures/SkyBox/kurt/space_up_1536.jpg'

export function useSkybox(sceneRef) {
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    let texture = null
    try {
      const loader = new THREE.CubeTextureLoader()
      texture = loader.load([skyBk, skyDn, skyFt, skyLf, skyRt, skyUp])
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
