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

  useEffect(() => {
    let animationId
    const animate = () => {
      animationId = requestAnimationFrame(animate)
      // run updates
      stars.update?.()
      planet.update?.()
      galaxies.update?.()
      comets.update?.()
      scrollCam.update?.()

      const scene = sceneRef.current
      const camera = cameraRef.current
      const renderer = rendererRef.current
      if (scene && camera && renderer) {
        renderer.render(scene, camera)
      }
    }
    animate()
    // Cancel RAF on unmount; hooks handle object/event cleanup
    return () => cancelAnimationFrame(animationId)
  }, [sceneRef, cameraRef, rendererRef, stars, planet, galaxies, comets, scrollCam])

  return <canvas id="bg" ref={canvasRef} className="fixed top-0 left-0 w-full h-full -z-10" />
}
