// Core setup. Two layers, one renderer:
// - sky: skybox/starfield/deco. Rotation-only cam, sky units. Drawn first.
// - world: solar system, km, floating origin. Log depth. Drawn after depth clear.
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'

export function useThree(canvasRef) {
  const sceneRef = useRef(null)
  const skySceneRef = useRef(null)
  const cameraRef = useRef(null)
  const skyCameraRef = useRef(null)
  const rendererRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const { fov, near, far, skyNear, clearColor } = spaceConfig.renderer
    const { width, height, depth } = spaceConfig.bounds
    const aspect = window.innerWidth / window.innerHeight

    const scene = new THREE.Scene()
    const skyScene = new THREE.Scene()

    // Stays at render 0 forever. Only rotation + fov change.
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far)
    camera.rotation.order = 'YXZ'
    const skyCamera = new THREE.PerspectiveCamera(fov, aspect, skyNear, Math.max(width, height, depth) * 2)

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: spaceConfig.renderer.powerPreference,
      logarithmicDepthBuffer: true,
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, spaceConfig.renderer.maxPixelRatio))
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setClearColor(clearColor, 1)
    renderer.autoClear = false
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = spaceConfig.renderer.toneMappingExposure

    sceneRef.current = scene
    skySceneRef.current = skyScene
    cameraRef.current = camera
    skyCameraRef.current = skyCamera
    rendererRef.current = renderer

    const onResize = () => {
      const nextAspect = window.innerWidth / window.innerHeight
      camera.aspect = nextAspect
      camera.updateProjectionMatrix()
      skyCamera.aspect = nextAspect
      skyCamera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      ;[scene, skyScene].forEach((s) =>
        s.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose?.()
          if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.())
            else obj.material.dispose?.()
          }
        })
      )
    }
  }, [canvasRef])

  return { sceneRef, skySceneRef, cameraRef, skyCameraRef, rendererRef }
}

// Sky cam mirrors world cam rotation + lens. No translation → sky infinitely far.
export function syncSkyCamera(camera, skyCamera) {
  skyCamera.quaternion.copy(camera.quaternion)
  if (skyCamera.fov !== camera.fov || skyCamera.aspect !== camera.aspect) {
    skyCamera.fov = camera.fov
    skyCamera.aspect = camera.aspect
    skyCamera.updateProjectionMatrix()
  }
}
