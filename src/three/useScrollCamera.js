// Drives the camera along a continuous orbit path as the user scrolls the
// merged long page, and switches to free-flight on /explore.
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'
import { getSolarCollisionBodies } from './solarSystemRuntime'
import { getChapterOffsets } from './scrollChapters'
import { setScrollVelocity } from './scrollVelocity'
import {
  addExploreLook,
  consumeExploreLook,
  getExploreMovement,
  resetExploreInput,
  setExploreMove,
} from './exploreControls'
import {
  isExplorePaused,
  pauseExplore,
  resumeExplore,
  resetExplorePauseState,
  setExplorePaused,
} from './exploreState'
import { setCameraSpeed } from './cameraRuntime'

const {
  orbit,
  pageStops,
  scroll: scrollConfig,
  explore: exploreConfig,
  transitionLerp,
} = spaceConfig.camera
const EXPLORE_PATH = '/explore'

// N-1 segments across pageStops in document order — no wraparound. The
// last chapter (chat) has no segment starting at it; scroll past its
// offset just clamps at t=1 of the final segment (see findChapterPose).
function buildChapterSegments(stops) {
  const segments = []
  for (let index = 0; index < stops.length - 1; index += 1) {
    const stop = stops[index]
    const nextStop = stops[index + 1]
    segments.push({
      startAngle: stop.angle,
      endAngle: nextStop.angle,
      startHeightOffset: stop.heightOffset,
      endHeightOffset: nextStop.heightOffset,
    })
  }
  return segments
}

const chapterSegments = buildChapterSegments(pageStops)

