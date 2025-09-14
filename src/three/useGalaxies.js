// Spawns and animates galaxies using galaxyModule; returns update() and cleanup
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { createGalaxy, animateGalaxies } from '../galaxyModule'

export function useGalaxies(sceneRef, { max = 24, spawnRadius = 1000, lifetimeMs = 60000 } = {}) {
  const galaxiesRef = useRef([])
  const nextSpawnRef = useRef(performance.now() + rand(1200, 3000))

  function rand(min, max) { return Math.random() * (max - min) + min }

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    const GALAXY_COLORS = [
      { h: 0.05, s: 0.8, l: 0.6 },
      { h: 0.6, s: 0.9, l: 0.7 },
      { h: 0.15, s: 0.7, l: 0.8 },
    ]

    const galaxies = []

    const spawnGalaxy = () => {
      if (galaxies.length >= max) return
      const pos = new THREE.Vector3(
        rand(-spawnRadius, spawnRadius),
        rand(-spawnRadius, spawnRadius),
        rand(-spawnRadius, spawnRadius)
      )
      const theme = GALAXY_COLORS[Math.floor(Math.random() * GALAXY_COLORS.length)]
      const g = createGalaxy({ position: pos, colorBase: theme, scene })
      g.userData.birth = performance.now()
      galaxies.push(g)
    }

    // pre-warm a few
    for (let i = 0; i < 6; i++) spawnGalaxy()

    galaxiesRef.current = galaxies

    return () => {
      galaxies.forEach((g) => scene.remove(g))
      galaxiesRef.current = []
    }
  }, [sceneRef, max, spawnRadius, lifetimeMs])

  const update = () => {
    const scene = sceneRef.current
    const galaxies = galaxiesRef.current
    if (!scene || !galaxies) return

    const now = performance.now()

    // spawn new over time
    if (now >= nextSpawnRef.current) {
      // use the same spawn logic as in effect
      const GALAXY_COLORS = [
        { h: 0.05, s: 0.8, l: 0.6 },
        { h: 0.6, s: 0.9, l: 0.7 },
        { h: 0.15, s: 0.7, l: 0.8 },
      ]
      const pos = new THREE.Vector3(
        rand(-spawnRadius, spawnRadius),
        rand(-spawnRadius, spawnRadius),
        rand(-spawnRadius, spawnRadius)
      )
      const theme = GALAXY_COLORS[Math.floor(Math.random() * GALAXY_COLORS.length)]
      const g = createGalaxy({ position: pos, colorBase: theme, scene })
      g.userData.birth = now
      galaxies.push(g)
      nextSpawnRef.current = now + rand(1500, 4000)
    }

    galaxies.forEach((g) => {
      if (!g.userData.drift) {
        g.userData.drift = new THREE.Vector3(rand(-0.02, 0.02), rand(-0.02, 0.02), rand(-0.02, 0.02))
      }
      g.position.add(g.userData.drift)
    })
    animateGalaxies(galaxies)

    // prune old
    for (let i = galaxies.length - 1; i >= 0; i--) {
      const g = galaxies[i]
      const age = now - (g.userData.birth || now)
      if (age > lifetimeMs) {
        scene.remove(g)
        galaxies.splice(i, 1)
      }
    }
  }

  return { update }
}
