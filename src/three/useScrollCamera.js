// Map each route to a fixed orbit segment so page tops and bottoms are exact.
import { useRef } from 'react'
import { spaceConfig } from './spaceConfig'

const { orbit, pageStops, scroll: scrollConfig, transitionLerp } = spaceConfig.camera
const TWO_PI = Math.PI * 2
const fallbackPath = pageStops[0]?.path || '/'

function buildPageSegments(stops) {
  const segments = new Map()

  for (let index = 0; index < stops.length; index += 1) {
    const stop = stops[index]
    const nextStop = stops[(index + 1) % stops.length]
    let endAngle = nextStop.angle

    while (endAngle >= stop.angle) {
      endAngle -= TWO_PI
    }

    segments.set(stop.path, {
      startAngle: stop.angle,
      endAngle,
      startHeightOffset: stop.heightOffset,
      endHeightOffset: nextStop.heightOffset,
    })
  }

  return segments
}

const pageSegments = buildPageSegments(pageStops)

function getPageSegment(pathname) {
  return pageSegments.get(pathname) || pageSegments.get(fallbackPath)
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value))
}

function orbitPos(angle, heightOffset = 0) {
  return {
    x: orbit.center.x + orbit.rx * Math.cos(angle),
    y: orbit.center.y + orbit.ry * Math.sin(angle * 0.5) + heightOffset,
    z: orbit.center.z + orbit.rz * Math.sin(angle),
  }
}

function poseForSegment(segment, progress) {
  const t = clamp01(progress)
  const angle = segment.startAngle + (segment.endAngle - segment.startAngle) * t
  const heightOffset =
    segment.startHeightOffset + (segment.endHeightOffset - segment.startHeightOffset) * t

  return orbitPos(angle, heightOffset)
}

function lerp(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  }
}

function shortestAngleDelta(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

function measureScrollRange() {
  const doc = document.documentElement
  const body = document.body
  const fullHeight = Math.max(doc.scrollHeight, body.scrollHeight)
  return Math.max(fullHeight - window.innerHeight, 0)
}

function jumpToTop() {
  const doc = document.documentElement
  const body = document.body
  const prevDocBehavior = doc.style.scrollBehavior
  const prevBodyBehavior = body.style.scrollBehavior

  doc.style.scrollBehavior = 'auto'
  body.style.scrollBehavior = 'auto'
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  doc.style.scrollBehavior = prevDocBehavior
  body.style.scrollBehavior = prevBodyBehavior
}

export function useScrollCamera(cameraRef, routePath) {
  const currentYawRef = useRef(0)
  const displayProgressRef = useRef(0)
  const pageScrollRangeRef = useRef(typeof window === 'undefined' ? 1 : Math.max(measureScrollRange(), 1))

  const routeRef = useRef(routePath)
  const transFromRef = useRef(null)
  const transToRef = useRef(null)
  const transTRef = useRef(1)
  const settleFramesRef = useRef(0)

  if (routePath !== routeRef.current) {
    const camera = cameraRef.current
    const previousSegment = getPageSegment(routeRef.current)
    transFromRef.current = camera
      ? { x: camera.position.x, y: camera.position.y, z: camera.position.z }
      : poseForSegment(previousSegment, displayProgressRef.current)

    const nextSegment = getPageSegment(routePath)
    transToRef.current = poseForSegment(nextSegment, 0)

    transTRef.current = 0
    settleFramesRef.current = 0
    displayProgressRef.current = 0
    pageScrollRangeRef.current = 1
    routeRef.current = routePath
  }

  const update = () => {
    const camera = cameraRef.current
    if (!camera) return

    if (transTRef.current < 1) {
      jumpToTop()
      displayProgressRef.current = 0
      transTRef.current = Math.min(transTRef.current + transitionLerp, 1)

      const t = transTRef.current
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      const pose = lerp(transFromRef.current, transToRef.current, ease)

      camera.position.set(pose.x, pose.y, pose.z)

      if (transTRef.current >= 1) {
        camera.position.set(transToRef.current.x, transToRef.current.y, transToRef.current.z)
        settleFramesRef.current = scrollConfig.lockFrames
      }
    } else {
      const segment = getPageSegment(routeRef.current)

      if (settleFramesRef.current > 0) {
        settleFramesRef.current -= 1
        jumpToTop()
        displayProgressRef.current = 0
        pageScrollRangeRef.current = Math.max(pageScrollRangeRef.current, measureScrollRange())
      } else {
        const scrollRange = pageScrollRangeRef.current
        const targetProgress = scrollRange > 0 ? clamp01((window.scrollY || 0) / scrollRange) : 0

        if (targetProgress <= scrollConfig.snapThreshold) {
          displayProgressRef.current = 0
        } else if (targetProgress >= 1 - scrollConfig.snapThreshold) {
          displayProgressRef.current = 1
        } else {
          // Keep page scroll -> orbit progress deterministic.
          // Frame-based smoothing can create visible catch-up snaps during heavier paint moments.
          displayProgressRef.current = targetProgress
        }
      }

      const pose = poseForSegment(segment, displayProgressRef.current)
      camera.position.set(pose.x, pose.y, pose.z)
    }

    const dx = orbit.center.x - camera.position.x
    const dz = orbit.center.z - camera.position.z
    const yawDesired = Math.atan2(-dx, -dz)
    const shouldSnapYaw = transTRef.current < 1 || settleFramesRef.current > 0

    if (shouldSnapYaw) {
      currentYawRef.current = yawDesired
    } else {
      currentYawRef.current +=
        shortestAngleDelta(currentYawRef.current, yawDesired) * scrollConfig.rotLerp
    }

    camera.rotation.y = currentYawRef.current
  }

  return { update }
}
