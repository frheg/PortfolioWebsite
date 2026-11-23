// Core setup: one world scene (km, floating origin, log depth), one camera pinned at render 0.
// Background (galaxy glow) is a fullscreen pass drawn before the scene (useGalaxy.renderSky).
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'

export function useThree(canvasRef) {
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const rendererRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const { fov, near, far, clearColor } = spaceConfig.renderer

    const scene = new THREE.Scene()
    // Stays at render 0 forever. Only rotation + fov change.
    const camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, near, far)
    camera.rotation.order = 'YXZ'

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
    cameraRef.current = camera
    rendererRef.current = renderer

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose?.()
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.())
          else obj.material.dispose?.()
        }
      })
    }
  }, [canvasRef])

  return { sceneRef, cameraRef, rendererRef }
}
