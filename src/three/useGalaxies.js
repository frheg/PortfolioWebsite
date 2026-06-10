// Spawns and animates galaxies using galaxyModule; returns update() and cleanup
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { createGalaxy, animateGalaxies } from './galaxyModule'
import { spaceConfig } from './spaceConfig'

function rand(min, max) { return Math.random() * (max - min) + min }

function spawnGalaxy(scene, galaxies, spawnRadius) {
  if (!scene || galaxies.length === undefined) return
  const pos = new THREE.Vector3(
    rand(-spawnRadius, spawnRadius),
    rand(-spawnRadius, spawnRadius),
    rand(-spawnRadius, spawnRadius)
  )
  const theme = spaceConfig.galaxies.colorThemes[Math.floor(Math.random() * spaceConfig.galaxies.colorThemes.length)]
  const g = createGalaxy({ position: pos, colorBase: theme, scene })
  galaxies.push(g)
}

export function useGalaxies(
  sceneRef,
    {
      max = spaceConfig.counts.galaxies,
      spawnRadius = Math.min(spaceConfig.half.x, spaceConfig.half.y, spaceConfig.half.z) * spaceConfig.galaxies.spawnRadiusFactor,
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
        g.userData.drift = new THREE.Vector3(
          rand(spaceConfig.galaxies.drift.min, spaceConfig.galaxies.drift.max),
          rand(spaceConfig.galaxies.drift.min, spaceConfig.galaxies.drift.max),
          rand(spaceConfig.galaxies.drift.min, spaceConfig.galaxies.drift.max)
        )
      }
      g.position.add(g.userData.drift)
    })
    animateGalaxies(galaxies)
  }

  return { update }
}
