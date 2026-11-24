// Camera driver. Camera world pos = floating origin (km); camera object stays at render 0.
// Scroll page: hold at pageStops (Bergen → Earth → Sgr A* → Milky Way → Andromeda), fly between them
// through the empty scroll gaps on a log-scale ("powers of ten") path.
// /explore: free flight, speed ∝ altitude above nearest surface → log-feel travel.
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'
import { getDeepBodies, getSolarCollisionBodies } from './solarSystemRuntime'
import { setTerrainFocus } from './earthTerrain'
import { isSceneLoadReady, setIntroDone, setSceneVisible } from '../utils/sceneLoadingState'
import { getChapterOffsets, getTravelRanges, setHomeProgress } from './scrollChapters'
import { blackHoles, galaxies, nebulae } from '../data/deepSpaceObjects'
import { getCometWorld } from './comets'
import { diskBasis } from './neighborGalaxies'
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
import { setCameraSpeed, setCameraThrottle, setMist, setTunnel, setWarp } from './cameraRuntime'
import { origin } from './floatingOrigin'
import { nearestStar } from './starRuntime'
import { setWormholeApproach, triggerWormhole } from './wormholeRuntime'
import { AU_KM, GALAXY_AXES, GALAXY_CENTER_PC, PC_KM, SUN_RADIUS_KM, galaxyKpcToScene, raDecToScene } from './galaxyFrame'

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
// Pose: pos (world km), look (world point), up (unit), scale (km to subject → log travel scale), quat (orientation).

const makePose = () => ({ pos: new THREE.Vector3(), look: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), scale: 1, quat: new THREE.Quaternion() })
const DEG = Math.PI / 180
const ZERO = new THREE.Vector3()
const blackHoleDefs = Object.fromEntries(blackHoles.map((d) => [d.key, d]))
const galaxyDefs = Object.fromEntries(galaxies.map((d) => [d.key, d]))
const galaxyBasis = new Map()
const _toSun = new THREE.Vector3()
const _right = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _camRight = new THREE.Vector3()
const _ctrl = new THREE.Vector3()
const _e1 = new THREE.Vector3()
const _e2 = new THREE.Vector3()
const _e3 = new THREE.Vector3()
const _m4 = new THREE.Matrix4()
const _euler = new THREE.Euler()
const _qA = new THREE.Quaternion()
const _qB = new THREE.Quaternion()

// Camera orientation looking along dir with up (−z = dir).
function lookQuat(dir, up, out) {
  _e3.copy(up)
  if (Math.abs(_e3.dot(dir) / Math.max(dir.length(), 1e-30)) > 0.999) _e3.set(up.z, up.x, up.y) // degenerate → any perpendicular-ish
  _m4.lookAt(ZERO, dir, _e3)
  return out.setFromRotationMatrix(_m4)
}

// Sun azimuth (deg from N) at sunrise / sunset today for latitude, sun altDeg above horizon. Polar → due S / N fallback.
function sunEventAzimuth(event, latDeg, altDeg = 2) {
  const now = new Date()
  const doy = (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.UTC(now.getUTCFullYear(), 0, 0)) / 86400000
  const decl = -23.44 * Math.cos(((2 * Math.PI) / 365) * (doy + 10)) * DEG
  const phi = latDeg * DEG
  const h = altDeg * DEG
  const cosA = (Math.sin(decl) - Math.sin(phi) * Math.sin(h)) / (Math.cos(phi) * Math.cos(h))
  const A = Math.acos(Math.min(1, Math.max(-1, cosA))) / DEG
  return event === 'sunrise' ? A : 360 - A
}

