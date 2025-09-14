import { useEffect, useRef } from 'react'
import { useThree } from '../three/useThree'
import { useSkybox } from '../three/useSkybox'
import { useLights } from '../three/useLights'
import { useStarField } from '../three/useStarField'
import { usePlanet } from '../three/usePlanet'
import { useGalaxies } from '../three/useGalaxies'
import { useComets } from '../three/useComets'
import { useScrollCamera } from '../three/useScrollCamera'

export default function BackgroundCanvas() {
  const canvasRef = useRef(null)

  const { sceneRef, cameraRef, rendererRef } = useThree(canvasRef)
  useSkybox(sceneRef)
  useLights(sceneRef)
  const stars = useStarField(sceneRef, { count: 9000, fieldRadius: 700, rotationSpeed: 0.005 })
  const planet = usePlanet(sceneRef)
  const galaxies = useGalaxies(sceneRef, { max: 24, spawnRadius: 1000, lifetimeMs: 60000 })
  const comets = useComets(sceneRef, { max: 6, fieldRadius: 700 })
  const scrollCam = useScrollCamera(cameraRef, { baseZ: 150, zPerPx: 0.05, maxYaw: Math.PI / 12, posLerp: 0.06, rotLerp: 0.12 })

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
    return () => cancelAnimationFrame(animationId)
  }, [sceneRef, cameraRef, rendererRef, stars, planet, galaxies, comets, scrollCam])

  return <canvas id="bg" ref={canvasRef} className="fixed top-0 left-0 w-full h-full -z-10" />
}
