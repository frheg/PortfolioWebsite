// Map content routes to a fixed orbit segment and switch to free-flight on /explore.
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'
import {
  addExploreLook,
  consumeExploreLook,
  getExploreMovement,
  resetExploreInput,
  setExploreMove,
} from './exploreControls'

const {
  orbit,
  pageStops,
  scroll: scrollConfig,
  explore: exploreConfig,
  transitionLerp,
} = spaceConfig.camera
const TWO_PI = Math.PI * 2
const fallbackPath = pageStops[0]?.path || '/'
const EXPLORE_PATH = '/explore'

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

function isExploreRoute(pathname) {
  return pathname === EXPLORE_PATH
}

function getPageSegment(pathname) {
  return pageSegments.get(pathname) || pageSegments.get(fallbackPath)
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function clamp01(value) {
  return clamp(value, 0, 1)
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

function getKeyDirection(event) {
  switch (event.code) {
    case 'KeyW':
      return 'forward'
    case 'KeyS':
      return 'backward'
    case 'KeyA':
      return 'left'
    case 'KeyD':
      return 'right'
    case 'KeyH':
      return 'left'
    case 'KeyJ':
      return 'backward'
    case 'KeyK':
      return 'forward'
    case 'KeyL':
      return 'right'
    default:
      break
  }

  switch (event.key.toLowerCase()) {
    case 'w':
    case 'arrowup':
    case 'k':
      return 'forward'
    case 's':
    case 'arrowdown':
    case 'j':
      return 'backward'
    case 'a':
    case 'arrowleft':
    case 'h':
      return 'left'
    case 'd':
    case 'arrowright':
    case 'l':
      return 'right'
    default:
      return null
  }
}

function getTurnDirection(event) {
  switch (event.code) {
    case 'KeyQ':
      return 'yawLeft'
    case 'KeyE':
      return 'yawRight'
    default:
      return null
  }
}

function getPitchDirection(event) {
  switch (event.code) {
    case 'ShiftLeft':
    case 'ShiftRight':
      return 'pitchUp'
    case 'ControlLeft':
    case 'ControlRight':
      return 'pitchDown'
    default:
      return null
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
  const displayProgressRef = useRef(0)
  const pageScrollRangeRef = useRef(typeof window === 'undefined' ? 1 : Math.max(measureScrollRange(), 1))

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
  const planetOffsetRef = useRef(new THREE.Vector3())
  const velocityRef = useRef(new THREE.Vector3())
  const forwardSpeedRef = useRef(0)
  const rightSpeedRef = useRef(0)
  const appliedShakePosRef = useRef(new THREE.Vector3())
  const appliedShakeRotRef = useRef({ x: 0, y: 0, z: 0 })

  useEffect(() => {
    if (!isExploreRoute(routePath)) {
      resetExploreInput()
      return undefined
    }

    resetExploreInput()
    let isMouseLooking = false
    let lastMouseX = 0
    let lastMouseY = 0
    let activeTouchId = null
    let lastTouchX = 0
    let lastTouchY = 0

    const ignoreLookTarget = (target) =>
      target instanceof Element && (target.closest('nav') || target.closest('[data-explore-control]'))

    const onKeyDown = (event) => {
      const direction = getKeyDirection(event)
      if (direction) {
        event.preventDefault()
        setExploreMove(direction, true)
        return
      }

      const turnDirection = getTurnDirection(event)
      if (turnDirection) {
        event.preventDefault()
        setExploreMove(turnDirection, true)
        return
      }

      const pitchDirection = getPitchDirection(event)
      if (pitchDirection) {
        event.preventDefault()
        setExploreMove(pitchDirection, true)
        return
      }

      if (isBoostKey(event)) {
        event.preventDefault()
        setExploreMove('boost', true)
      }
    }

    const onKeyUp = (event) => {
      const direction = getKeyDirection(event)
      if (direction) {
        event.preventDefault()
        setExploreMove(direction, false)
        return
      }

      const turnDirection = getTurnDirection(event)
      if (turnDirection) {
        event.preventDefault()
        setExploreMove(turnDirection, false)
        return
      }

      const pitchDirection = getPitchDirection(event)
      if (pitchDirection) {
        event.preventDefault()
        setExploreMove(pitchDirection, false)
        return
      }

      if (isBoostKey(event)) {
        event.preventDefault()
        setExploreMove('boost', false)
      }
    }

    const onMouseDown = (event) => {
      if (event.button !== 0 || ignoreLookTarget(event.target)) return
      isMouseLooking = true
      lastMouseX = event.clientX
      lastMouseY = event.clientY
    }

    const onMouseMove = (event) => {
      if (!isMouseLooking) return
      const dx = event.clientX - lastMouseX
      const dy = event.clientY - lastMouseY
      lastMouseX = event.clientX
      lastMouseY = event.clientY
      addExploreLook(dx * exploreConfig.lookSensitivity, dy * exploreConfig.lookSensitivity)
    }

    const stopMouseLook = () => {
      isMouseLooking = false
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
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', stopMouseLook)
    window.addEventListener('mouseleave', stopMouseLook)
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', stopTouchLook)
    window.addEventListener('touchcancel', stopTouchLook)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', stopMouseLook)
      window.removeEventListener('mouseleave', stopMouseLook)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', stopTouchLook)
      window.removeEventListener('touchcancel', stopTouchLook)
      resetExploreInput()
    }
  }, [routePath])

  if (routePath !== routeRef.current) {
    const camera = cameraRef.current
    const currentIsExplore = isExploreRoute(routeRef.current)
    const nextIsExplore = isExploreRoute(routePath)
    const previousSegment = getPageSegment(routeRef.current)

    transFromRef.current = camera
      ? { x: camera.position.x, y: camera.position.y, z: camera.position.z }
      : poseForSegment(previousSegment, displayProgressRef.current)

    if (nextIsExplore) {
      currentYawRef.current = camera?.rotation.y ?? currentYawRef.current
      currentPitchRef.current = camera?.rotation.x ?? currentPitchRef.current
      velocityRef.current.set(0, 0, 0)
      forwardSpeedRef.current = 0
      rightSpeedRef.current = 0
      transToRef.current = transFromRef.current
      transTRef.current = 1
      settleFramesRef.current = 0
      routeRef.current = routePath
      if (!currentIsExplore) resetExploreInput()
    } else {
      const nextSegment = getPageSegment(routePath)
      transToRef.current = poseForSegment(nextSegment, 0)
      transTRef.current = 0
      settleFramesRef.current = 0
      displayProgressRef.current = 0
      pageScrollRangeRef.current = 1
      velocityRef.current.set(0, 0, 0)
      forwardSpeedRef.current = 0
      rightSpeedRef.current = 0
      routeRef.current = routePath
      resetExploreInput()
    }
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

    const minPlanetDistance =
      spaceConfig.planet.radius * spaceConfig.planet.scale + exploreConfig.planetClearance
    const minPlanetDistanceSq = minPlanetDistance * minPlanetDistance
    planetOffsetRef.current.set(
      position.x - spaceConfig.planet.position.x,
      position.y - spaceConfig.planet.position.y,
      position.z - spaceConfig.planet.position.z
    )

    if (planetOffsetRef.current.lengthSq() < minPlanetDistanceSq) {
      if (planetOffsetRef.current.lengthSq() < 1e-6) {
        planetOffsetRef.current.set(0, 1, 0)
      }
      planetOffsetRef.current.normalize().multiplyScalar(minPlanetDistance)
      position.set(
        spaceConfig.planet.position.x + planetOffsetRef.current.x,
        spaceConfig.planet.position.y + planetOffsetRef.current.y,
        spaceConfig.planet.position.z + planetOffsetRef.current.z
      )
    }
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
    const look = consumeExploreLook()
    const movement = getExploreMovement()
    const turnInput = (movement.yawLeft ? 1 : 0) - (movement.yawRight ? 1 : 0)
    const pitchInput = (movement.pitchUp ? 1 : 0) - (movement.pitchDown ? 1 : 0)
    const lookTurnIntent = clamp(-look.dx / 0.03, -1, 1)
    const bankIntent = clamp(turnInput + lookTurnIntent - movement.right * 0.3 + movement.left * 0.3, -1, 1)
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
    const moveRight = (movement.right ? 1 : 0) - (movement.left ? 1 : 0)
    const hasMoveInput = moveForward !== 0 || moveRight !== 0

    camera.getWorldDirection(forwardRef.current)
    rightRef.current.crossVectors(forwardRef.current, camera.up).normalize()

    const speed = exploreConfig.moveSpeed * (boostActive ? exploreConfig.boostMultiplier : 1)
    const accelPerSecond = speed * exploreConfig.acceleration
    const brakePerSecond = speed * exploreConfig.brakeAcceleration
    const coastPerSecond = exploreConfig.moveSpeed * exploreConfig.coastDamping
    const diagonalScale = hasMoveInput ? 1 / (Math.hypot(moveForward, moveRight) || 1) : 0
    const targetForwardSpeed = moveForward * diagonalScale * speed
    const targetRightSpeed = moveRight * diagonalScale * speed

    const nextForwardSpeed = stepToward(
      forwardSpeedRef.current,
      targetForwardSpeed,
      (targetForwardSpeed === 0
        ? coastPerSecond
        : Math.sign(targetForwardSpeed) !== Math.sign(forwardSpeedRef.current) && Math.abs(forwardSpeedRef.current) > 0.001
          ? brakePerSecond
          : accelPerSecond) * deltaSeconds
    )

    const nextRightSpeed = stepToward(
      rightSpeedRef.current,
      targetRightSpeed,
      (targetRightSpeed === 0
        ? coastPerSecond
        : Math.sign(targetRightSpeed) !== Math.sign(rightSpeedRef.current) && Math.abs(rightSpeedRef.current) > 0.001
          ? brakePerSecond
          : accelPerSecond) * deltaSeconds
    )

    forwardSpeedRef.current = Math.abs(nextForwardSpeed) < 0.001 ? 0 : nextForwardSpeed
    rightSpeedRef.current = Math.abs(nextRightSpeed) < 0.001 ? 0 : nextRightSpeed

    velocityRef.current.set(0, 0, 0)
    velocityRef.current.addScaledVector(forwardRef.current, forwardSpeedRef.current)
    velocityRef.current.addScaledVector(rightRef.current, rightSpeedRef.current)

    if (!hasMoveInput && velocityRef.current.lengthSq() < 0.0001) {
      forwardSpeedRef.current = 0
      rightSpeedRef.current = 0
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

    return boostActive && velocityRef.current.lengthSq() > 0.05
  }

  const updateScrollRoute = (camera) => {
    if (Math.abs(camera.fov - baseFovRef.current) > 0.01) {
      camera.fov += (baseFovRef.current - camera.fov) * Math.max(exploreConfig.fovLerp, 0.1)
      camera.updateProjectionMatrix()
    }

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
    updateScrollRoute(camera)
  }

  return { update }
}