// Bergen-style: point on Earth's spinning surface (body frameQ), heading/pitch in local ENU.
function surfacePose(stop, out) {
  const earth = findBody('earth')
  if (!earth?.frameQ) return false
  const la = stop.lat * DEG
  const lo = stop.lon * DEG
  const up = _e1.set(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo)).applyQuaternion(earth.frameQ)
  const east = _e2.set(-Math.sin(lo), 0, -Math.cos(lo)).applyQuaternion(earth.frameQ)
  const north = _e3.crossVectors(up, east)
  const headingDeg = typeof stop.heading === 'string' ? sunEventAzimuth(stop.heading, stop.lat) + (stop.headingOffset ?? 0) : stop.heading
  const h = headingDeg * DEG
  const pt = stop.pitch * DEG
  _dir.copy(north).multiplyScalar(Math.cos(h)).addScaledVector(east, Math.sin(h)).multiplyScalar(Math.cos(pt)).addScaledVector(up, Math.sin(pt))
  out.pos.copy(earth.position).addScaledVector(up, earth.radius + stop.alt)
  out.look.copy(out.pos).addScaledVector(_dir, stop.lookKm)
  out.up.copy(up)
  out.scale = stop.lookKm
  return true
}

// Orbit pose: offset from body in sun-relative frame.
function bodyPose(stop, out) {
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
  _camRight.crossVectors(_dir, UP).negate().normalize() // cam right = forward × up, forward = −dir
  out.look.copy(body.position).addScaledVector(_camRight, stop.lookShiftX * r).addScaledVector(UP, stop.lookShiftY * r)
  out.up.copy(UP)
  out.scale = stop.distance * r
  return true
}

// Black hole: inclination from its disk normal (disk mesh Euler = def.tilt).
function blackHolePose(stop, out) {
  const bh = getDeepBodies().find((d) => d.key === `bh_${stop.key}`)
  const def = blackHoleDefs[stop.key]
  if (!bh || !def) return false
  _euler.set(def.tilt?.[0] ?? 0, 0, def.tilt?.[1] ?? 0)
  const n = _e1.set(0, 0, 1).applyEuler(_euler)
  const x = _e2.set(1, 0, 0).applyEuler(_euler)
  const y = _e3.crossVectors(n, x)
  const inc = stop.inclination * DEG
  const az = stop.azimuth * DEG
  _dir.copy(x).multiplyScalar(Math.cos(az)).addScaledVector(y, Math.sin(az)).multiplyScalar(Math.sin(inc)).addScaledVector(n, Math.cos(inc))
  const rs = bh.rsKm ?? bh.radius
  out.pos.copy(bh.position).addScaledVector(_dir, stop.distanceRs * rs)
  out.look.copy(bh.position)
  out.up.copy(n)
  out.scale = stop.distanceRs * rs
  return true
}

// Galaxy-frame placement (kpc).
function galacticPose(stop, out) {
  out.pos.set(...galaxyKpcToScene(...stop.pos)).multiplyScalar(PC_KM)
  out.look.set(...galaxyKpcToScene(...stop.look)).multiplyScalar(PC_KM)
  out.up.set(...GALAXY_AXES.z)
  out.scale = out.pos.distanceTo(out.look)
  return true
}

// Neighbor galaxy: inclination from its disk normal (same basis as its sprites).
function galaxyPose(stop, out) {
  const def = galaxyDefs[stop.key]
  if (!def) return false
  if (!galaxyBasis.has(stop.key)) {
    const c = raDecToScene(def.ra, def.dec, def.dist)
    galaxyBasis.set(stop.key, { center: new THREE.Vector3(...c).multiplyScalar(PC_KM), ...diskBasis(def) })
  }
  const { center, major, minor, normal } = galaxyBasis.get(stop.key)
  const inc = stop.inclination * DEG
  const az = stop.azimuth * DEG
  _dir.copy(major).multiplyScalar(Math.cos(az)).addScaledVector(minor, Math.sin(az)).multiplyScalar(Math.sin(inc)).addScaledVector(normal, Math.cos(inc))
  out.scale = stop.distanceKpc * 1000 * PC_KM
  out.pos.copy(center).addScaledVector(_dir, out.scale)
  out.look.copy(center)
  out.up.copy(normal)
  return true
}