function isExploreRoute(pathname) {
  return pathname === EXPLORE_PATH
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function clamp01(value) {
  return clamp(value, 0, 1)
}

export function orbitPos(angle, heightOffset = 0) {
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

// Pose for a chapter's own stop (t=0 of the segment starting there, or the
// end pose of the final segment for the last chapter). Used for transition
// targets/fallbacks — not used in the per-frame scroll-driven steady state.
function poseForChapterPath(path) {
  const index = pageStops.findIndex((stop) => stop.path === path)
  if (index < 0) return orbitPos(pageStops[0].angle, pageStops[0].heightOffset)
  if (index >= chapterSegments.length) {
    return poseForSegment(chapterSegments[chapterSegments.length - 1], 1)
  }
  return poseForSegment(chapterSegments[index], 0)
}

// Steady-state pose: find which pair of measured chapter offsets scrollY
// falls between, then interpolate within that segment. Falls back to the
// first chapter's start pose if offsets haven't been measured/published yet.
function findChapterPose(chapterOffsets, scrollY) {
  if (chapterOffsets.length < chapterSegments.length + 1) {
    return poseForSegment(chapterSegments[0], 0)
  }

  let index = 0
  for (let i = 1; i < chapterOffsets.length - 1; i += 1) {
    if (scrollY >= chapterOffsets[i]) index = i
  }

  const segment = chapterSegments[index]
  const segStart = chapterOffsets[index]
  const segEnd = chapterOffsets[index + 1]
  const span = Math.max(segEnd - segStart, 1)
  const t = clamp01((scrollY - segStart) / span)

  return poseForSegment(segment, t)
}

function chapterOffsetForPath(path) {
  const offsets = getChapterOffsets()
  const index = pageStops.findIndex((stop) => stop.path === path)
  if (index < 0 || index >= offsets.length) return 0
  return offsets[index]
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

function stepToward(current, target, maxDelta) {
  if (current < target) return Math.min(current + maxDelta, target)
  if (current > target) return Math.max(current - maxDelta, target)
  return target
}

function measureScrollRange() {
  const doc = document.documentElement
  const body = document.body
  const fullHeight = Math.max(doc.scrollHeight, body.scrollHeight)
  return Math.max(fullHeight - window.innerHeight, 0)
}

// Pins document scroll at a given offset (used only while easing the
// camera between /explore and the merged page — during that window scroll
// is not driving the camera, so it's held steady at the target chapter).
function pinScrollToChapter(offsetY) {
  const doc = document.documentElement
  const body = document.body
  const prevDocBehavior = doc.style.scrollBehavior
  const prevBodyBehavior = body.style.scrollBehavior

  doc.style.scrollBehavior = 'auto'
  body.style.scrollBehavior = 'auto'
  window.scrollTo({ top: offsetY, left: 0, behavior: 'auto' })
  doc.style.scrollBehavior = prevDocBehavior
  body.style.scrollBehavior = prevBodyBehavior
}

// Single unified key → explore-action map.
// Forward/back: W S arrows K J
// Yaw:          A D arrows H L
// Tilt:         E (up) Q (down)
// Boost:        Space (handled separately)
function getExploreAction(event) {
  switch (event.code) {
    case 'KeyW':      return 'forward'
    case 'KeyS':      return 'backward'
    case 'KeyA':      return 'yawLeft'
    case 'KeyD':      return 'yawRight'
    case 'KeyH':      return 'yawLeft'
    case 'KeyJ':      return 'backward'
    case 'KeyK':      return 'forward'
    case 'KeyL':      return 'yawRight'
    case 'KeyE':      return 'pitchUp'
    case 'KeyQ':      return 'pitchDown'
    case 'ArrowUp':   return 'forward'
    case 'ArrowDown': return 'backward'
    case 'ArrowLeft': return 'yawLeft'
    case 'ArrowRight':return 'yawRight'
    default:          return null
  }
}

function isBoostKey(event) {
  return event.code === 'Space'
}

export function useScrollCamera(cameraRef, routePath) {
  const baseFovRef = useRef(spaceConfig.renderer.fov)
  const boostTimeRef = useRef(0)
  const currentYawRef = useRef(0)
  const currentPitchRef = useRef(0)
  const currentRollRef = useRef(0)
  const pageScrollRangeRef = useRef(typeof window === 'undefined' ? 1 : Math.max(measureScrollRange(), 1))
  const lastScrollYRef = useRef(typeof window === 'undefined' ? 0 : window.scrollY || 0)
  const scrollVelocityBlendRef = useRef(0)

  const routeRef = useRef(routePath)
  const transFromRef = useRef(null)
  const transToRef = useRef(null)
  const transTRef = useRef(1)
  const settleFramesRef = useRef(0)

  const forwardRef = useRef(new THREE.Vector3())
  const rightRef = useRef(new THREE.Vector3())
  const upRef = useRef(new THREE.Vector3())
  const nextPosRef = useRef(new THREE.Vector3())
  const previousPosRef = useRef(new THREE.Vector3())
  const bodyOffsetRef = useRef(new THREE.Vector3())
  const velocityRef = useRef(new THREE.Vector3())
  const targetVelocityRef = useRef(new THREE.Vector3())
  const appliedShakePosRef = useRef(new THREE.Vector3())
  const appliedShakeRotRef = useRef({ x: 0, y: 0, z: 0 })

  useEffect(() => {
    if (!isExploreRoute(routePath)) {
      resetExploreInput()
      return undefined
    }

    resetExploreInput()
    resetExplorePauseState() // start paused so the overlay shows on first enter
    let activeTouchId = null
    let lastTouchX = 0
    let lastTouchY = 0
    // Fallback position-delta tracking (used when pointer lock is unavailable)
    let lastMouseX = -1
    let lastMouseY = -1

    const ignoreLookTarget = (target) =>
      target instanceof Element && (target.closest('nav') || target.closest('[data-explore-control]'))

    const onKeyDown = (event) => {
      // Pause / resume — checked before any other input
      if (event.code === 'Escape') {
        // Browser always releases pointer lock on Escape; we just mirror the pause state
        setExplorePaused(true)
        resetExploreInput()
        return
      }
      if (event.code === 'KeyP') {
        event.preventDefault()
        if (isExplorePaused()) {
          resumeExplore()
        } else {
          pauseExplore()
          resetExploreInput()
        }
        return
      }

      // Ignore all other input while paused
      if (isExplorePaused()) return

      const action = getExploreAction(event)
      if (action) {
        event.preventDefault()
        setExploreMove(action, true)
        return
      }

      if (isBoostKey(event)) {
        event.preventDefault()
        setExploreMove('boost', true)
      }
    }

    const onKeyUp = (event) => {
      if (isExplorePaused()) return

      const action = getExploreAction(event)
      if (action) {
        event.preventDefault()
        setExploreMove(action, false)
        return
      }

      if (isBoostKey(event)) {
        event.preventDefault()
        setExploreMove('boost', false)
      }
    }

    const onMouseMove = (event) => {
      if (isExplorePaused()) return

      if (document.pointerLockElement) {
        // Pointer is locked — raw movementX/Y, no edge limit
        addExploreLook(
          event.movementX * exploreConfig.lookSensitivity,
          event.movementY * exploreConfig.lookSensitivity
        )
        return
      }

      // Fallback: position-delta tracking when pointer lock is unavailable
      if (ignoreLookTarget(event.target)) {
        lastMouseX = -1
        lastMouseY = -1
        return
      }
      if (lastMouseX < 0) {
        lastMouseX = event.clientX
        lastMouseY = event.clientY
        return
      }
      const dx = event.clientX - lastMouseX
      const dy = event.clientY - lastMouseY
      lastMouseX = event.clientX
      lastMouseY = event.clientY
      addExploreLook(dx * exploreConfig.lookSensitivity, dy * exploreConfig.lookSensitivity)
    }

    const resetMouse = () => {
      lastMouseX = -1
      lastMouseY = -1
    }

    // When the browser releases pointer lock (e.g. user Alt-Tabs) → auto-pause
    const onPointerLockChange = () => {
      if (!document.pointerLockElement && !isExplorePaused()) {
        setExplorePaused(true)
        resetExploreInput()
      }
    }

    const onTouchStart = (event) => {
      if (ignoreLookTarget(event.target) || event.changedTouches.length === 0) return
      const touch = event.changedTouches[0]
      activeTouchId = touch.identifier
      lastTouchX = touch.clientX
      lastTouchY = touch.clientY
    }

    const onTouchMove = (event) => {
      if (activeTouchId === null) return
      const touch = Array.from(event.changedTouches).find((item) => item.identifier === activeTouchId)
      if (!touch) return
      event.preventDefault()
      const dx = touch.clientX - lastTouchX
      const dy = touch.clientY - lastTouchY
      lastTouchX = touch.clientX
      lastTouchY = touch.clientY
      addExploreLook(dx * exploreConfig.touchLookSensitivity, dy * exploreConfig.touchLookSensitivity)
    }

    const stopTouchLook = (event) => {
      if (activeTouchId === null) return
      const touchEnded = Array.from(event.changedTouches).some((item) => item.identifier === activeTouchId)
      if (touchEnded) {
        activeTouchId = null
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseleave', resetMouse)
    window.addEventListener('blur', resetMouse)
    document.addEventListener('pointerlockchange', onPointerLockChange)
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', stopTouchLook)
    window.addEventListener('touchcancel', stopTouchLook)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', resetMouse)
      window.removeEventListener('blur', resetMouse)
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', stopTouchLook)
      window.removeEventListener('touchcancel', stopTouchLook)
      resetExploreInput()
      pauseExplore()           // release lock + set paused
      resetExplorePauseState() // reset to paused for next visit
    }
  }, [routePath])

  // Only a genuine explore-mode boundary crossing triggers the hard
  // snap/settle transition below. Navigating between the 5 merged-page
  // routes changes routePath (e.g. via useActiveSection's scroll-sync
  // replace()) without one of these firing — scroll position keeps driving
  // the camera continuously across chapters instead.
  if (isExploreRoute(routePath) !== isExploreRoute(routeRef.current)) {
    const camera = cameraRef.current
    const nextIsExplore = isExploreRoute(routePath)

    transFromRef.current = camera
      ? { x: camera.position.x, y: camera.position.y, z: camera.position.z }
      : poseForChapterPath(routeRef.current)

    if (nextIsExplore) {
      currentYawRef.current = camera?.rotation.y ?? currentYawRef.current
      currentPitchRef.current = camera?.rotation.x ?? currentPitchRef.current
      velocityRef.current.set(0, 0, 0)
      targetVelocityRef.current.set(0, 0, 0)
      transToRef.current = transFromRef.current
      transTRef.current = 1
      settleFramesRef.current = 0
      routeRef.current = routePath
      baseFovRef.current = exploreConfig.baseFov ?? spaceConfig.renderer.fov
      resetExploreInput()
      scrollVelocityBlendRef.current = 0
      setScrollVelocity(0)
    } else {
      transToRef.current = poseForChapterPath(routePath)
      transTRef.current = 0
      settleFramesRef.current = 0
      velocityRef.current.set(0, 0, 0)
      targetVelocityRef.current.set(0, 0, 0)
      routeRef.current = routePath
      baseFovRef.current = spaceConfig.renderer.fov
      resetExploreInput()
    }
  } else {
    routeRef.current = routePath
  }

  const clampExplorePosition = (position) => {
    const movementExtent =
      Math.min(spaceConfig.half.x, spaceConfig.half.y, spaceConfig.half.z) *
      exploreConfig.moveFieldRadiusFactor *
      0.5
    const maxY = Math.max(movementExtent - exploreConfig.worldMargin, 1)
    const xzRadius = Math.max(movementExtent - exploreConfig.worldMargin, 1)

    position.y = clamp(position.y, -maxY, maxY)

    const radialLength = Math.hypot(position.x, position.z)
    if (radialLength > xzRadius) {
      const scale = xzRadius / radialLength
      position.x *= scale
      position.z *= scale
    }

    getSolarCollisionBodies().forEach((body) => {
      const minDistance = body.radius + exploreConfig.planetClearance
      const minDistanceSq = minDistance * minDistance
      bodyOffsetRef.current.set(
        position.x - body.position.x,
        position.y - body.position.y,
        position.z - body.position.z
      )

      if (bodyOffsetRef.current.lengthSq() < minDistanceSq) {
        if (bodyOffsetRef.current.lengthSq() < 1e-6) {
          bodyOffsetRef.current.set(0, 1, 0)
        }
        bodyOffsetRef.current.normalize().multiplyScalar(minDistance)
        position.set(
          body.position.x + bodyOffsetRef.current.x,
          body.position.y + bodyOffsetRef.current.y,
          body.position.z + bodyOffsetRef.current.z
        )
      }
    })
  }

  const clearAppliedShake = (camera) => {
    if (appliedShakePosRef.current.lengthSq() > 0) {
      camera.position.sub(appliedShakePosRef.current)
      appliedShakePosRef.current.set(0, 0, 0)
    }

    const appliedRotation = appliedShakeRotRef.current
    if (appliedRotation.x !== 0 || appliedRotation.y !== 0 || appliedRotation.z !== 0) {
      camera.rotation.x -= appliedRotation.x
      camera.rotation.y -= appliedRotation.y
      camera.rotation.z -= appliedRotation.z
      appliedRotation.x = 0
      appliedRotation.y = 0
      appliedRotation.z = 0
    }
  }

  const applyBoostShake = (camera, deltaSeconds) => {
    boostTimeRef.current += deltaSeconds * exploreConfig.boostShakeFrequency
    const t = boostTimeRef.current
    const posAmp = exploreConfig.boostShakeAmplitude
    const rotAmp = exploreConfig.boostShakeRotation
    const jitterX = Math.sin(t * 1.7) + Math.sin(t * 3.9 + 0.6) * 0.45
    const jitterY = Math.cos(t * 2.4 + 0.9) + Math.sin(t * 5.2 + 1.3) * 0.35
    const jitterZ = Math.sin(t * 2.1 + 2.2) + Math.cos(t * 4.7 + 0.2) * 0.3

    camera.getWorldDirection(forwardRef.current)
    rightRef.current.crossVectors(forwardRef.current, camera.up).normalize()
    upRef.current.crossVectors(rightRef.current, forwardRef.current).normalize()

    appliedShakePosRef.current
      .copy(rightRef.current)
      .multiplyScalar(jitterX * posAmp)
      .addScaledVector(upRef.current, jitterY * posAmp * 0.6)
      .addScaledVector(forwardRef.current, jitterZ * posAmp * 0.25)

    camera.position.add(appliedShakePosRef.current)

    appliedShakeRotRef.current.x = jitterY * rotAmp * 0.45
    appliedShakeRotRef.current.y = jitterX * rotAmp * 0.2
    appliedShakeRotRef.current.z = jitterZ * rotAmp

    camera.rotation.x += appliedShakeRotRef.current.x
    camera.rotation.y += appliedShakeRotRef.current.y
    camera.rotation.z += appliedShakeRotRef.current.z
  }

  const updateExplore = (camera, deltaSeconds) => {
    // Drain accumulated look even when paused to avoid stale deltas on resume
    const look = consumeExploreLook()
    if (isExplorePaused()) return false

    const movement = getExploreMovement()
    const turnInput = (movement.yawLeft ? 1 : 0) - (movement.yawRight ? 1 : 0)
    const pitchInput = (movement.pitchUp ? 1 : 0) - (movement.pitchDown ? 1 : 0)
    const lookTurnIntent = clamp(-look.dx / 0.03, -1, 1)
    const bankIntent = clamp(turnInput + lookTurnIntent, -1, 1)
    const boostActive = movement.boost && movement.forward && !movement.backward

    currentYawRef.current += turnInput * exploreConfig.keyTurnSpeed * deltaSeconds
    currentYawRef.current -= look.dx
    currentPitchRef.current = clamp(
      currentPitchRef.current + pitchInput * exploreConfig.keyPitchSpeed * deltaSeconds - look.dy,
      -exploreConfig.maxPitch,
      exploreConfig.maxPitch
    )
    currentRollRef.current += (bankIntent * exploreConfig.bankAngle - currentRollRef.current) * exploreConfig.bankLerp

    const targetFov = baseFovRef.current + (boostActive ? exploreConfig.boostFovIncrease : 0)
    const nextFov = camera.fov + (targetFov - camera.fov) * exploreConfig.fovLerp
    if (Math.abs(nextFov - camera.fov) > 0.01) {
      camera.fov = nextFov
      camera.updateProjectionMatrix()
    }

    camera.rotation.x = currentPitchRef.current
    camera.rotation.y = currentYawRef.current
    camera.rotation.z = currentRollRef.current

    const moveForward = (movement.forward ? 1 : 0) - (movement.backward ? 1 : 0)
    const hasMoveInput = moveForward !== 0

    camera.getWorldDirection(forwardRef.current)

    const speed = exploreConfig.moveSpeed * (boostActive ? exploreConfig.boostMultiplier : 1)
    const accelPerSecond = speed * exploreConfig.acceleration
    const brakePerSecond = speed * exploreConfig.brakeAcceleration
    const coastPerSecond = exploreConfig.moveSpeed * exploreConfig.coastDamping

    targetVelocityRef.current.set(0, 0, 0)
    if (hasMoveInput) {
      targetVelocityRef.current.addScaledVector(forwardRef.current, moveForward * speed)
    }

    const reversing =
      hasMoveInput &&
      velocityRef.current.lengthSq() > 0.0001 &&
      targetVelocityRef.current.lengthSq() > 0.0001 &&
      velocityRef.current.dot(targetVelocityRef.current) < 0

    const maxDelta = (hasMoveInput
      ? reversing
        ? brakePerSecond
        : accelPerSecond
      : coastPerSecond) * deltaSeconds

    velocityRef.current.set(
      stepToward(velocityRef.current.x, targetVelocityRef.current.x, maxDelta),
      stepToward(velocityRef.current.y, targetVelocityRef.current.y, maxDelta),
      stepToward(velocityRef.current.z, targetVelocityRef.current.z, maxDelta)
    )

    if (!hasMoveInput && velocityRef.current.lengthSq() < 0.0001) {
      velocityRef.current.set(0, 0, 0)
    }

    if (velocityRef.current.lengthSq() === 0) return false

    previousPosRef.current.copy(camera.position)
    nextPosRef.current.copy(camera.position)
    nextPosRef.current.addScaledVector(velocityRef.current, deltaSeconds)
    clampExplorePosition(nextPosRef.current)
    camera.position.copy(nextPosRef.current)

    if (camera.position.distanceToSquared(previousPosRef.current) < velocityRef.current.lengthSq() * deltaSeconds * deltaSeconds * 0.25) {
      velocityRef.current.multiplyScalar(0.2)
    }

    // Publish real-time speed for the audio system
    setCameraSpeed(velocityRef.current.length())

    return boostActive && velocityRef.current.lengthSq() > 0.05
  }

  const updateScrollRoute = (camera, deltaSeconds) => {
    if (Math.abs(camera.fov - baseFovRef.current) > 0.01) {
      camera.fov += (baseFovRef.current - camera.fov) * Math.max(exploreConfig.fovLerp, 0.1)
      camera.updateProjectionMatrix()
    }

    if (transTRef.current < 1) {
      pinScrollToChapter(chapterOffsetForPath(routeRef.current))
      lastScrollYRef.current = window.scrollY || 0
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
      // Keep self-correcting, not just right after a transition — on a
      // fresh/direct load there's no transition to trigger a remeasure, so
      // the very first (pre-layout) guess would otherwise stick for the
      // whole visit while images/fonts/lazy content still grow the page.
      pageScrollRangeRef.current = Math.max(pageScrollRangeRef.current, measureScrollRange())

      if (settleFramesRef.current > 0) {
        settleFramesRef.current -= 1
        pinScrollToChapter(chapterOffsetForPath(routeRef.current))
        lastScrollYRef.current = window.scrollY || 0
      } else {
        const scrollY = window.scrollY || 0
        const pose = findChapterPose(getChapterOffsets(), scrollY)
        camera.position.set(pose.x, pose.y, pose.z)

        const scrollRange = pageScrollRangeRef.current || 1
        const rawVelocity = Math.abs(scrollY - lastScrollYRef.current) / scrollRange / Math.max(deltaSeconds, 1 / 120)
        lastScrollYRef.current = scrollY
        const velocityTarget = clamp01(rawVelocity / scrollConfig.velocityBoostThreshold)
        scrollVelocityBlendRef.current += (velocityTarget - scrollVelocityBlendRef.current) * scrollConfig.velocityLerp
        setScrollVelocity(scrollVelocityBlendRef.current)
      }
    }

    const dx = orbit.center.x - camera.position.x
    const dz = orbit.center.z - camera.position.z
    const yawDesired = Math.atan2(-dx, -dz)
    const shouldSnapYaw = transTRef.current < 1 || settleFramesRef.current > 0

    currentPitchRef.current = transTRef.current < 1
      ? currentPitchRef.current + (0 - currentPitchRef.current) * 0.12
      : 0
    currentRollRef.current += (0 - currentRollRef.current) * 0.14

    if (shouldSnapYaw) {
      currentYawRef.current = yawDesired
    } else {
      currentYawRef.current +=
        shortestAngleDelta(currentYawRef.current, yawDesired) * scrollConfig.rotLerp
    }

    camera.rotation.x = currentPitchRef.current
    camera.rotation.y = currentYawRef.current
    camera.rotation.z = currentRollRef.current
  }

  const update = (deltaSeconds = 1 / 60) => {
    const camera = cameraRef.current
    if (!camera) return

    clearAppliedShake(camera)

    if (isExploreRoute(routeRef.current)) {
      const boosting = updateExplore(camera, deltaSeconds)
      if (boosting) {
        applyBoostShake(camera, deltaSeconds)
      } else {
        boostTimeRef.current = 0
      }
      return
    }

    boostTimeRef.current = 0
    setCameraSpeed(0) // not in explore — reset so audio returns to idle
    updateScrollRoute(camera, deltaSeconds)
  }

  return { update }
}
