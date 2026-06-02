// Spawns and animates comets with trails; returns update()
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'

export function useComets(
  sceneRef,
  {
    max = spaceConfig.counts.comets,
    fieldRadius = Math.max(spaceConfig.bounds.width, spaceConfig.bounds.depth) / 2,
  } = {}
) {
  const cometsRef = useRef([])
  const bounds = spaceConfig.half

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

  function spawnComet(scene, comets) {
    if (!scene || comets.length === undefined || comets.length >= max) return
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

    // Spawn at the world bounds, not in the middle of the screen
    const faces = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1),
    ]
    const face = faces[Math.floor(Math.random() * faces.length)]
    const spawnPosition = new THREE.Vector3(
      face.x !== 0 ? face.x * bounds.x : rand(-bounds.x, bounds.x),
      face.y !== 0 ? face.y * bounds.y : rand(-bounds.y, bounds.y),
      face.z !== 0 ? face.z * bounds.z : rand(-bounds.z, bounds.z)
    )
    group.position.copy(spawnPosition)

    // Velocity biased inward so comets fly through the space
    const target = new THREE.Vector3(
      rand(-bounds.x * 0.2, bounds.x * 0.2),
      rand(-bounds.y * 0.2, bounds.y * 0.2),
      rand(-bounds.z * 0.2, bounds.z * 0.2)
    )
    const toCenter = target.sub(spawnPosition).normalize()
    const offset = new THREE.Vector3(rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.3, 0.3))
    const velocity = toCenter
      .add(offset)
      .normalize()
      .multiplyScalar(rand(spaceConfig.cometSpeed.min, spaceConfig.cometSpeed.max))

    scene.add(group)
    comets.push({ group, velocity, trailGroup })
  }

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    const comets = []
    // Maintain exactly `max` comets from the start
    for (let i = 0; i < max; i++) spawnComet(scene, comets)

    cometsRef.current = comets

    return () => {
      comets.forEach(({ group }) => scene.remove(group))
      cometsRef.current = []
    }
  }, [sceneRef, max, fieldRadius, bounds.x, bounds.y, bounds.z])

  const update = () => {
    const comets = cometsRef.current
    if (!comets.length) return

    comets.forEach(({ group, velocity, trailGroup }) => {
      group.position.add(velocity)
      // Out-of-bounds check against configured world bounds
      const { x, y, z } = group.position
      if (Math.abs(x) > bounds.x || Math.abs(y) > bounds.y || Math.abs(z) > bounds.z) {
        // Respawn at a random world face with inward velocity
        const faces = [
          new THREE.Vector3(1, 0, 0),
          new THREE.Vector3(-1, 0, 0),
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(0, -1, 0),
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(0, 0, -1),
        ]
        const face = faces[Math.floor(Math.random() * faces.length)]
        const spawnPosition = new THREE.Vector3(
          face.x !== 0 ? face.x * bounds.x : rand(-bounds.x, bounds.x),
          face.y !== 0 ? face.y * bounds.y : rand(-bounds.y, bounds.y),
          face.z !== 0 ? face.z * bounds.z : rand(-bounds.z, bounds.z)
        )
        group.position.copy(spawnPosition)
        const target = new THREE.Vector3(
          rand(-bounds.x * 0.2, bounds.x * 0.2),
          rand(-bounds.y * 0.2, bounds.y * 0.2),
          rand(-bounds.z * 0.2, bounds.z * 0.2)
        )
        const toCenter = target.sub(spawnPosition).normalize()
        const offset = new THREE.Vector3(rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.3, 0.3))
        velocity.copy(
          toCenter
            .add(offset)
            .normalize()
            .multiplyScalar(rand(spaceConfig.cometSpeed.min, spaceConfig.cometSpeed.max))
        )
      }
      const axis = new THREE.Vector3(0, 0, -1)
      const dir = velocity.clone().normalize()
      const quat = new THREE.Quaternion().setFromUnitVectors(axis, dir)
      trailGroup.setRotationFromQuaternion(quat)
    })
  }

  return { update }
}