// ─── Sightings (via) ──
// Center + view distance by type; camera sits beside the leg's line (offset sideways + a bit back) → glance, not collision.
const nebulaDefs = Object.fromEntries(nebulae.map((d) => [d.key, d]))
const _viaC = new THREE.Vector3()
const _viaD = new THREE.Vector3()
const _viaS = new THREE.Vector3()
function viaCenter(via) {
  switch (via.type) {
    case 'sun':
      return { c: _viaC.set(0, 0, 0), view: SUN_RADIUS_KM * via.viewRadii, up: UP }
    case 'comet': {
      const w = getCometWorld(via.key)
      return w ? { c: _viaC.copy(w), view: via.viewKm, up: UP } : null
    }
    case 'point':
      return { c: _viaC.set(...raDecToScene(via.ra, via.dec, via.distPc)).multiplyScalar(PC_KM), view: via.viewAU * AU_KM, up: UP }
    case 'nebula': {
      const d = nebulaDefs[via.key]
      if (!d) return null
      return { c: _viaC.set(...raDecToScene(d.ra, d.dec, d.dist)).multiplyScalar(PC_KM), view: d.radius * via.viewRadii * PC_KM, up: _viaS.set(...GALAXY_AXES.z) }
    }
    default:
      return null
  }
}
function viaPose(via, from, to, out) {
  if (via.type === 'surface') {
    if (!surfacePose(via, out)) return false
    lookQuat(_dir.subVectors(out.look, out.pos), out.up, out.quat)
    return true
  }
  const v = viaCenter(via)
  if (!v) return false
  _viaD.subVectors(to, from).normalize()
  const up = out.up.copy(v.up)
  _right.crossVectors(_viaD, up)
  if (_right.lengthSq() < 1e-8) _right.set(1, 0, 0)
  _right.normalize()
  out.look.copy(v.c)
  out.pos.copy(v.c).addScaledVector(_right, v.view * 0.8).addScaledVector(_viaD, -v.view * 0.6)
  out.scale = v.view
  lookQuat(_dir.subVectors(out.look, out.pos), out.up, out.quat)
  return true
}
const _viaPoses = Array.from({ length: 6 }, makePose)

const POSE_BY_TYPE = { surface: surfacePose, body: bodyPose, blackhole: blackHolePose, galactic: galacticPose, galaxy: galaxyPose }

const _orbitQ = new THREE.Quaternion()

// Stop pose incl. orientation. h: hold progress 0..1 → orbit (h − ½)·2·orbitDeg round the subject (about up).
// False if its target isn't ready yet.
const _holdPose = makePose()
const _holdQ = new THREE.Quaternion()
function stopPose(stop, out, h = 0) {
  const fn = POSE_BY_TYPE[stop.type ?? 'body']
  if (!fn || !fn(stop, out)) return false
  if (stop.hold) {
    // Scripted hold: base pose → hold pose (same type), arc lifted along up, orientation slerp.
    if (!fn({ ...stop, ...stop.hold }, _holdPose)) return false
    lookQuat(_dir.subVectors(out.look, out.pos), out.up, out.quat)
    lookQuat(_dir.subVectors(_holdPose.look, _holdPose.pos), _holdPose.up, _holdQ)
    const e = h * h * (3 - 2 * h)
    const lift = out.pos.distanceTo(_holdPose.pos) * 0.12 * Math.sin(Math.PI * e)
    out.pos.lerp(_holdPose.pos, e).addScaledVector(out.up, lift)
    out.look.lerp(_holdPose.look, e)
    out.up.lerp(_holdPose.up, e).normalize()
    out.scale += (_holdPose.scale - out.scale) * e
    out.quat.slerp(_holdQ, e)
    return true
  }
  const deg = stop.orbitDeg ?? scrollConfig.orbitDeg
  if (deg) {
    const e = h * h * (3 - 2 * h)
    _orbitQ.setFromAxisAngle(out.up, (e - 0.5) * 2 * deg * DEG)
    out.pos.sub(out.look).applyQuaternion(_orbitQ).add(out.look)
  }
  lookQuat(_dir.subVectors(out.look, out.pos), out.up, out.quat)
  return true
}

