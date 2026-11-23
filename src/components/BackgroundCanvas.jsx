import { useEffect, useRef } from 'react'
// 3D bg orchestrator. Order per frame: sim → camera (moves origin) → sync anchors → sky pass → world pass.
import { useThree, syncSkyCamera } from '../three/useThree'
import { useSkybox } from '../three/useSkybox'
import { useLights } from '../three/useLights'
import { useStarField } from '../three/useStarField'
import { useSolarSystem } from '../three/useSolarSystem'
import { useGalaxies } from '../three/useGalaxies'
import { useComets } from '../three/useComets'
import { useScrollCamera } from '../three/useScrollCamera'
import { syncAnchors } from '../three/floatingOrigin'
import { useRoutePath } from '../context/RouteContext'
import PlanetLabels from './PlanetLabels'

export default function BackgroundCanvas() {
  const canvasRef = useRef(null)
  const routePath = useRoutePath()

  const { sceneRef, skySceneRef, cameraRef, skyCameraRef, rendererRef } = useThree(canvasRef)
  // Sky layer: infinitely far deco.
  useSkybox(skySceneRef)
  const stars = useStarField(skySceneRef)
  const galaxies = useGalaxies(skySceneRef)
  const comets = useComets(skySceneRef)
  // World layer: km, floating origin.
  useLights(sceneRef)
  const solarSystem = useSolarSystem(sceneRef, routePath === '/explore')
  const scrollCam = useScrollCamera(cameraRef, routePath)

  // Refs so the loop never re-creates.
  const scrollCamRef = useRef(scrollCam)
  scrollCamRef.current = scrollCam
  const starsRef = useRef(stars)
  starsRef.current = stars
  const solarSystemRef = useRef(solarSystem)
  solarSystemRef.current = solarSystem
  const galaxiesRef = useRef(galaxies)
  galaxiesRef.current = galaxies
  const cometsRef = useRef(comets)
  cometsRef.current = comets

  useEffect(() => {
    let animationId
    let lastTime = performance.now()
    const animate = () => {
      animationId = requestAnimationFrame(animate)
      const now = performance.now()
      const deltaSeconds = Math.min((now - lastTime) / 1000, 0.05)
      lastTime = now

      const camera = cameraRef.current
      starsRef.current.update?.(deltaSeconds)
      galaxiesRef.current.update?.(deltaSeconds)
      cometsRef.current.update?.(deltaSeconds)
      solarSystemRef.current.update?.(deltaSeconds, camera)
      scrollCamRef.current.update?.(deltaSeconds)
      syncAnchors()

      const scene = sceneRef.current
      const skyScene = skySceneRef.current
      const skyCamera = skyCameraRef.current
      const renderer = rendererRef.current
      if (scene && skyScene && camera && skyCamera && renderer) {
        camera.updateMatrixWorld()
        syncSkyCamera(camera, skyCamera)
        renderer.clear()
        renderer.render(skyScene, skyCamera)
        renderer.clearDepth()
        renderer.render(scene, camera)
      }
    }
    animate()
    return () => cancelAnimationFrame(animationId)
  }, [sceneRef, skySceneRef, cameraRef, skyCameraRef, rendererRef]) // stable deps only

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
