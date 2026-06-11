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

function angleTo(from, to) {
  const d = Math.atan2(Math.sin(to - from), Math.cos(to - from))
  return from + d
}

export function useScrollCamera(cameraRef, routePath) {
  const scrollMaxRef = useRef(1)
  const currentScrollYRef = useRef(0)
  const currentYawRef = useRef(0)

  const routeRef = useRef(routePath)
  const transFromRef = useRef(null)
  const transToRef = useRef(null)
  const transTRef = useRef(1)
  const cooldownRef = useRef(0)

  const computeScrollMax = () => {
    const doc = document.documentElement
    const body = document.body
    const fullHeight = Math.max(doc.scrollHeight, body.scrollHeight)
    scrollMaxRef.current = Math.max(fullHeight - window.innerHeight, 1)
  }

  if (routePath !== routeRef.current) {
    const cam = cameraRef.current
    const prevPage = getPageConfig(routeRef.current)
    const prevAngle = prevPage.startAngle + currentScrollYRef.current * prevPage.anglePerPx
    transFromRef.current = cam
      ? { x: cam.position.x, y: cam.position.y, z: cam.position.z }
      : orbitPos(prevAngle, prevPage.heightOffset)

    const nextPage = getPageConfig(routePath)
    transToRef.current = orbitPos(nextPage.startAngle, nextPage.heightOffset)

    transTRef.current = 0
    cooldownRef.current = 8
    currentScrollYRef.current = 0
    routeRef.current = routePath
  }

  useEffect(() => {
    computeScrollMax()
    window.scrollTo(0, 0)
    const onResize = () => computeScrollMax()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
    }
  }, [])

  const update = () => {
    const camera = cameraRef.current
    if (!camera) return

    if (cooldownRef.current > 0) {
      cooldownRef.current--
      window.scrollTo(0, 0)
      currentScrollYRef.current = 0
    }

    if (transTRef.current < 1) {
      transTRef.current = Math.min(transTRef.current + transitionLerp, 1)
      const t = transTRef.current
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      const pos = lerp(transFromRef.current, transToRef.current, ease)
      camera.position.x = pos.x
      camera.position.y = pos.y
      camera.position.z = pos.z
    } else {
      if (cooldownRef.current <= 0) {
        const rawScroll = window.scrollY || 0
        const max = scrollMaxRef.current
        currentScrollYRef.current = Math.max(0, Math.min(rawScroll, max))
      }
      const page = getPageConfig(routeRef.current)
      const angle = page.startAngle + currentScrollYRef.current * page.anglePerPx
      const target = orbitPos(angle, page.heightOffset)
      camera.position.x += (target.x - camera.position.x) * globalScroll.posLerp
      camera.position.y += (target.y - camera.position.y) * globalScroll.posLerp
      camera.position.z += (target.z - camera.position.z) * globalScroll.posLerp
    }

    const dx = orbit.center.x - camera.position.x
    const dz = orbit.center.z - camera.position.z
    const yawDesired = Math.atan2(-dx, -dz)
    currentYawRef.current = angleTo(currentYawRef.current, yawDesired)
    currentYawRef.current += (yawDesired - currentYawRef.current) * globalScroll.rotLerp
    camera.rotation.y = currentYawRef.current
  }

  return { update }
}