// Pose the camera has with the page scrolled to this chapter's top (same as scrolling there).
function chapterPose(path, out) {
  if (getTravelRanges().length === pageStops.length - 1) return scrollPose(chapterOffsetForPath(path), out)
  const index = Math.max(0, pageStops.findIndex((stop) => stop.path === path))
  return stopPose(pageStops[index], out)
}

// "Powers of ten" travel: distance from A grows ×, distance to B shrinks × → every scale on the way gets
// screen time. Quadratic bezier (control bulged along bulgeDir) → no flying through bodies.
function travelPos(pa, ra, pb, rb, t, bulgeDir, out) {
  const D = pa.distanceTo(pb)
  if (D < 1e-9) return out.copy(pb)
  const e = t * t * (3 - 2 * t)
  const x = e <= 0.5 ? ra * (Math.pow(1 + D / (2 * ra), 2 * e) - 1) : D - rb * (Math.pow(1 + D / (2 * rb), 2 * (1 - e)) - 1)
  const u = Math.min(Math.max(x / D, 0), 1)
  _ctrl.addVectors(pa, pb).multiplyScalar(0.5).addScaledVector(bulgeDir, D * scrollConfig.arcLift)
  const v = 1 - u
  return out.set(
    v * v * pa.x + 2 * v * u * _ctrl.x + u * u * pb.x,
    v * v * pa.y + 2 * v * u * _ctrl.y + u * u * pb.y,
    v * v * pa.z + 2 * v * u * _ctrl.z + u * u * pb.z
  )
}

const _poseA = makePose()
const _poseB = makePose()
const _bulge = new THREE.Vector3()

// Leg A→B at t: log-scale position; keep watching what we leave, then turn to the destination.
function travelPose(a, b, t, out, turn = scrollConfig.lookTurn) {
  _bulge.addVectors(a.up, b.up)
  if (_bulge.lengthSq() < 1e-6) _bulge.copy(a.up)
  _bulge.normalize()
  travelPos(a.pos, a.scale, b.pos, b.scale, t, _bulge, out.pos)
  lookQuat(_dir.subVectors(a.look, out.pos), a.up, _qA)
  lookQuat(_dir.subVectors(b.look, out.pos), b.up, _qB)
  const [t0, t1] = turn
  out.quat.copy(_qA).slerp(_qB, t1 <= t0 ? (t >= t1 ? 1 : 0) : smoothstep(t0, t1, t))
  return true
}

// Intro shot: slow sway orbit round the Milky Way (galaxy frame), looking at its center.
const _introAxisZ = new THREE.Vector3()
function introPose(time, out) {
  const [x, y, z] = scrollConfig.introPos
  const a = Math.sin(time * scrollConfig.introSwayRate) * scrollConfig.introSway
  const gx = x * Math.cos(a) - y * Math.sin(a)
  const gy = x * Math.sin(a) + y * Math.cos(a)
  out.pos.set(...galaxyKpcToScene(gx, gy, z)).multiplyScalar(PC_KM)
  out.look.set(...galaxyKpcToScene(0, 0, 0)).multiplyScalar(PC_KM)
  out.up.copy(_introAxisZ.set(...GALAXY_AXES.z))
  out.scale = out.pos.distanceTo(out.look)
  lookQuat(_dir.subVectors(out.look, out.pos), out.up, out.quat)
  return out
}

