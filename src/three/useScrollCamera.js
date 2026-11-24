// Camera driver. Camera world pos = floating origin (km); camera object stays at render 0.
// Scroll page: fly between pageStops bodies at true scale (arc path, hold at stops).
// /explore: free flight, speed ∝ altitude above nearest surface → log-feel travel.
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'
import { getDeepBodies, getSolarCollisionBodies } from './solarSystemRuntime'
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
import { setCameraSpeed, setCameraThrottle, setWarp } from './cameraRuntime'
import { origin } from './floatingOrigin'
import { nearestStar } from './starRuntime'
import { setWormholeApproach, triggerWormhole } from './wormholeRuntime'
import { GALAXY_CENTER_PC, PC_KM } from './galaxyFrame'

const { pageStops, scroll: scrollConfig, explore: exploreConfig, transitionLerp } = spaceConfig.camera
const EXPLORE_PATH = '/explore'
const UP = new THREE.Vector3(0, 1, 0)
const GALAXY_CENTER_KM = new THREE.Vector3(...GALAXY_CENTER_PC).multiplyScalar(PC_KM)
const [STAR_NEAR_KM, STAR_FAR_KM] = exploreConfig.starInfluenceRangePc.map((pc) => pc * PC_KM)

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

// Solar + deep (black holes, promoted star) bodies.
function forEachBody(fn) {
  getSolarCollisionBodies().forEach(fn)
  getDeepBodies().forEach(fn)
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
  const upRef = useRef(new THREE.Vector3())
  const contactRef = useRef(new THREE.Vector3())
  const radialRef = useRef(new THREE.Vector3())
  const dqRef = useRef(new THREE.Quaternion())
  const qeRef = useRef(new THREE.Quaternion())
  const eulerRef = useRef(new THREE.Euler())
  const velocityRef = useRef(new THREE.Vector3())
  const capLogRef = useRef(null) // smoothed log(speed cap) → no jumps when nearest star/body changes
  const targetVelocityRef = useRef(new THREE.Vector3())
  const boostBlendRef = useRef(0)
  const appliedShakeRotRef = useRef({ x: 0, y: 0, z: 0 })
  // Explore orientation = qRef · euler(yaw, pitch, roll). qRef carries "up" from world-up to the
  // local vertical of a nearby body (parallel transport → no flips) → level horizon near surfaces.
  const qRefRef = useRef(new THREE.Quaternion())
  const prevUpRef = useRef(new THREE.Vector3(0, 1, 0))

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

    // Both directions: refs back to world-frame yaw/pitch, identity ref frame.
    currentYawRef.current = camera?.rotation.y ?? currentYawRef.current
    currentPitchRef.current = camera?.rotation.x ?? currentPitchRef.current
    qRefRef.current.identity()
    prevUpRef.current.copy(UP)

    if (nextIsExplore) {
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

  // Rotate toward world point (world frame → resets explore ref frame). snap = instant.
  const aimAt = (camera, lookWorld, snap) => {
    qRefRef.current.identity()
    prevUpRef.current.copy(UP)
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

  // Effective altitude, km: nearest body surface, or nearest star scaled up (far stars barely brake).
  const nearestAltitude = (position) => {
    let best = Infinity
    forEachBody((body) => {
      if (body.kind !== 'body') return
      // Portal: speed ∝ distance to singularity → horizon reachable in seconds.
      // Portal/soft: speed ∝ distance to center (singularity / galaxy core).
      const surface = body.portal || body.soft ? 0 : body.radius + (body.heightAt ? body.heightAt(position) : 0)
      best = Math.min(best, position.distanceTo(body.position) - surface)
    })
    if (nearestStar.valid) {
      const w = nearestStar.world
      const d = Math.max(Math.hypot(position.x - w.x, position.y - w.y, position.z - w.z) - nearestStar.radiusKm, 0)
      const factor = 1 + (exploreConfig.starInfluence - 1) * smoothstep(STAR_NEAR_KM, STAR_FAR_KM, d)
      best = Math.min(best, d * factor)
    }
    return best
  }

  // Returns contact normal (unit, outward) if pushed out of a surface, else null.
  const clampExplorePosition = (position) => {
    let contact = null
    const fromCenter = bodyOffsetRef.current.subVectors(position, GALAXY_CENTER_KM)
    if (fromCenter.length() > exploreConfig.maxGalaxyDistance) {
      position.copy(GALAXY_CENTER_KM).addScaledVector(fromCenter.normalize(), exploreConfig.maxGalaxyDistance)
    }

    forEachBody((body) => {
      if (body.portal || body.soft) return
      const ground = body.heightAt ? body.heightAt(position) : 0
      const minDistance = body.radius + ground + (body.kind === 'body' ? exploreConfig.minAltitude : 0)
      const offset = bodyOffsetRef.current.subVectors(position, body.position)
      if (offset.lengthSq() >= minDistance * minDistance) return
      if (offset.lengthSq() < 1e-12) offset.set(0, 1, 0)
      offset.setLength(minDistance)
      position.addVectors(body.position, offset)
      contact = contactRef.current.copy(offset).normalize()
    })

    if (nearestStar.valid) {
      const minDistance = nearestStar.radiusKm + exploreConfig.minAltitude
      const offset = bodyOffsetRef.current.set(position.x - nearestStar.world.x, position.y - nearestStar.world.y, position.z - nearestStar.world.z)
      if (offset.lengthSq() < minDistance * minDistance) {
        offset.setLength(minDistance)
        position.set(nearestStar.world.x + offset.x, nearestStar.world.y + offset.y, nearestStar.world.z + offset.z)
        contact = contactRef.current.copy(offset).normalize()
      }
    }
    return contact
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
    const amp = exploreConfig.boostShakeRotation * boostBlendRef.current
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

  // Co-moving frame: ride along with nearest body (orbit within carryRadii, spin when low).
  // Runs even while paused → planet never drifts away / rams the camera.
  const carryWithBody = () => {
    let best = null
    getSolarCollisionBodies().forEach((body) => {
      if (body.kind !== 'body' || !body.delta) return
      const ratio = (origin.distanceTo(body.position) - body.radius) / body.radius
      if (!best || ratio < best.ratio) best = { body, ratio }
    })
    if (!best || best.ratio > exploreConfig.carryRadii) return
    const { body } = best
    // Body already moved this frame: shift by delta, then spin about its axis.
    origin.add(body.delta)
    const w = 1 - smoothstep(exploreConfig.spinCarryRange[0], exploreConfig.spinCarryRange[1], best.ratio)
    if (w <= 0 || body.spinDelta === 0) return
    const q = dqRef.current.setFromAxisAngle(body.axis, body.spinDelta * w)
    origin.sub(body.position).applyQuaternion(q).add(body.position)
    qRefRef.current.premultiply(q)
    prevUpRef.current.applyQuaternion(q)
    velocityRef.current.applyQuaternion(q)
  }

  // Blend reference up: world up → local vertical of nearest surface (below localUpRange × radius).
  const transportUp = () => {
    let best = null
    forEachBody((body) => {
      if (body.kind !== 'body' || body.portal || body.soft) return
      const alt = origin.distanceTo(body.position) - body.radius - (body.heightAt ? body.heightAt(origin) : 0)
      if (!best || alt / body.radius < best.ratio) best = { body, ratio: alt / body.radius }
    })
    const [near, far] = exploreConfig.localUpRange
    const w = best ? 1 - smoothstep(near, far, best.ratio) : 0
    const up = upRef.current.copy(UP)
    if (w > 0) up.lerp(radialRef.current.subVectors(origin, best.body.position).normalize(), w).normalize()
    dqRef.current.setFromUnitVectors(prevUpRef.current, up)
    qRefRef.current.premultiply(dqRef.current)
    prevUpRef.current.copy(up)
  }

  const exitWormhole = (camera) => {
    const pose = poseRef.current
    if (!stopPose(pageStops[0], pose)) return
    origin.copy(pose.pos)
    aimAt(camera, pose.look, true)
    camera.fov = baseFovRef.current + exploreConfig.wormholeFovKick
    camera.updateProjectionMatrix()
    // Emerge drifting toward the planet, auto-brake does the rest.
    velocityRef.current
      .set(0, 0, -1)
      .applyQuaternion(camera.quaternion)
      .multiplyScalar(nearestAltitude(origin) * exploreConfig.speedPerAltitude * 0.4)
    boostBlendRef.current = 0
    capLogRef.current = null
    triggerWormhole()
  }

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
    carryWithBody()
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
    currentRollRef.current += (bankIntent * exploreConfig.bankAngle - currentRollRef.current) * expFactor(exploreConfig.bankRate, deltaSeconds)

    const targetFov = baseFovRef.current + (boostActive ? exploreConfig.boostFovIncrease : 0)
    const nextFov = camera.fov + (targetFov - camera.fov) * expFactor(exploreConfig.fovRate, deltaSeconds)
    if (Math.abs(nextFov - camera.fov) > 0.01) {
      camera.fov = nextFov
      camera.updateProjectionMatrix()
    }
    transportUp()
    eulerRef.current.set(currentPitchRef.current, currentYawRef.current, currentRollRef.current, 'YXZ')
    camera.quaternion.copy(qRefRef.current).multiply(qeRef.current.setFromEuler(eulerRef.current))
    const forward = forwardRef.current.set(0, 0, -1).applyQuaternion(camera.quaternion)

    // Speed cap ∝ altitude. Hard cap every frame = auto-brake on approach.
    const altitude = Math.max(nearestAltitude(origin), exploreConfig.minAltitude)
    // Near ground: jet regime (speed floor, gentler boost). Higher: log-scale travel.
    const jet = 1 - smoothstep(exploreConfig.jetBlendAltKm[0], exploreConfig.jetBlendAltKm[1], altitude)
    const baseSpeed = clamp(
      Math.max(altitude * exploreConfig.speedPerAltitude, exploreConfig.jetCruise * jet),
      exploreConfig.minSpeed,
      exploreConfig.maxSpeed
    )
    // Low level: everything a touch softer (small things nearby → speed changes read strongly).
    const soft = 1 - exploreConfig.jetSoften * jet
    boostBlendRef.current += ((boostActive ? 1 : 0) - boostBlendRef.current) * expFactor(exploreConfig.boostBlendRate * soft, deltaSeconds)
    const boostMultiplier = exploreConfig.boostMultiplier + (exploreConfig.jetBoostMultiplier - exploreConfig.boostMultiplier) * jet
    // Cap smoothed in log space: fast down (approach brake), slower up → no stutter when nearest star/body flips.
    const capTarget = Math.log(baseSpeed * (1 + (boostMultiplier - 1) * boostBlendRef.current))
    if (capLogRef.current === null) capLogRef.current = capTarget
    const capRate = capTarget < capLogRef.current ? exploreConfig.capDownRate : exploreConfig.capUpRate
    capLogRef.current += (capTarget - capLogRef.current) * expFactor(capRate, deltaSeconds)
    const speedCap = Math.exp(capLogRef.current)

    const moveForward = (movement.forward ? 1 : 0) - (movement.backward ? 1 : 0)
    const hasMoveInput = moveForward !== 0
    const velocity = velocityRef.current
    const target = targetVelocityRef.current.copy(forward).multiplyScalar(moveForward * speedCap)
    const reversing = hasMoveInput && velocity.dot(target) < 0

    const rate = hasMoveInput
      ? reversing ? exploreConfig.brakeAcceleration : exploreConfig.acceleration * soft
      : exploreConfig.coastDamping
    velocity.lerp(target, expFactor(rate, deltaSeconds))
    if (velocity.length() > speedCap) velocity.setLength(speedCap)
    if (!hasMoveInput && velocity.length() < exploreConfig.minSpeed * 0.05) velocity.set(0, 0, 0)

    const speed = velocity.length()
    setCameraSpeed(speed)
    setCameraThrottle(clamp01(speed / (baseSpeed * 3)))
    // Streaks only while boosting near cap.
    const warpAmount = boostBlendRef.current * smoothstep(0.3, 0.9, speed / Math.max(speedCap, 1e-9))
    if (speed > 0) setWarp(warpAmount, velocity.x / speed, velocity.y / speed, velocity.z / speed)
    else setWarp(0, 0, 0, -1)
    if (speed === 0) return false

    const next = nextPosRef.current.copy(origin).addScaledVector(velocity, deltaSeconds)
    const contact = clampExplorePosition(next)
    // Hit surface → drop only the inward part → slide along, never stuck.
    if (contact) {
      const inward = velocity.dot(contact)
      if (inward < 0) velocity.addScaledVector(contact, -inward)
    }
    origin.copy(next)

    // Portal: darken toward horizon, cross → respawn at first stop out of a white-hole flash.
    let approach = 0
    let crossed = false
    getDeepBodies().forEach((body) => {
      if (!body.portal) return
      const d = origin.distanceTo(body.position)
      approach = Math.max(approach, 1 - smoothstep(body.rsKm, body.rsKm * 2.2, d))
      if (d < body.rsKm) crossed = true
    })
    setWormholeApproach(approach)
    if (crossed) exitWormhole(camera)

    return boostActive
  }

  // ─── Scroll page ───────────────────────────────────────────────────────────

  const pinToRoute = () => {
    pinScrollToChapter(chapterOffsetForPath(routeRef.current))
    lastScrollYRef.current = window.scrollY || 0
  }

  const updateScrollRoute = (camera, deltaSeconds) => {
    if (Math.abs(camera.fov - baseFovRef.current) > 0.01) {
      camera.fov += (baseFovRef.current - camera.fov) * expFactor(exploreConfig.fovRate, deltaSeconds)
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
    // Fast scroll → mild streaks toward view center.
    camera.getWorldDirection(forwardRef.current)
    setWarp(scrollVelocityBlendRef.current * 0.6, forwardRef.current.x, forwardRef.current.y, forwardRef.current.z)
  }

  return { update }
}
