// Spawns and animates comets with trails; returns update()
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export function useComets(sceneRef, { max = 6, fieldRadius = 700 } = {}) {
  const cometsRef = useRef([])
  const nextSpawnRef = useRef(performance.now() + rand(2500, 6000))

  function rand(min, max) { return Math.random() * (max - min) + min }

  function createTrailMesh(length, radius, color, opacity, segments = 64) {
    const trailGeometry = new THREE.BufferGeometry()
    const baseVertices = []
    const colors = []
    const indices = []

    baseVertices.push(0, 0, 0)
    colors.push(1.0, 1.0, 1.0)

    for (let j = 0; j <= segments; j++) {
      const angle = (j / segments) * Math.PI * 2
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      const z = 0
      baseVertices.push(x, y, z)
      const t = 1 - j / segments
      colors.push(color.r * t + 1.0 * (1 - t), color.g * t + 1.0 * (1 - t), color.b)
    }

    const tipIndex = baseVertices.length / 3
    baseVertices.push(0, 0, length)
    colors.push(color.r, color.g, color.b)

    for (let j = 1; j <= segments; j++) {
      indices.push(j, j + 1, tipIndex)
      indices.push(0, j + 1, j)
    }

    trailGeometry.setAttribute('position', new THREE.Float32BufferAttribute(baseVertices, 3))
    trailGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    trailGeometry.setIndex(indices)
    trailGeometry.computeVertexNormals()

    const trailMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    return new THREE.Mesh(trailGeometry, trailMaterial)
  }

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    const comets = []

    const spawnComet = () => {
      if (comets.length >= max) return
      const group = new THREE.Group()

      const core = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }))
      group.add(core)

      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.9, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.3, depthWrite: false })
      )
      group.add(glow)

      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.6, 1.1, 32),
        new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false })
      )
      halo.rotation.x = Math.PI / 2
      group.add(halo)

      const trailGroup = new THREE.Group()
      const baseColor = new THREE.Color(0x66ccff)
      trailGroup.add(createTrailMesh(20, 0.8, baseColor, 0.4))
      trailGroup.add(createTrailMesh(22, 1.2, baseColor, 0.2))
      trailGroup.add(createTrailMesh(24, 1.6, baseColor, 0.08))
      group.add(trailGroup)

      const SPAWN_DISTANCE = 1000
      const edgeAxis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
      const spawnPosition = edgeAxis.clone().multiplyScalar(SPAWN_DISTANCE)
      group.position.copy(spawnPosition)

      const toCenter = spawnPosition.clone().negate().normalize()
      const offset = new THREE.Vector3(rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.3, 0.3))
      const velocity = toCenter.add(offset).normalize().multiplyScalar(rand(0.5, 2.0))

      scene.add(group)
      comets.push({ group, velocity, trailGroup })
    }

    // pre-warm a few
    for (let i = 0; i < 5; i++) spawnComet()

    cometsRef.current = comets

    return () => {
      comets.forEach(({ group }) => scene.remove(group))
      cometsRef.current = []
    }
  }, [sceneRef, max, fieldRadius])

  const update = () => {
    const comets = cometsRef.current
    if (!comets.length) return

    comets.forEach(({ group, velocity, trailGroup }) => {
      group.position.add(velocity)
      if (group.position.length() > fieldRadius * 1.5) {
        const edgeAxis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
        const spawnPosition = edgeAxis.clone().multiplyScalar(1000)
        group.position.copy(spawnPosition)
        const toCenter = spawnPosition.clone().negate().normalize()
        const offset = new THREE.Vector3(rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.3, 0.3))
        velocity.copy(toCenter.add(offset).normalize().multiplyScalar(rand(0.5, 2.0)))
      }
      const axis = new THREE.Vector3(0, 0, -1)
      const dir = velocity.clone().normalize()
      const quat = new THREE.Quaternion().setFromUnitVectors(axis, dir)
      trailGroup.setRotationFromQuaternion(quat)
    })

    const now = performance.now()
    if (now >= nextSpawnRef.current && comets.length < max) {
      // trigger effect to spawn another comet next render by reusing same logic:
      // We simply push a request by spawning inline here using sceneRef
      const scene = sceneRef.current
      if (scene) {
        // replicate spawnComet logic
        const group = new THREE.Group()
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }))
        group.add(core)
        const glow = new THREE.Mesh(
          new THREE.SphereGeometry(0.9, 16, 16),
          new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.3, depthWrite: false })
        )
        group.add(glow)
        const halo = new THREE.Mesh(
          new THREE.RingGeometry(0.6, 1.1, 32),
          new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false })
        )
        halo.rotation.x = Math.PI / 2
        group.add(halo)
        const trailGroup = new THREE.Group()
        const baseColor = new THREE.Color(0x66ccff)
        trailGroup.add(createTrailMesh(20, 0.8, baseColor, 0.4))
        trailGroup.add(createTrailMesh(22, 1.2, baseColor, 0.2))
        trailGroup.add(createTrailMesh(24, 1.6, baseColor, 0.08))
        group.add(trailGroup)

        const SPAWN_DISTANCE = 1000
        const edgeAxis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
        const spawnPosition = edgeAxis.clone().multiplyScalar(SPAWN_DISTANCE)
        group.position.copy(spawnPosition)
        const toCenter = spawnPosition.clone().negate().normalize()
        const offset = new THREE.Vector3(rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.3, 0.3))
        const velocity = toCenter.add(offset).normalize().multiplyScalar(rand(0.5, 2.0))

        scene.add(group)
        comets.push({ group, velocity, trailGroup })
      }
      nextSpawnRef.current = now + rand(4000, 9000)
    }
  }

  return { update }
}