// Scroll → hold at a stop, or travel through the gap after it.
function scrollPose(scrollY, out) {
  const ranges = getTravelRanges()
  if (ranges.length === pageStops.length - 1) {
    // Hold i spans [end of travel i−1, start of travel i] → orbit; travel legs join the orbit ends (h = 1 → h = 0).
    const maxScroll = measureScrollRange()
    let holdStart = 0
    for (let i = 0; i < ranges.length; i += 1) {
      const start = Math.min(ranges[i][0], maxScroll)
      const end = Math.min(ranges[i][1], maxScroll)
      if (scrollY <= start) {
        const h = clamp01((scrollY - holdStart) / Math.max(start - holdStart, 1))
        setHomeProgress(i === 0 ? h : 1)
        return stopPose(pageStops[i], out, h)
      }
      setHomeProgress(1)
      if (scrollY < end) {
        if (!stopPose(pageStops[i], _poseA, 1) || !stopPose(pageStops[i + 1], _poseB, 0)) return false
        const t = clamp01((scrollY - start) / Math.max(end - start, 1))
        // Sightings: leg split into equal sub-legs A → via… → B (each its own log-scale hop).
        let m = 0 // ready sightings, packed into _viaPoses[0..m)
        for (const v of pageStops[i].via ?? []) if (m < _viaPoses.length && viaPose(v, _poseA.pos, _poseB.pos, _viaPoses[m])) m += 1
        if (!m) return travelPose(_poseA, _poseB, t, out)
        const n = m + 1
        const k = Math.min(n - 1, Math.floor(t * n))
        const from = k === 0 ? _poseA : _viaPoses[k - 1]
        const to = k === n - 1 ? _poseB : _viaPoses[k]
        return travelPose(from, to, t * n - k, out)
      }
      holdStart = end
    }
    return stopPose(pageStops[pageStops.length - 1], out, clamp01((scrollY - holdStart) / Math.max(maxScroll - holdStart, 1)))
  }
  // Fallback: chapter offsets only (before LongPage measured spacers).
  const raw = getChapterOffsets()
  if (raw.length < pageStops.length) return stopPose(pageStops[0], out)
  const maxScroll = measureScrollRange()
  const offsets = raw.map((offset) => Math.min(offset, maxScroll))
  let index = 0
  for (let i = 1; i < offsets.length - 1; i += 1) {
    if (scrollY >= offsets[i]) index = i
  }
  const span = Math.max(offsets[index + 1] - offsets[index], 1)
  const t = smoothstep(scrollConfig.holdStart, scrollConfig.holdEnd, clamp01((scrollY - offsets[index]) / span))
  if (!stopPose(pageStops[index], _poseA) || !stopPose(pageStops[index + 1], _poseB)) return false
  return travelPose(_poseA, _poseB, t, out)
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
  const smoothScrollRef = useRef(null) // eased scrollY driving the camera pose
  const prevPosRef = useRef(new THREE.Vector3()) // mist: relative speed

  const routeRef = useRef(routePath)
  const transFromRef = useRef(new THREE.Vector3())
  const transFromScaleRef = useRef(-1) // km, log-travel scale at explore → page start (lazy)
  // Intro (page loads only): 'hold' (Milky Way orbit behind loading screen, home tiles preload) → 'glide' → 'done'.
  // Dev: ?nointro skips it (testing).
  const skipIntro = isExploreRoute(routePath) || (import.meta.env.DEV && typeof location !== 'undefined' && location.search.includes('nointro'))
  const introRef = useRef({ phase: skipIntro ? 'done' : 'hold', t0: 0, glideT0: 0, from: makePose(), out: makePose() })
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
  const fovVelRef = useRef(0) // deg/s, FOV spring
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
    transFromScaleRef.current = -1
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

  // Scroll mode: ease camera orientation toward a path orientation (snap = instant).
  const aimScroll = (camera, quat, snap, deltaSeconds) => {
    if (snap) camera.quaternion.copy(quat)
    else camera.quaternion.slerp(quat, expFactor(scrollConfig.rotRate, deltaSeconds))
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
    fovVelRef.current = 0
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
    if (isExplorePaused()) {
      setTunnel(0)
      return false
    }

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

    // FOV: critically damped spring toward eased boost blend → no kick on press, no snap on release.
    const b = boostBlendRef.current
    const eased = b * b * (3 - 2 * b)
    const targetFov = baseFovRef.current + exploreConfig.boostFovIncrease * eased
    const k = exploreConfig.fovSpring
    const dt = Math.min(deltaSeconds, 0.05)
    fovVelRef.current += (k * (targetFov - camera.fov) - 2 * Math.sqrt(k) * fovVelRef.current) * dt
    const nextFov = camera.fov + fovVelRef.current * dt
    if (Math.abs(nextFov - camera.fov) > 0.0005) {
      camera.fov = nextFov
      camera.updateProjectionMatrix()
    }
    setTunnel(eased)
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

    // Intro: hold on the Milky Way while loading (terrain preloads the stop via virtual eye), then glide in.
    const intro = introRef.current
    if (intro.phase !== 'done') {
      setMist(0)
      // Wall clock (not frame dt): glide takes introGlideS even on a slow GPU.
      pinToRoute()
      intro.clock = (intro.clock ?? 0) + Math.min(deltaSeconds, 1 / 8) // capped → a hitch can't skip a chunk of the glide
      const now = intro.clock
      intro.t0 ||= now || 1e-6
      const target = chapterPose(routeRef.current, pose)
      if (intro.phase === 'hold') {
        introPose(now - intro.t0, intro.from)
        origin.copy(intro.from.pos)
        camera.quaternion.copy(intro.from.quat)
        setSceneVisible()
        if (target) setTerrainFocus(pose.pos)
        if (target && isSceneLoadReady()) {
          intro.phase = 'glide'
          intro.glideT0 = now
        }
        return
      }
      const t = Math.min(1, (now - intro.glideT0) / scrollConfig.introGlideS)
      if (target) {
        travelPose(intro.from, pose, t, intro.out, scrollConfig.introLookTurn)
        origin.copy(intro.out.pos)
        aimScroll(camera, intro.out.quat, t >= 1, deltaSeconds)
      }
      if (t >= 1) {
        intro.phase = 'done'
        setTerrainFocus(null)
        setIntroDone()
        aimedRef.current = true
        lastScrollYRef.current = window.scrollY || 0
        smoothScrollRef.current = lastScrollYRef.current
      }
      return
    }

    // Explore → page: arc from where we were to route's stop. Scroll pinned meanwhile.
    if (transTRef.current < 1) {
      pinToRoute()
      transTRef.current = Math.min(transTRef.current + transitionLerp, 1)
      const t = transTRef.current
      if (chapterPose(routeRef.current, pose)) {
        if (transFromScaleRef.current < 0) transFromScaleRef.current = Math.max(nearestAltitude(transFromRef.current), 1)
        _bulge.copy(pose.up)
        travelPos(transFromRef.current, transFromScaleRef.current, pose.pos, pose.scale, t, _bulge, origin)
        aimScroll(camera, pose.quat, false, deltaSeconds)
      }
      if (transTRef.current >= 1) {
        settleFramesRef.current = scrollConfig.lockFrames
        smoothScrollRef.current = null
      }
      return
    }

    // Page keeps growing as images/fonts load → keep remeasuring.
    pageScrollRangeRef.current = Math.max(pageScrollRangeRef.current, measureScrollRange())

    if (settleFramesRef.current > 0) {
      settleFramesRef.current -= 1
      pinToRoute()
      if (chapterPose(routeRef.current, pose)) {
        origin.copy(pose.pos)
        aimScroll(camera, pose.quat, false, deltaSeconds)
      }
      return
    }

    const scrollY = window.scrollY || 0
    smoothScrollRef.current ??= scrollY
    // Hitch-proof: a long frame advances like a ≤ 1/20 s one → no jump after a lag spike, camera just glides on.
    smoothScrollRef.current += (scrollY - smoothScrollRef.current) * expFactor(scrollConfig.scrollSmoothing, Math.min(deltaSeconds, 0.05))
    if (Math.abs(scrollY - smoothScrollRef.current) < 0.5) smoothScrollRef.current = scrollY
    if (scrollPose(smoothScrollRef.current, pose)) {
      // Mist ∝ speed relative to subject distance (scale-free): fast scale changes = where LOD / tiles pop.
      const moved = prevPosRef.current.distanceTo(pose.pos)
      const rel = moved / Math.max(deltaSeconds, 1 / 240) / Math.max(pose.pos.distanceTo(pose.look), 1e-3)
      setMist(smoothstep(0.6, 4, rel) * scrollConfig.mistMax)
      prevPosRef.current.copy(pose.pos)
      origin.copy(pose.pos)
      aimScroll(camera, pose.quat, !aimedRef.current, deltaSeconds)
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
      setMist(0)
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
