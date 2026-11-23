// Camera driver. Camera world pos = floating origin (km); camera object stays at render 0.
// Scroll page: fly between pageStops bodies at true scale (arc path, hold at stops).
// /explore: free flight, speed ∝ altitude above nearest surface → log-feel travel.
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
import { setCameraSpeed, setCameraThrottle } from './cameraRuntime'
import { origin } from './floatingOrigin'

const { pageStops, scroll: scrollConfig, explore: exploreConfig, transitionLerp } = spaceConfig.camera
const EXPLORE_PATH = '/explore'
const UP = new THREE.Vector3(0, 1, 0)

function isExploreRoute(pathname) {
  return pathname === EXPLORE_PATH
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function clamp01(value) {
  return clamp(value, 0, 1)
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function shortestAngleDelta(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

// Frame-rate independent lerp factor.
function expFactor(rate, dt) {
  return 1 - Math.exp(-rate * dt)
}

function findBody(key) {
  return getSolarCollisionBodies().find((body) => body.key === key) ?? null
}

// ─── Scroll poses ────────────────────────────────────────────────────────────

const makePose = () => ({ pos: new THREE.Vector3(), look: new THREE.Vector3() })
const _toSun = new THREE.Vector3()
const _right = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _camRight = new THREE.Vector3()
const _ctrl = new THREE.Vector3()

// Stop pose: offset from body in sun-relative frame. False if body not ready.
function stopPose(stop, out) {
  const body = findBody(stop.body)
  if (!body) return false

  _toSun.copy(body.position).negate() // sun at world 0
  if (_toSun.lengthSq() < 1) _toSun.set(1, 0, 0)
  _toSun.normalize()
  _right.crossVectors(_toSun, UP).normalize()

  _dir
    .copy(_toSun)
    .multiplyScalar(Math.cos(stop.azimuth))
    .addScaledVector(_right, Math.sin(stop.azimuth))
    .multiplyScalar(Math.cos(stop.elevation))
    .addScaledVector(UP, Math.sin(stop.elevation))
    .normalize()

  const r = body.radius
  out.pos.copy(body.position).addScaledVector(_dir, stop.distance * r)
  // cam right = forward × up, forward = -dir
  _camRight.crossVectors(_dir, UP).negate().normalize()
  out.look
    .copy(body.position)
    .addScaledVector(_camRight, stop.lookShiftX * r)
    .addScaledVector(UP, stop.lookShiftY * r)
  return true
}

function chapterPose(path, out) {
  const index = Math.max(0, pageStops.findIndex((stop) => stop.path === path))
  return stopPose(pageStops[index], out)
}

// Quadratic bezier a→b, control lifted above ecliptic. out must not alias a/b.
function arcPoint(a, b, t, out) {
  const lift = a.distanceTo(b) * scrollConfig.arcLift
  _ctrl.addVectors(a, b).multiplyScalar(0.5).addScaledVector(UP, lift)
  const u = 1 - t
  out.set(
    u * u * a.x + 2 * u * t * _ctrl.x + t * t * b.x,
    u * u * a.y + 2 * u * t * _ctrl.y + t * t * b.y,
    u * u * a.z + 2 * u * t * _ctrl.z + t * t * b.z
  )
  return out
}

const _poseA = makePose()
const _poseB = makePose()

// Scroll → segment index + t → arc between stop poses. Hold near stops.
function scrollPose(scrollY, out) {
  const raw = getChapterOffsets()
  if (raw.length < pageStops.length) return stopPose(pageStops[0], out)
  // Short last chapter can't scroll to its top → clamp, else final stop never reached.
  const maxScroll = measureScrollRange()
  const offsets = raw.map((offset) => Math.min(offset, maxScroll))

  let index = 0
  for (let i = 1; i < offsets.length - 1; i += 1) {
    if (scrollY >= offsets[i]) index = i
  }
  const span = Math.max(offsets[index + 1] - offsets[index], 1)
  const t = clamp01((scrollY - offsets[index]) / span)
  const e = smoothstep(scrollConfig.holdStart, scrollConfig.holdEnd, t)

  if (!stopPose(pageStops[index], _poseA) || !stopPose(pageStops[index + 1], _poseB)) return false
  arcPoint(_poseA.pos, _poseB.pos, e, out.pos)
  out.look.lerpVectors(_poseA.look, _poseB.look, e)
  return true
}

function chapterOffsetForPath(path) {
  const offsets = getChapterOffsets()
  const index = pageStops.findIndex((stop) => stop.path === path)
  if (index < 0 || index >= offsets.length) return 0
  return offsets[index]
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
  const aimedRef = useRef(false) // first valid pose snaps rotation + places camera
  const pageScrollRangeRef = useRef(typeof window === 'undefined' ? 1 : Math.max(measureScrollRange(), 1))
  const lastScrollYRef = useRef(typeof window === 'undefined' ? 0 : window.scrollY || 0)
  const scrollVelocityBlendRef = useRef(0)

  const routeRef = useRef(routePath)
  const transFromRef = useRef(new THREE.Vector3())
  const transTRef = useRef(1)
  const settleFramesRef = useRef(0)

  const poseRef = useRef(makePose())
  const nextPosRef = useRef(new THREE.Vector3())
  const bodyOffsetRef = useRef(new THREE.Vector3())
  const aimRef = useRef(new THREE.Vector3())
  const forwardRef = useRef(new THREE.Vector3())
  const velocityRef = useRef(new THREE.Vector3())
  const targetVelocityRef = useRef(new THREE.Vector3())
  const boostBlendRef = useRef(0)
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

  // Explore boundary crossing → transition. Chapter-to-chapter changes don't
  // trigger this; scroll drives camera continuously.
  if (isExploreRoute(routePath) !== isExploreRoute(routeRef.current)) {
    const camera = cameraRef.current
    const nextIsExplore = isExploreRoute(routePath)
    transFromRef.current.copy(origin)
    velocityRef.current.set(0, 0, 0)
    targetVelocityRef.current.set(0, 0, 0)
    boostBlendRef.current = 0
    settleFramesRef.current = 0
    resetExploreInput()

    if (nextIsExplore) {
      currentYawRef.current = camera?.rotation.y ?? currentYawRef.current
      currentPitchRef.current = camera?.rotation.x ?? currentPitchRef.current
      transTRef.current = 1
      baseFovRef.current = exploreConfig.baseFov ?? spaceConfig.renderer.fov
      scrollVelocityBlendRef.current = 0
      setScrollVelocity(0)
    } else {
      transTRef.current = 0
      baseFovRef.current = spaceConfig.renderer.fov
    }
  }
  routeRef.current = routePath

  // ─── Shared helpers ────────────────────────────────────────────────────────

  // Rotate toward world point. snap = instant.
  const aimAt = (camera, lookWorld, snap) => {
    const d = aimRef.current.subVectors(lookWorld, origin)
    const yawDesired = Math.atan2(-d.x, -d.z)
    const pitchDesired = Math.atan2(d.y, Math.hypot(d.x, d.z))
    if (snap) {
      currentYawRef.current = yawDesired
      currentPitchRef.current = pitchDesired
    } else {
      currentYawRef.current += shortestAngleDelta(currentYawRef.current, yawDesired) * scrollConfig.rotLerp
      currentPitchRef.current += (pitchDesired - currentPitchRef.current) * scrollConfig.rotLerp
    }
    currentRollRef.current += (0 - currentRollRef.current) * 0.14
    camera.rotation.set(currentPitchRef.current, currentYawRef.current, currentRollRef.current)
  }

  // Altitude above nearest body surface, km.
  const nearestAltitude = (position) => {
    let best = Infinity
    getSolarCollisionBodies().forEach((body) => {
      if (body.kind !== 'body') return
      best = Math.min(best, position.distanceTo(body.position) - body.radius)
    })
    return best
  }

  const clampExplorePosition = (position) => {
    if (position.length() > exploreConfig.maxSunDistance) position.setLength(exploreConfig.maxSunDistance)

    getSolarCollisionBodies().forEach((body) => {
      const minDistance = body.radius + (body.kind === 'body' ? exploreConfig.minAltitude : 0)
      const offset = bodyOffsetRef.current.subVectors(position, body.position)
      if (offset.lengthSq() >= minDistance * minDistance) return
      if (offset.lengthSq() < 1e-12) offset.set(0, 1, 0)
      offset.setLength(minDistance)
      position.addVectors(body.position, offset)
    })
  }

  // Rotation-only shake. Positional shake meaningless across 12 decades of scale.
  const clearAppliedShake = (camera) => {
    const r = appliedShakeRotRef.current
    if (r.x === 0 && r.y === 0 && r.z === 0) return
    camera.rotation.x -= r.x
    camera.rotation.y -= r.y
    camera.rotation.z -= r.z
    r.x = 0
    r.y = 0
    r.z = 0
  }

  const applyBoostShake = (camera, deltaSeconds) => {
    boostTimeRef.current += deltaSeconds * exploreConfig.boostShakeFrequency
    const t = boostTimeRef.current
    const amp = exploreConfig.boostShakeRotation
    const jitterX = Math.sin(t * 1.7) + Math.sin(t * 3.9 + 0.6) * 0.45
    const jitterY = Math.cos(t * 2.4 + 0.9) + Math.sin(t * 5.2 + 1.3) * 0.35
    const jitterZ = Math.sin(t * 2.1 + 2.2) + Math.cos(t * 4.7 + 0.2) * 0.3
    const r = appliedShakeRotRef.current
    r.x = jitterY * amp * 0.45
    r.y = jitterX * amp * 0.2
    r.z = jitterZ * amp
    camera.rotation.x += r.x
    camera.rotation.y += r.y
    camera.rotation.z += r.z
  }

  // ─── Explore ───────────────────────────────────────────────────────────────

  const updateExplore = (camera, deltaSeconds) => {
    // Drain look even when paused → no stale deltas on resume.
    const look = consumeExploreLook()
    // Fresh load on /explore: origin still 0 (inside sun) → place at first stop.
    if (!aimedRef.current) {
      const pose = poseRef.current
      if (!stopPose(pageStops[0], pose)) return false
      origin.copy(pose.pos)
      aimAt(camera, pose.look, true)
      aimedRef.current = true
    }
    if (isExplorePaused()) return false

    const movement = getExploreMovement()
    const turnInput = (movement.yawLeft ? 1 : 0) - (movement.yawRight ? 1 : 0)
    const pitchInput = (movement.pitchUp ? 1 : 0) - (movement.pitchDown ? 1 : 0)
    const lookTurnIntent = clamp(-look.dx / 0.03, -1, 1)
    const bankIntent = clamp(turnInput + lookTurnIntent, -1, 1)
    const boostActive = movement.boost && movement.forward && !movement.backward

    currentYawRef.current += turnInput * exploreConfig.keyTurnSpeed * deltaSeconds - look.dx
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
    camera.rotation.set(currentPitchRef.current, currentYawRef.current, currentRollRef.current)

    // YXZ euler → forward. Roll doesn't move it.
    const yaw = currentYawRef.current
    const pitch = currentPitchRef.current
    const forward = forwardRef.current.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch))

    // Speed cap ∝ altitude. Hard cap every frame = auto-brake on approach.
    const altitude = Math.max(nearestAltitude(origin), exploreConfig.minAltitude)
    const baseSpeed = clamp(altitude * exploreConfig.speedPerAltitude, exploreConfig.minSpeed, exploreConfig.maxSpeed)
    boostBlendRef.current += ((boostActive ? 1 : 0) - boostBlendRef.current) * expFactor(exploreConfig.boostBlendRate, deltaSeconds)
    const speedCap = baseSpeed * (1 + (exploreConfig.boostMultiplier - 1) * boostBlendRef.current)

    const moveForward = (movement.forward ? 1 : 0) - (movement.backward ? 1 : 0)
    const hasMoveInput = moveForward !== 0
    const velocity = velocityRef.current
    const target = targetVelocityRef.current.copy(forward).multiplyScalar(moveForward * speedCap)
    const reversing = hasMoveInput && velocity.dot(target) < 0

    const rate = hasMoveInput
      ? reversing ? exploreConfig.brakeAcceleration : exploreConfig.acceleration
      : exploreConfig.coastDamping
    velocity.lerp(target, expFactor(rate, deltaSeconds))
    if (velocity.length() > speedCap) velocity.setLength(speedCap)
    if (!hasMoveInput && velocity.length() < exploreConfig.minSpeed * 0.05) velocity.set(0, 0, 0)

    const speed = velocity.length()
    setCameraSpeed(speed)
    setCameraThrottle(clamp01(speed / (baseSpeed * 3)))
    if (speed === 0) return false

    const next = nextPosRef.current.copy(origin).addScaledVector(velocity, deltaSeconds)
    clampExplorePosition(next)
    // Blocked by surface → bleed speed.
    if (next.distanceTo(origin) < speed * deltaSeconds * 0.5) velocity.multiplyScalar(0.2)
    origin.copy(next)

    return boostActive
  }

  // ─── Scroll page ───────────────────────────────────────────────────────────

  const pinToRoute = () => {
    pinScrollToChapter(chapterOffsetForPath(routeRef.current))
    lastScrollYRef.current = window.scrollY || 0
  }

  const updateScrollRoute = (camera, deltaSeconds) => {
    if (Math.abs(camera.fov - baseFovRef.current) > 0.01) {
      camera.fov += (baseFovRef.current - camera.fov) * Math.max(exploreConfig.fovLerp, 0.1)
      camera.updateProjectionMatrix()
    }

    const pose = poseRef.current

    // Explore → page: arc from where we were to route's stop. Scroll pinned meanwhile.
    if (transTRef.current < 1) {
      pinToRoute()
      transTRef.current = Math.min(transTRef.current + transitionLerp, 1)
      const t = transTRef.current
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      if (chapterPose(routeRef.current, pose)) {
        arcPoint(transFromRef.current, pose.pos, ease, origin)
        aimAt(camera, pose.look, false)
      }
      if (transTRef.current >= 1) settleFramesRef.current = scrollConfig.lockFrames
      return
    }

    // Page keeps growing as images/fonts load → keep remeasuring.
    pageScrollRangeRef.current = Math.max(pageScrollRangeRef.current, measureScrollRange())

    if (settleFramesRef.current > 0) {
      settleFramesRef.current -= 1
      pinToRoute()
      if (chapterPose(routeRef.current, pose)) {
        origin.copy(pose.pos)
        aimAt(camera, pose.look, false)
      }
      return
    }

    const scrollY = window.scrollY || 0
    if (scrollPose(scrollY, pose)) {
      origin.copy(pose.pos)
      aimAt(camera, pose.look, !aimedRef.current)
      aimedRef.current = true
    }

    const scrollRange = pageScrollRangeRef.current || 1
    const rawVelocity = Math.abs(scrollY - lastScrollYRef.current) / scrollRange / Math.max(deltaSeconds, 1 / 120)
    lastScrollYRef.current = scrollY
    const velocityTarget = clamp01(rawVelocity / scrollConfig.velocityBoostThreshold)
    scrollVelocityBlendRef.current += (velocityTarget - scrollVelocityBlendRef.current) * scrollConfig.velocityLerp
    setScrollVelocity(scrollVelocityBlendRef.current)
  }

  const update = (deltaSeconds = 1 / 60) => {
    const camera = cameraRef.current
    if (!camera) return

    clearAppliedShake(camera)

    if (isExploreRoute(routeRef.current)) {
      if (updateExplore(camera, deltaSeconds)) applyBoostShake(camera, deltaSeconds)
      else boostTimeRef.current = 0
      return
    }

    boostTimeRef.current = 0
    setCameraSpeed(0)
    setCameraThrottle(0)
    updateScrollRoute(camera, deltaSeconds)
  }

  return { update }
}
