// Continuous orbit around the planet; each page covers a segment of the loop
import { useEffect, useRef } from 'react'
import { spaceConfig } from './spaceConfig'

const { orbit, pages, scroll: globalScroll, transitionLerp } = spaceConfig.camera

function getPageConfig(pathname) {
  return pages[pathname] || pages['/']
}

function orbitPos(angle, heightOffset = 0) {
  return {
    x: orbit.center.x + orbit.rx * Math.cos(angle),
    y: orbit.center.y + orbit.ry * Math.sin(angle * 0.5) + heightOffset,
    z: orbit.center.z + orbit.rz * Math.sin(angle),
  }
}

function lerp(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  }
}

export function useScrollCamera(cameraRef, routePath) {
  const scrollMaxRef = useRef(1)
  const currentScrollYRef = useRef(window.scrollY)
  const currentYawRef = useRef(0)

  // Transition: fixed start/end positions, t goes 0→1
  const prevPageRef = useRef(routePath)
  const transFromRef = useRef(null)
  const transToRef = useRef(null)
  const transTRef = useRef(1)
  const transYawFromRef = useRef(0)
  const transYawToRef = useRef(0)

  const computeScrollMax = () => {
    const doc = document.documentElement
    const body = document.body
    const fullHeight = Math.max(doc.scrollHeight, body.scrollHeight)
    scrollMaxRef.current = Math.max(fullHeight - window.innerHeight, 1)
  }

  // Detect route change — snapshot current camera state as transition start
  useEffect(() => {
    if (routePath !== prevPageRef.current) {
      const cam = cameraRef.current
      transFromRef.current = cam
        ? { x: cam.position.x, y: cam.position.y, z: cam.position.z }
        : orbitPos(getPageConfig(routePath).startAngle, getPageConfig(routePath).heightOffset)

      const nextPage = getPageConfig(routePath)
      transToRef.current = orbitPos(nextPage.startAngle, nextPage.heightOffset)

      const dx = orbit.center.x - transToRef.current.x
      const dz = orbit.center.z - transToRef.current.z
      transYawToRef.current = Math.atan2(-dx, -dz)
      transYawFromRef.current = currentYawRef.current

      transTRef.current = 0
      prevPageRef.current = routePath
      currentScrollYRef.current = 0
    }
  }, [routePath, cameraRef])

  useEffect(() => {
    computeScrollMax()
    const onScroll = () => { currentScrollYRef.current = window.scrollY }
    const onResize = () => computeScrollMax()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  const update = () => {
    const camera = cameraRef.current
    if (!camera) return

    // Transition: direct interpolation between fixed start/end
    if (transTRef.current < 1) {
      transTRef.current = Math.min(transTRef.current + transitionLerp, 1)
      const t = transTRef.current
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2

      const pos = lerp(transFromRef.current, transToRef.current, ease)
      camera.position.x = pos.x
      camera.position.y = pos.y
      camera.position.z = pos.z

      currentYawRef.current = transYawFromRef.current + (transYawToRef.current - transYawFromRef.current) * ease
      camera.rotation.y = currentYawRef.current
      return
    }

    // Normal orbit movement
    const page = getPageConfig(routePath)
    const angle = page.startAngle + currentScrollYRef.current * page.anglePerPx
    const target = orbitPos(angle, page.heightOffset)

    camera.position.x += (target.x - camera.position.x) * globalScroll.posLerp
    camera.position.y += (target.y - camera.position.y) * globalScroll.posLerp
    camera.position.z += (target.z - camera.position.z) * globalScroll.posLerp

    const dx = orbit.center.x - camera.position.x
    const dz = orbit.center.z - camera.position.z
    const yawDesired = Math.atan2(-dx, -dz)
    const delta = Math.atan2(
      Math.sin(yawDesired - currentYawRef.current),
      Math.cos(yawDesired - currentYawRef.current)
    )
    currentYawRef.current += delta * globalScroll.rotLerp
    camera.rotation.y = currentYawRef.current
  }

  return { update }
}
