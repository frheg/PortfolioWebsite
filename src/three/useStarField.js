// Creates a rotating/twinkling star field; returns update() and cleanup
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'

export function useStarField(
  sceneRef,
  {
    count = spaceConfig.counts.stars,
    fieldRadius = Math.min(spaceConfig.half.x, spaceConfig.half.z),
    rotationSpeed = spaceConfig.rotationSpeed,
  } = {}
) {
  const starsRef = useRef([])
  const timeRef = useRef(0)

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    const stars = []
    const starGeometry = new THREE.SphereGeometry(0.1, 16, 16)

    function createStar() {
      const h = Math.random()
      const s = 0.6 + Math.random() * 0.4
      const l = 0.6 + Math.random() * 0.3
      const starColor = new THREE.Color().setHSL(h, s, l)
      const starMaterial = new THREE.MeshBasicMaterial({
        color: starColor,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      })
      starMaterial.userData = { baseColor: starColor.clone() }
      const star = new THREE.Mesh(starGeometry, starMaterial)

  const radius = Math.random() * fieldRadius - fieldRadius / 2
      const theta = Math.random() * Math.PI * 2
      const x = radius * Math.cos(theta)
      const z = radius * Math.sin(theta)
      const y = Math.random() * fieldRadius - fieldRadius / 2

      star.position.set(x, y, z)
      scene.add(star)
      stars.push({ star, radius, y, speed: Math.random() * rotationSpeed })
    }

    for (let i = 0; i < count; i++) createStar()

    starsRef.current = stars

    return () => {
      stars.forEach(({ star }) => {
        scene.remove(star)
        star.geometry?.dispose?.()
        star.material?.dispose?.()
      })
      starsRef.current = []
    }
  }, [sceneRef, count, fieldRadius, rotationSpeed])

  const update = () => {
    const stars = starsRef.current
    if (!stars.length) return

    timeRef.current += 0.1
    const time = timeRef.current

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i]
      const theta = time * s.speed + i * 0.05
      const x = s.radius * Math.cos(theta)
      const z = s.radius * Math.sin(theta)
      s.star.position.set(x, s.y, z)

      const intensity = Math.abs(Math.sin(time + i * 0.1)) * 1.2 + 0.3
      const baseColor = s.star.material.userData.baseColor.clone()
      s.star.material.color.copy(baseColor).multiplyScalar(intensity)
    }
  }

  return { update }
}
