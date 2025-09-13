import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { createGalaxy, animateGalaxies } from '../galaxyModule'

export default function BackgroundCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000)
    camera.position.z = 150

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setClearColor(0x000000, 1)

    // Skybox (assets live under src/, Vite will bundle them)
    try {
      const loader = new THREE.CubeTextureLoader()
      const skyPaths = [
        new URL('../assets/Pictures/SkyBox/kurt/space_bk.png', import.meta.url).href,
        new URL('../assets/Pictures/SkyBox/kurt/space_dn.png', import.meta.url).href,
        new URL('../assets/Pictures/SkyBox/kurt/space_ft.png', import.meta.url).href,
        new URL('../assets/Pictures/SkyBox/kurt/space_lf.png', import.meta.url).href,
        new URL('../assets/Pictures/SkyBox/kurt/space_rt.png', import.meta.url).href,
        new URL('../assets/Pictures/SkyBox/kurt/space_up.png', import.meta.url).href,
      ]
      const skybox = loader.load(skyPaths)
      scene.background = skybox
    } catch (e) {
      // fallback keeps black background
    }

  // State containers
    const galaxies = []
    const comets = []
  const stars = []

  // Star field + planet constants (from old project)
  const STAR_COUNT = 9000
  const STAR_FIELD_RADIUS = 700
  const STAR_ROTATION_SPEED = 0.005

  // Lighting (optional with MeshBasic, but kept for parity)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
  const pointLight = new THREE.PointLight(0xffffff, 1, 500)
  pointLight.position.set(50, 50, 50)
  scene.add(ambientLight, pointLight)

    // Galaxy spawning parameters (inspired by old_main.js)
    const GALAXY_COLORS = [
      { h: 0.05, s: 0.8, l: 0.6 },
      { h: 0.6, s: 0.9, l: 0.7 },
      { h: 0.15, s: 0.7, l: 0.8 },
    ]
    const GALAXY_SPAWN_RADIUS = 1000
    const GALAXY_MAX = 24
    const GALAXY_LIFETIME_MS = 60_000 // 1 minute, then fade out and remove

    // Comet parameters (inspired by old_main.js)
    const COMET_MAX = 6
    const COMET_FIELD_RADIUS = 700

    // Helpers
    const rand = (min, max) => Math.random() * (max - min) + min
    const randSign = () => (Math.random() < 0.5 ? -1 : 1)

    function spawnGalaxy() {
      if (galaxies.length >= GALAXY_MAX) return
      const pos = new THREE.Vector3(
        rand(-GALAXY_SPAWN_RADIUS, GALAXY_SPAWN_RADIUS),
        rand(-GALAXY_SPAWN_RADIUS, GALAXY_SPAWN_RADIUS),
        rand(-GALAXY_SPAWN_RADIUS, GALAXY_SPAWN_RADIUS)
      )
      const theme = GALAXY_COLORS[Math.floor(Math.random() * GALAXY_COLORS.length)]
      const g = createGalaxy({ position: pos, colorBase: theme, scene })
      g.userData.birth = performance.now()
      galaxies.push(g)
    }

    // Comet creation (core + glow + ring + trails) — simplified from old_main.js
    function createTrailMesh(length, radius, color, opacity, segments = 64) {
      const trailGeometry = new THREE.BufferGeometry()
      const baseVertices = []
      const colors = []
      const indices = []

      // center point
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

    function spawnComet() {
      if (comets.length >= COMET_MAX) return
      const group = new THREE.Group()

      // core
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }))
      group.add(core)

      // glow
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.9, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.3, depthWrite: false })
      )
      group.add(glow)

      // halo
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.6, 1.1, 32),
        new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false })
      )
      halo.rotation.x = Math.PI / 2
      group.add(halo)

      // trails
      const trailGroup = new THREE.Group()
      const baseColor = new THREE.Color(0x66ccff)
      trailGroup.add(createTrailMesh(20, 0.8, baseColor, 0.4))
      trailGroup.add(createTrailMesh(22, 1.2, baseColor, 0.2))
      trailGroup.add(createTrailMesh(24, 1.6, baseColor, 0.08))
      group.add(trailGroup)

      // spawn at far edge toward center
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

    // =========================
    // Star Field Creation
    // =========================
    const starGeometry = new THREE.SphereGeometry(0.1, 16, 16)
    function createStar() {
      // Random star temperature color
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
      // preserve original hue for twinkle
      starMaterial.userData = { baseColor: starColor.clone() }
      const star = new THREE.Mesh(starGeometry, starMaterial)

      const radius = Math.random() * STAR_FIELD_RADIUS - STAR_FIELD_RADIUS / 2
      const theta = Math.random() * Math.PI * 2
      const x = radius * Math.cos(theta)
      const z = radius * Math.sin(theta)
      const y = Math.random() * STAR_FIELD_RADIUS - STAR_FIELD_RADIUS / 2

      star.position.set(x, y, z)
      scene.add(star)
      stars.push({ star, radius, y, speed: Math.random() * STAR_ROTATION_SPEED })
    }
    for (let i = 0; i < STAR_COUNT; i++) createStar()

    // =========================
    // Spinning Earth Planet
    // =========================
    const planetRadius = 10
    const planetVector = new THREE.Vector3(-50, 10, -50)
    const planetSize = 1
    const planetGeometry = new THREE.SphereGeometry(planetRadius, 32, 32)
    const planetMaterial = new THREE.MeshBasicMaterial()
    const planet = new THREE.Mesh(planetGeometry, planetMaterial)
    planet.position.copy(planetVector)
    planet.scale.set(planetSize, planetSize, planetSize)
    scene.add(planet)
    // Texture load (Vite-resolved path)
    try {
      const earthTexUrl = new URL('../assets/Models/Earth 3D Model/textures/1_earth_8k.jpg', import.meta.url).href
      const textureLoader = new THREE.TextureLoader()
      textureLoader.load(earthTexUrl, (tex) => {
        planetMaterial.map = tex
        planetMaterial.needsUpdate = true
      })
    } catch {}

    // Pre-warm a few galaxies/comets
    for (let i = 0; i < 6; i++) spawnGalaxy()
    for (let i = 0; i < 5; i++) spawnComet()

    // Spawning schedule using accumulated time
    let nextGalaxyAt = performance.now() + rand(1200, 3000)
    let nextCometAt = performance.now() + rand(2500, 6000)

    // Smooth, path-based camera movement tied to scroll
    const CAMERA_BASE_Z = 150
    const Z_PER_PX = 0.05
  const LATERAL_MAX = 0 // disable lateral movement per request
  const VERTICAL_MAX = 0 // disable vertical movement per request
  const MAX_YAW = Math.PI / 12 // ~11.25° (slightly increased for visibility)
    const POS_LERP = 0.06
  const ROT_LERP = 0.12

  // Scroll metrics for full document span (top -> bottom)
  let scrollMax = 1
  let currentScrollY = window.scrollY
  const computeScrollMax = () => {
    const doc = document.documentElement
    const body = document.body
    const fullHeight = Math.max(doc.scrollHeight, body.scrollHeight)
    scrollMax = Math.max(fullHeight - window.innerHeight, 1)
  }
  computeScrollMax()
  let currentYaw = 0

    function onScroll() {
      currentScrollY = window.scrollY
    }
    window.addEventListener('scroll', onScroll, { passive: true })

  let animationId
    let time = 0
  const lookObj = new THREE.Object3D()
    function animate() {
      animationId = requestAnimationFrame(animate)

      const now = performance.now()

      // spawn new objects over time
      if (now >= nextGalaxyAt) {
        spawnGalaxy()
        nextGalaxyAt = now + rand(1500, 4000)
      }
      if (now >= nextCometAt) {
        spawnComet()
        nextCometAt = now + rand(4000, 9000)
      }

      // animate galaxies (and prune old ones by lifetime with fade-out)
      galaxies.forEach((g) => {
        // simple drift
        if (!g.userData.drift) {
          g.userData.drift = new THREE.Vector3(rand(-0.02, 0.02), rand(-0.02, 0.02), rand(-0.02, 0.02))
        }
        g.position.add(g.userData.drift)
      })
      animateGalaxies(galaxies)

      // remove very old galaxies
      for (let i = galaxies.length - 1; i >= 0; i--) {
        const g = galaxies[i]
        const age = now - (g.userData.birth || now)
        if (age > GALAXY_LIFETIME_MS) {
          scene.remove(g)
          galaxies.splice(i, 1)
        }
      }

      // animate comets and orient trails
      comets.forEach(({ group, velocity, trailGroup }) => {
        group.position.add(velocity)
        // respawn when out of bounds
        if (group.position.length() > COMET_FIELD_RADIUS * 1.5) {
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

      // Update Stars (Twinkling + rotation)
      time += 0.1
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

      // Update Planet Rotation
      planet.rotation.y += 0.001

  // Compute targets from scroll (z only; no lateral/vertical movement)
  // Map yaw progression to the full document scroll span
  const t = Math.min(Math.max(currentScrollY / scrollMax, 0), 1)
  const xTarget = 0
  const yTarget = 0
  const zTarget = CAMERA_BASE_Z - currentScrollY * Z_PER_PX

  // Smoothly move position
  // Hard-pin x/y to eliminate any lateral/vertical drift
  camera.position.x = xTarget
  camera.position.y = yTarget
  camera.position.z += (zTarget - camera.position.z) * POS_LERP

  // Smoothly rotate with wrap-safe easing across the full scroll band
  // Desired yaw as a smooth monotonic function across the whole scroll band
  // Top (t=0) => +MAX_YAW, Bottom (t=1) => -MAX_YAW
  let yawDesired = MAX_YAW * (1 + 2 * t)
  // Angle wrap-safe interpolation
  const delta = Math.atan2(Math.sin(yawDesired - currentYaw), Math.cos(yawDesired - currentYaw))
  currentYaw += delta * ROT_LERP
  camera.rotation.y = currentYaw

      renderer.render(scene, camera)
    }
    animate()

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
      // Recompute scroll span metrics on resize
      computeScrollMax()
    }
  window.addEventListener('resize', onResize)

    return () => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('scroll', onScroll)
      if (animationId) cancelAnimationFrame(animationId)
      renderer.dispose()
      // Basic cleanup: remove all children
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose?.()
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.())
          else obj.material.dispose?.()
        }
      })
    }
  }, [])

  return <canvas id="bg" ref={canvasRef} className="fixed top-0 left-0 w-full h-full -z-10" />
}
