// Three.js core setup hook: creates scene, camera, renderer on a given canvas
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'

export function useThree(
  canvasRef,
  {
    fov = spaceConfig.renderer.fov,
    near = spaceConfig.renderer.near,
    far = Math.max(spaceConfig.bounds.width, spaceConfig.bounds.height, spaceConfig.bounds.depth) * 2,
    clearColor = spaceConfig.renderer.clearColor,
  } = {}
) {
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const rendererRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      fov,
      window.innerWidth / window.innerHeight,
      near,
      far
    )
    camera.position.z = spaceConfig.camera.initialZ

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: spaceConfig.renderer.powerPreference })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, spaceConfig.renderer.maxPixelRatio))
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setClearColor(clearColor, 1)

    sceneRef.current = scene
    cameraRef.current = camera
    rendererRef.current = renderer

    const onResize = () => {
      if (!rendererRef.current || !cameraRef.current) return
      cameraRef.current.aspect = window.innerWidth / window.innerHeight
      cameraRef.current.updateProjectionMatrix()
      rendererRef.current.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      // Dispose basic resources
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose?.()
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.())
          else obj.material.dispose?.()
        }
      })
    }
  }, [canvasRef, fov, near, far, clearColor])

  return { sceneRef, cameraRef, rendererRef }
}
