// Spawns and animates galaxies using galaxyModule; returns update() and cleanup
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { createGalaxy, animateGalaxies } from './galaxyModule'
import { spaceConfig } from './spaceConfig'

const GALAXY_COLORS = [
  { h: 0.05, s: 0.8, l: 0.6 },
  { h: 0.6, s: 0.9, l: 0.7 },
  { h: 0.15, s: 0.7, l: 0.8 },
]

function rand(min, max) { return Math.random() * (max - min) + min }

function spawnGalaxy(scene, galaxies, spawnRadius) {
  if (!scene || galaxies.length === undefined) return
  const pos = new THREE.Vector3(
    rand(-spawnRadius, spawnRadius),
    rand(-spawnRadius, spawnRadius),
    rand(-spawnRadius, spawnRadius)
  )
  const theme = GALAXY_COLORS[Math.floor(Math.random() * GALAXY_COLORS.length)]
  const g = createGalaxy({ position: pos, colorBase: theme, scene })
  galaxies.push(g)
}

export function useGalaxies(
  sceneRef,
  {
    max = spaceConfig.counts.galaxies,
    spawnRadius = Math.min(spaceConfig.half.x, spaceConfig.half.y, spaceConfig.half.z) * 0.9,
  } = {}
) {
  const galaxiesRef = useRef([])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    const galaxies = []

    // Spawn all galaxies once during initialization
    for (let i = 0; i < max; i++) spawnGalaxy(scene, galaxies, spawnRadius)

    galaxiesRef.current = galaxies

    return () => {
      galaxies.forEach((g) => scene.remove(g))
      galaxiesRef.current = []
    }
  }, [sceneRef, max, spawnRadius])

  const update = () => {
    const scene = sceneRef.current
    const galaxies = galaxiesRef.current
    if (!scene || !galaxies) return

    galaxies.forEach((g) => {
      if (!g.userData.drift) {
        g.userData.drift = new THREE.Vector3(rand(-0.02, 0.02), rand(-0.02, 0.02), rand(-0.02, 0.02))
      }
      g.position.add(g.userData.drift)
    })
    animateGalaxies(galaxies)
  }

  return { update }
}
