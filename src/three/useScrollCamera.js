// Maps scroll to camera Z and yaw; returns update()
import { useEffect, useRef } from 'react'

export function useScrollCamera(cameraRef, {
  baseZ = 150,
  zPerPx = 0.05,
  maxYaw = Math.PI / 12,
  posLerp = 0.06,
  rotLerp = 0.12,
} = {}) {
  const scrollMaxRef = useRef(1)
  const currentScrollYRef = useRef(window.scrollY)
  const currentYawRef = useRef(0)

  const computeScrollMax = () => {
    const doc = document.documentElement
    const body = document.body
    const fullHeight = Math.max(doc.scrollHeight, body.scrollHeight)
    scrollMaxRef.current = Math.max(fullHeight - window.innerHeight, 1)
  }

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

    const scrollMax = scrollMaxRef.current
    const currentScrollY = currentScrollYRef.current

    const t = Math.min(Math.max(currentScrollY / scrollMax, 0), 1)
    const xTarget = 0
    const yTarget = 0
    const zTarget = baseZ - currentScrollY * zPerPx

    camera.position.x = xTarget
    camera.position.y = yTarget
    camera.position.z += (zTarget - camera.position.z) * posLerp

    let yawDesired = maxYaw * (1 + 2 * t)
    const delta = Math.atan2(Math.sin(yawDesired - currentYawRef.current), Math.cos(yawDesired - currentYawRef.current))
    currentYawRef.current += delta * rotLerp
    camera.rotation.y = currentYawRef.current
  }

  return { update }
}
