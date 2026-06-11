import { useEffect, useRef } from 'react'
// Orchestrator for the 3D background: wires together modular hooks and runs the render loop
import { useThree } from '../three/useThree'
import { useSkybox } from '../three/useSkybox'
import { useLights } from '../three/useLights'
import { useStarField } from '../three/useStarField'
import { usePlanet } from '../three/usePlanet'
import { useGalaxies } from '../three/useGalaxies'
import { useComets } from '../three/useComets'
import { useScrollCamera } from '../three/useScrollCamera'
import { useRoutePath } from '../context/RouteContext'

export default function BackgroundCanvas() {
  const canvasRef = useRef(null)
  const routePath = useRoutePath()

  // Core Three.js objects bound to this canvas
  const { sceneRef, cameraRef, rendererRef } = useThree(canvasRef)
  useSkybox(sceneRef)
  useLights(sceneRef)
  // Independent background systems
  const stars = useStarField(sceneRef)
  const planet = usePlanet(sceneRef)
  const galaxies = useGalaxies(sceneRef)
  const comets = useComets(sceneRef)
  const scrollCam = useScrollCamera(cameraRef, routePath)

  // Store update functions in refs so the animation loop never re-creates
  const scrollCamRef = useRef(scrollCam)
  scrollCamRef.current = scrollCam
  const starsRef = useRef(stars)
  starsRef.current = stars
  const planetRef = useRef(planet)
  planetRef.current = planet
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

      starsRef.current.update?.(deltaSeconds)
      planetRef.current.update?.(deltaSeconds)
      galaxiesRef.current.update?.(deltaSeconds)
      cometsRef.current.update?.(deltaSeconds)
      scrollCamRef.current.update?.(deltaSeconds)

      const scene = sceneRef.current
      const camera = cameraRef.current
      const renderer = rendererRef.current
      if (scene && camera && renderer) {
        renderer.render(scene, camera)
      }
    }
    animate()
    return () => cancelAnimationFrame(animationId)
  }, [sceneRef, cameraRef, rendererRef]) // stable deps only

  return <canvas id="bg" ref={canvasRef} className="fixed top-0 left-0 w-full h-full -z-10" />
}
