import { useEffect, useRef } from 'react'
// 3D bg orchestrator. Per frame: sim → camera (moves origin) → sync anchors → galaxy update → render pipeline (useGalaxy).
import { useThree } from '../three/useThree'
import { useLights } from '../three/useLights'
import { useSolarSystem } from '../three/useSolarSystem'
import { useGalaxy } from '../three/useGalaxy'
import { useScrollCamera } from '../three/useScrollCamera'
import { origin, syncAnchors } from '../three/floatingOrigin'
import { useRoutePath } from '../context/RouteContext'
import PlanetLabels from './PlanetLabels'

export default function BackgroundCanvas() {
  const canvasRef = useRef(null)
  const routePath = useRoutePath()

  const { sceneRef, cameraRef, rendererRef } = useThree(canvasRef)
  useLights(sceneRef)
  const solarSystem = useSolarSystem(sceneRef, routePath === '/explore', rendererRef)
  const galaxy = useGalaxy(sceneRef, rendererRef)
  const scrollCam = useScrollCamera(cameraRef, routePath)

  // Refs so the loop never re-creates.
  const scrollCamRef = useRef(scrollCam)
  scrollCamRef.current = scrollCam
  const solarSystemRef = useRef(solarSystem)
  solarSystemRef.current = solarSystem
  const galaxyRef = useRef(galaxy)
  galaxyRef.current = galaxy

  // Dev only: console/test handle → jump cam anywhere (explore, paused): __space.origin.set(...)
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined
    window.__space = { origin, cameraRef, sceneRef }
    return () => {
      delete window.__space
    }
  }, [cameraRef, sceneRef])

  useEffect(() => {
    let animationId
    let lastTime = performance.now()
    const animate = () => {
      animationId = requestAnimationFrame(animate)
      const now = performance.now()
      const deltaSeconds = Math.min((now - lastTime) / 1000, 0.05)
      lastTime = now

      const scene = sceneRef.current
      const camera = cameraRef.current
      const renderer = rendererRef.current
      if (!scene || !camera || !renderer) return

      solarSystemRef.current.update?.(deltaSeconds, camera)
      scrollCamRef.current.update?.(deltaSeconds)
      syncAnchors()
      camera.updateMatrixWorld()
      galaxyRef.current.update?.(deltaSeconds, camera, renderer)

      galaxyRef.current.render?.(renderer, scene, camera, deltaSeconds)
    }
    animate()
    return () => cancelAnimationFrame(animationId)
  }, [sceneRef, cameraRef, rendererRef]) // stable deps only

  return (
    <>
      <canvas id="bg" ref={canvasRef} className="fixed top-0 left-0 w-full h-full -z-10" />
      <PlanetLabels
        cameraRef={cameraRef}
        rendererRef={rendererRef}
        isExplore={routePath === '/explore'}
      />
    </>
  )
}
