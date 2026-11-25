// Explore HUD: minimap (planet / sol / lokal / galakse / gruppe), attitude indicator (horizon + heading tape), flight stats.
// One rAF loop → canvas draws + DOM text, no per-frame React renders. Lazy-loaded (pulls 3D runtime).
// Ref frame auto: local horizon near a surface (compass + climb), ecliptic near Sun, galactic beyond.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { origin } from '../three/floatingOrigin'
import { getActiveCamera, getCameraSpeed } from '../three/cameraRuntime'
import { nearestStar } from '../three/starRuntime'
import { getPoiBodies, getSolarCollisionBodies } from '../three/solarSystemRuntime'
import { isExplorePaused, subscribeExplorePause } from '../three/exploreState'
import { AU_KM, GALAXY_AXES, LY_KM, PC_KM, sceneToGalaxyKpc, spectralClass } from '../three/galaxyFrame'
import { galaxyMapColor } from '../three/galaxyModel'
import { planetFacts } from '../data/planetFacts'
import { getEarthHeightAt, getEarthLatLon, isEarthTerrainActive } from '../three/earthTerrain'
import { drawGroupMap, drawPlanetMap } from './hudMaps'
import { getMultiplayerStatus } from '../three/multiplayer'
import { spaceConfig } from '../three/spaceConfig'

const SOLAR_FRAME_KM = 0.05 * PC_KM // inside → ecliptic frame
const LOCAL_FRAME_RATIO = 0.8 // altitude / radius below → local horizon frame
const SOL_MAP_KM = 2000 * AU_KM // auto: sol map inside this
const LOCAL_MAP_PC = 1000 // auto: local map inside this (catalog region)
const GALAXY_MAP_KPC = 20 // half-extent
const PLANET_MAP_RATIO = 3 // altitude / radius below → planet map (auto)
const GROUP_MAP_KPC = 40 // auto: Local Group map beyond this from galactic center
const C_KM_S = 299_792.458

const nameByKey = Object.fromEntries(planetFacts.map((p) => [p.key, p.name]))

// Catppuccin Mocha.
const COL = {
  text: '#cdd6f4',
  sub: '#a6adc8',
  dim: 'rgba(166,173,200,0.45)',
  sky: '#1e1e2e',
  skyTop: '#313244',
  ground: '#181825',
  groundLow: '#11111b',
  accent: '#89dceb',
  peach: '#fab387',
  yellow: '#f9e2af',
  mauve: '#cba6f7',
  lavender: '#b4befe',
}

const MAP_MODES = [
  { id: 'auto', label: 'Auto' },
  { id: 'planet', label: 'Klode' },
  { id: 'sol', label: 'Sol' },
  { id: 'lokal', label: 'Lokal' },
  { id: 'galakse', label: 'Galakse' },
  { id: 'gruppe', label: 'Lokal gruppe' },
]

// ─── math ────────────────────────────────────────────────────────────────────

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const neg = (a) => [-a[0], -a[1], -a[2]]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const normalize = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

// Local horizon (ENU) at cam over body: up = radial, 0° = north (body axis), 90° = east.
function localFrame(body) {
  const up = normalize([origin.x - body.position.x, origin.y - body.position.y, origin.z - body.position.z])
  const axis = [body.axis.x, body.axis.y, body.axis.z]
  const north = normalize(axis.map((c, i) => c - up[i] * dot(axis, up)))
  return { name: 'Horisont', up, h0: north, h90: cross(north, up), zeroLabel: 'N', hLabel: 'Kurs', pLabel: 'Stigning' }
}

const FRAMES = {
  ecliptic: { name: 'Ekliptisk', up: [0, 1, 0], h0: [1, 0, 0], h90: [0, 0, -1], zeroLabel: 'VP', hLabel: 'λ', pLabel: 'β' },
  galactic: { name: 'Galaktisk', up: GALAXY_AXES.z, h0: neg(GALAXY_AXES.x), h90: neg(GALAXY_AXES.y), zeroLabel: 'GS', hLabel: 'l', pLabel: 'b' },
}

function cameraBasis(camera) {
  const e = camera.matrixWorld.elements
  return { right: [e[0], e[1], e[2]], up: [e[4], e[5], e[6]], forward: [-e[8], -e[9], -e[10]] }
}

function attitude(camera, frame) {
  const { right, up, forward } = cameraBasis(camera)
  const heading = ((Math.atan2(dot(forward, frame.h90), dot(forward, frame.h0)) * 180) / Math.PI + 360) % 360
  const pitch = (Math.asin(Math.max(-1, Math.min(1, dot(forward, frame.up)))) * 180) / Math.PI
  const roll = Math.atan2(dot(frame.up, right), dot(frame.up, up))
  return { heading, pitch, roll, forward }
}

// ─── formatting ──────────────────────────────────────────────────────────────

// Cached formatters (toLocaleString builds one per call → slow every frame).
const NB = [0, 1, 2, 3].map((d) => new Intl.NumberFormat('nb-NO', { maximumFractionDigits: d, minimumFractionDigits: 0 }))
const nb = (n, digits = 0) => NB[digits].format(n)

function formatDistance(km) {
  const a = Math.abs(km)
  const sign = km < 0 ? '−' : ''
  if (a < 1) return `${sign}${nb(a * 1000)} m`
  if (a < 100) return `${sign}${nb(a, a < 10 ? 2 : 1)} km`
  if (a < 1e7) return `${sign}${nb(a)} km`
  if (a < 2000 * AU_KM) return `${sign}${nb(a / AU_KM, a < 10 * AU_KM ? 2 : 0)} AU`
  if (a < 1000 * LY_KM) return `${sign}${nb(a / LY_KM, a < 10 * LY_KM ? 2 : 1)} ly`
  if (a < 1e6 * LY_KM) return `${sign}${nb(a / LY_KM / 1000, 2)} kly`
  return `${sign}${nb(a / LY_KM / 1e6, 2)} Mly`
}

function formatSpeed(kmS) {
  if (kmS < 0.0003) return `${nb(kmS * 1000, 1)} m/s`
  if (kmS < 1) return `${nb(kmS * 3600)} km/t`
  if (kmS < 1e4) return `${nb(kmS, kmS < 10 ? 2 : 0)} km/s`
  if (kmS < 1000 * C_KM_S) return `${nb(kmS / C_KM_S, 1)} c`
  return `${nb(kmS / LY_KM, kmS < 10 * LY_KM ? 2 : 0)} ly/s`
}

// ─── canvas helpers ──────────────────────────────────────────────────────────

// CSS size via ResizeObserver → no clientWidth read per frame (forced layout).
const canvasSize = new WeakMap()
const sizeObserver =
  typeof ResizeObserver === 'undefined'
    ? null
    : new ResizeObserver((entries) => entries.forEach((e) => canvasSize.set(e.target, { w: e.contentRect.width, h: e.contentRect.height })))

function fitCanvas(canvas) {
  let css = canvasSize.get(canvas)
  if (!css) {
    css = { w: canvas.clientWidth, h: canvas.clientHeight }
    canvasSize.set(canvas, css)
    sizeObserver?.observe(canvas)
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = Math.round(css.w * dpr)
  const h = Math.round(css.h * dpr)
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { ctx, w: css.w, h: css.h }
}

let galaxyMapImage = null
// Face-on Milky Way, rendered once. Screen right = +gy, down = +gx (sun below center, view from NGP).
function getGalaxyMapImage() {
  if (galaxyMapImage) return galaxyMapImage
  const N = 160
  const canvas = document.createElement('canvas')
  canvas.width = N
  canvas.height = N
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(N, N)
  for (let py = 0; py < N; py += 1) {
    for (let px = 0; px < N; px += 1) {
      const gy = ((px + 0.5) / N - 0.5) * 2 * GALAXY_MAP_KPC
      const gx = ((py + 0.5) / N - 0.5) * 2 * GALAXY_MAP_KPC
      const c = galaxyMapColor(gx, gy)
      const i = (py * N + px) * 4
      for (let k = 0; k < 3; k += 1) img.data[i + k] = Math.round(255 * Math.sqrt(1 - Math.exp(-c[k] * 9)))
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  galaxyMapImage = canvas
  return canvas
}

function drawMarker(ctx, x, y, dirX, dirY, color) {
  // Heading arrow + dot.
  const len = Math.hypot(dirX, dirY)
  if (len > 1e-3) {
    const ux = dirX / len
    const uy = dirY / len
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + ux * 14, y + uy * 14)
    ctx.stroke()
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(x + ux * 18, y + uy * 18)
    ctx.lineTo(x + ux * 11 - uy * 4, y + uy * 11 + ux * 4)
    ctx.lineTo(x + ux * 11 + uy * 4, y + uy * 11 - ux * 4)
    ctx.fill()
  }
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, 3, 0, Math.PI * 2)
  ctx.fill()
}

function clampToDisc(x, y, cx, cy, r) {
  const dx = x - cx
  const dy = y - cy
  const d = Math.hypot(dx, dy)
  if (d <= r) return [x, y, false]
  return [cx + (dx / d) * r, cy + (dy / d) * r, true]
}

// ─── minimap modes ───────────────────────────────────────────────────────────

function drawSolMap(ctx, w, h, att) {
  const cx = w / 2
  const cy = h / 2
  const R = Math.min(w, h) / 2 - 8
  const camDistAu = Math.hypot(origin.x, origin.y, origin.z) / AU_KM
  const minAu = 0.2
  const maxAu = Math.min(Math.max(50, camDistAu * 1.3), 2500)
  const rOf = (au) => (Math.log10(Math.max(au, minAu) / minAu) / Math.log10(maxAu / minAu)) * R
  // Ecliptic top-down: screen x = scene x, screen down = scene z.
  const toScreen = (x, z) => {
    const au = Math.hypot(x, z) / AU_KM
    const k = au > 0 ? rOf(au) / (au * AU_KM) : 0
    return [cx + x * k, cy + z * k]
  }

  ctx.fillStyle = COL.yellow
  ctx.beginPath()
  ctx.arc(cx, cy, 3.5, 0, Math.PI * 2)
  ctx.fill()

  getSolarCollisionBodies().forEach((body) => {
    if (body.kind !== 'body' || body.key === 'sun' || body.key === 'moon') return
    const au = Math.hypot(body.position.x, body.position.z) / AU_KM
    ctx.strokeStyle = 'rgba(180,190,254,0.18)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(cx, cy, rOf(au), 0, Math.PI * 2)
    ctx.stroke()
    const [x, y] = toScreen(body.position.x, body.position.z)
    ctx.fillStyle = COL.lavender
    ctx.beginPath()
    ctx.arc(x, y, 2, 0, Math.PI * 2)
    ctx.fill()
  })

  const [x0, y0] = toScreen(origin.x, origin.z)
  const [x, y] = clampToDisc(x0, y0, cx, cy, R)
  drawMarker(ctx, x, y, att.forward[0], att.forward[2], COL.accent)
  return `Ekliptikk ${formatDistance(origin.y)}`
}

function drawLocalMap(ctx, w, h, att, camG) {
  const cx = w / 2
  const cy = h / 2
  const R = Math.min(w, h) / 2 - 8
  const dSunPc = Math.hypot(origin.x, origin.y, origin.z) / PC_KM
  const rangePc = Math.min(Math.max(dSunPc * 1.4, 12), 1200)
  const scale = R / rangePc // px per pc
  // Galactic plane, cam-centred. right = +gy, down = +gx (same as galaxy map).
  const proj = (pcScene) => {
    const g = sceneToGalaxyKpc(pcScene[0], pcScene[1], pcScene[2])
    return [cx + (g[1] - camG[1]) * 1000 * scale, cy + (g[0] - camG[0]) * 1000 * scale]
  }

  ctx.strokeStyle = 'rgba(180,190,254,0.12)'
  ctx.lineWidth = 1
  for (const f of [0.33, 0.66, 1]) {
    ctx.beginPath()
    ctx.arc(cx, cy, R * f, 0, Math.PI * 2)
    ctx.stroke()
  }

  let labelled = 0
  ctx.font = '600 9px ui-sans-serif, system-ui'
  getPoiBodies().forEach((poi) => {
    if (poi.kind !== 'star') return
    const p = [poi.position.x / PC_KM, poi.position.y / PC_KM, poi.position.z / PC_KM]
    const [x, y] = proj(p)
    if (Math.hypot(x - cx, y - cy) > R) return
    ctx.fillStyle = 'rgba(205,214,244,0.75)'
    ctx.fillRect(x - 1, y - 1, 2, 2)
    if (labelled < 10 && rangePc < 60) {
      ctx.fillStyle = COL.dim
      ctx.fillText(poi.name, x + 3, y - 2)
      labelled += 1
    }
  })

  const [sx0, sy0] = proj([0, 0, 0])
  const [sx, sy, clamped] = clampToDisc(sx0, sy0, cx, cy, R)
  ctx.fillStyle = COL.yellow
  ctx.beginPath()
  ctx.arc(sx, sy, clamped ? 2.5 : 3.5, 0, Math.PI * 2)
  ctx.fill()

  const fG = [dot(att.forward, GALAXY_AXES.x), dot(att.forward, GALAXY_AXES.y)]
  drawMarker(ctx, cx, cy, fG[1], fG[0], COL.accent)
  return `Radius ${formatDistance(rangePc * PC_KM)}`
}

function drawGalaxyMap(ctx, w, h, att, camG) {
  const S = Math.min(w, h)
  const ox = (w - S) / 2
  const oy = (h - S) / 2
  ctx.globalAlpha = 0.95
  ctx.drawImage(getGalaxyMapImage(), ox, oy, S, S)
  ctx.globalAlpha = 1
  const toScreen = (gx, gy) => [ox + (gy / (2 * GALAXY_MAP_KPC) + 0.5) * S, oy + (gx / (2 * GALAXY_MAP_KPC) + 0.5) * S]

  const [gcx, gcy] = toScreen(0, 0)
  ctx.strokeStyle = COL.peach
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(gcx, gcy, 3, 0, Math.PI * 2)
  ctx.stroke()

  const sunG = sceneToGalaxyKpc(0, 0, 0)
  const [sx, sy] = toScreen(sunG[0], sunG[1])
  ctx.fillStyle = COL.yellow
  ctx.beginPath()
  ctx.arc(sx, sy, 2.5, 0, Math.PI * 2)
  ctx.fill()

  const [x0, y0] = toScreen(camG[0], camG[1])
  const [x, y] = clampToDisc(x0, y0, w / 2, h / 2, S / 2 - 4)
  const fG = [dot(att.forward, GALAXY_AXES.x), dot(att.forward, GALAXY_AXES.y)]
  drawMarker(ctx, x, y, fG[1], fG[0], COL.accent)
  return `Høyde ${formatDistance(camG[2] * 1000 * PC_KM)}`
}

// ─── attitude indicator ──────────────────────────────────────────────────────

function drawAttitude(ctx, w, h, att, frame) {
  const tapeH = 18
  const cx = w / 2
  const cy = tapeH + (h - tapeH) / 2
  const r = Math.min(w, h - tapeH) / 2 - 4
  const pxPerDeg = r / 50

  // Ball: sky/ground, rotated by roll, shifted by pitch.
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  ctx.translate(cx, cy)
  ctx.rotate(-att.roll)
  const horizon = att.pitch * pxPerDeg
  const sky = ctx.createLinearGradient(0, -r * 2, 0, horizon)
  sky.addColorStop(0, COL.skyTop)
  sky.addColorStop(1, COL.sky)
  ctx.fillStyle = sky
  ctx.fillRect(-r * 2, -r * 3, r * 4, horizon + r * 3)
  const ground = ctx.createLinearGradient(0, horizon, 0, r * 2)
  ground.addColorStop(0, COL.ground)
  ground.addColorStop(1, COL.groundLow)
  ctx.fillStyle = ground
  ctx.fillRect(-r * 2, horizon, r * 4, r * 3)

  ctx.strokeStyle = COL.accent
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(-r * 2, horizon)
  ctx.lineTo(r * 2, horizon)
  ctx.stroke()

  ctx.font = '600 9px ui-sans-serif, system-ui'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  for (let p = -80; p <= 80; p += 10) {
    if (p === 0) continue
    const y = horizon - p * pxPerDeg
    if (Math.abs(y) > r) continue
    const half = p % 30 === 0 ? r * 0.32 : r * 0.16
    ctx.strokeStyle = p > 0 ? 'rgba(205,214,244,0.55)' : 'rgba(166,173,200,0.35)'
    ctx.beginPath()
    ctx.moveTo(-half, y)
    ctx.lineTo(half, y)
    ctx.stroke()
    if (p % 30 === 0) {
      ctx.fillStyle = COL.sub
      ctx.fillText(String(Math.abs(p)), half + 3, y)
    }
  }
  ctx.restore()

  // Roll scale + pointer.
  ctx.save()
  ctx.translate(cx, cy)
  ctx.strokeStyle = COL.dim
  ctx.lineWidth = 1
  for (const deg of [-60, -30, -10, 0, 10, 30, 60]) {
    const a = ((deg - 90) * Math.PI) / 180
    const inner = deg % 30 === 0 ? r - 7 : r - 4
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner)
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    ctx.stroke()
  }
  ctx.rotate(-att.roll)
  ctx.fillStyle = COL.accent
  ctx.beginPath()
  ctx.moveTo(0, -r + 8)
  ctx.lineTo(-4, -r + 14)
  ctx.lineTo(4, -r + 14)
  ctx.fill()
  ctx.restore()

  // Fixed aircraft symbol.
  ctx.strokeStyle = COL.peach
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(cx - r * 0.45, cy)
  ctx.lineTo(cx - r * 0.12, cy)
  ctx.lineTo(cx - r * 0.06, cy + 5)
  ctx.moveTo(cx + r * 0.45, cy)
  ctx.lineTo(cx + r * 0.12, cy)
  ctx.lineTo(cx + r * 0.06, cy + 5)
  ctx.stroke()
  ctx.fillStyle = COL.peach
  ctx.beginPath()
  ctx.arc(cx, cy, 2, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = 'rgba(205,214,244,0.18)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()

  // Heading tape: ±60° window.
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, w, tapeH)
  ctx.clip()
  const pxPerHdg = w / 120
  ctx.font = '600 9px ui-sans-serif, system-ui'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (let d = Math.floor((att.heading - 60) / 10) * 10; d <= att.heading + 60; d += 10) {
    const x = cx + (d - att.heading) * pxPerHdg
    const deg = ((d % 360) + 360) % 360
    ctx.strokeStyle = COL.dim
    ctx.beginPath()
    ctx.moveTo(x, tapeH - (deg % 30 === 0 ? 7 : 4))
    ctx.lineTo(x, tapeH)
    ctx.stroke()
    if (deg % 30 === 0) {
      ctx.fillStyle = deg === 0 ? COL.peach : COL.sub
      ctx.fillText(deg === 0 ? frame.zeroLabel : String(deg), x, 1)
    }
  }
  ctx.restore()
  ctx.fillStyle = COL.accent
  ctx.beginPath()
  ctx.moveTo(cx, tapeH + 1)
  ctx.lineTo(cx - 4, tapeH + 6)
  ctx.lineTo(cx + 4, tapeH + 6)
  ctx.fill()
}

// ─── component ───────────────────────────────────────────────────────────────

const panelClass =
  'rounded-2xl border border-white/10 bg-slate-950/70 shadow-[0_16px_44px_rgba(17,17,27,0.5)] backdrop-blur-xl'

// [key, label, on mobile]
const STAT_ROWS = [
  ['speed', 'Fart', false],
  ['alt', 'Høyde', true],
  ['agl', 'Bakke', false],
  ['sun', 'Solen', false],
  ['center', 'Sentrum', false],
  ['height', 'Gal. plan', false],
  ['star', 'Stjerne', false],
  ['body', 'Nærmest', true],
  ['dir', 'Retning', false],
  ['pos', 'Posisjon', false],
  ['mp', 'Online', true],
]

export default function ExploreHud() {
  const paused = useSyncExternalStore(subscribeExplorePause, isExplorePaused, isExplorePaused)
  const [mapMode, setMapMode] = useState('auto')
  const [showCredits, setShowCredits] = useState(false) // phone: credits behind ⓘ
  const mapModeRef = useRef(mapMode)
  mapModeRef.current = mapMode

  const mapRef = useRef(null)
  const attRef = useRef(null)
  const mapLabelRef = useRef(null)
  const mapFootRef = useRef(null)
  const frameRef = useRef(null)
  const terrainCreditRef = useRef(null)
  const statRefs = useRef({})

  useEffect(() => {
    if (paused) return undefined
    let frameId
    let statTimer = 0
    let last = performance.now()

    const tick = (now) => {
      frameId = requestAnimationFrame(tick)
      const camera = getActiveCamera()
      if (!camera || !mapRef.current || !attRef.current) return

      const dSunKm = Math.hypot(origin.x, origin.y, origin.z)
      let surface = null
      getSolarCollisionBodies().forEach((body) => {
        if (body.kind !== 'body' || !body.axis) return
        const alt = Math.hypot(origin.x - body.position.x, origin.y - body.position.y, origin.z - body.position.z) - body.radius
        if (alt / body.radius < LOCAL_FRAME_RATIO && (!surface || alt < surface.alt)) surface = { body, alt }
      })
      const frame = surface ? localFrame(surface.body) : dSunKm < SOLAR_FRAME_KM ? FRAMES.ecliptic : FRAMES.galactic
      const att = attitude(camera, frame)
      const camG = sceneToGalaxyKpc(origin.x / PC_KM, origin.y / PC_KM, origin.z / PC_KM)

      // Minimap. Nearest textured body by altitude/radius → planet map.
      let mapBody = null
      getSolarCollisionBodies().forEach((body) => {
        if (body.kind !== 'body' || !body.frameQ || body.key === 'sun') return
        const ratio = (Math.hypot(origin.x - body.position.x, origin.y - body.position.y, origin.z - body.position.z) - body.radius) / body.radius
        if (!mapBody || ratio < mapBody.ratio) mapBody = { body, ratio }
      })
      const autoMode =
        mapBody && mapBody.ratio < PLANET_MAP_RATIO
          ? 'planet'
          : dSunKm < SOL_MAP_KM
            ? 'sol'
            : dSunKm < LOCAL_MAP_PC * PC_KM
              ? 'lokal'
              : Math.hypot(...camG) < GROUP_MAP_KPC
                ? 'galakse'
                : 'gruppe'
      let mode = mapModeRef.current === 'auto' ? autoMode : mapModeRef.current
      if (mode === 'planet' && !mapBody) mode = 'sol'
      const map = fitCanvas(mapRef.current)
      map.ctx.clearRect(0, 0, map.w, map.h)
      const foot =
        mode === 'planet'
          ? drawPlanetMap(map.ctx, map.w, map.h, mapBody.body, att.forward, getPoiBodies(), drawMarker, COL.accent, formatDistance)
          : mode === 'sol'
            ? drawSolMap(map.ctx, map.w, map.h, att)
            : mode === 'lokal'
              ? drawLocalMap(map.ctx, map.w, map.h, att, camG)
              : mode === 'galakse'
                ? drawGalaxyMap(map.ctx, map.w, map.h, att, camG)
                : drawGroupMap(map.ctx, map.w, map.h, att.forward, camG, drawMarker, COL.accent)

      const attC = fitCanvas(attRef.current)
      attC.ctx.clearRect(0, 0, attC.w, attC.h)
      drawAttitude(attC.ctx, attC.w, attC.h, att, frame)

      // Text: ~8 Hz.
      statTimer -= now - last
      last = now
      if (statTimer > 0) return
      statTimer = 125
      if (mapLabelRef.current)
        mapLabelRef.current.textContent = mode === 'planet' ? nameByKey[mapBody.body.key] ?? mapBody.body.key : MAP_MODES.find((m) => m.id === mode).label
      if (mapFootRef.current) mapFootRef.current.textContent = foot
      if (frameRef.current) frameRef.current.textContent = frame.name
      if (terrainCreditRef.current) terrainCreditRef.current.style.display = isEarthTerrainActive() ? '' : 'none'

      const set = (key, text) => {
        const el = statRefs.current[key]
        if (el && el.textContent !== text) el.textContent = text
      }
      set('speed', formatSpeed(getCameraSpeed()))
      set('sun', formatDistance(dSunKm))
      set('center', formatDistance(Math.hypot(...camG) * 1000 * PC_KM))
      set('height', formatDistance(camG[2] * 1000 * PC_KM))
      if (nearestStar.valid) {
        const w = nearestStar.world
        const d = Math.hypot(origin.x - w.x, origin.y - w.y, origin.z - w.z)
        set('star', `${nearestStar.name ?? 'Ukjent'} · ${spectralClass(nearestStar.temp)} · ${formatDistance(d)}`)
      } else {
        set('star', '—')
      }
      let best = null
      if (dSunKm < SOLAR_FRAME_KM) {
        getSolarCollisionBodies().forEach((body) => {
          if (body.kind !== 'body') return
          const alt =
            Math.hypot(origin.x - body.position.x, origin.y - body.position.y, origin.z - body.position.z) - body.radius
          if (!best || alt < best.alt) best = { name: nameByKey[body.key] ?? body.key, alt }
        })
      }
      set('body', best ? `${best.name} · ${formatDistance(best.alt)}` : '—')
      // Near a surface: above sea level (moh.) + above ground (Earth tiles). Else: altitude over nearest body.
      if (surface) {
        const ground = surface.body.key === 'earth' ? getEarthHeightAt(origin) : 0
        const msl = surface.body.key === 'earth' ? 'moh.' : 'o.o.'
        set('alt', `${formatDistance(surface.alt)} ${msl}`)
        set('agl', ground > 0 ? `${formatDistance(surface.alt - ground)} over` : '—')
      } else {
        set('alt', best ? `${formatDistance(best.alt)} over ${best.name}` : '—')
        set('agl', '—')
      }
      set('dir', `${frame.hLabel} ${nb(att.heading)}° · ${frame.pLabel} ${nb(att.pitch)}°`)
      const mp = getMultiplayerStatus()
      set('mp', !spaceConfig.relay.url ? 'av' : mp.connected ? `${mp.n} · du: ${mp.name}` : 'kobler til…')
      const ll = getEarthLatLon(origin)
      set('pos', ll ? `${nb(Math.abs(ll[0]), 3)}° ${ll[0] >= 0 ? 'N' : 'S'} · ${nb(Math.abs(ll[1]), 3)}° ${ll[1] >= 0 ? 'Ø' : 'V'}` : '—')
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [paused])

  if (paused) return null

  return (
    <div className="pointer-events-none fixed z-30 right-3 top-16 flex flex-col items-end gap-2 md:bottom-5 md:left-5 md:right-5 md:top-auto md:flex-row md:items-end md:justify-between phone:bottom-auto phone:left-auto phone:right-3 phone:top-16 phone:flex-col phone:items-end phone:justify-start [@media(max-height:500px)]:top-3 [@media(max-height:500px)]:right-16 [@media(max-height:500px)]:flex-row [@media(max-height:500px)]:items-start">
      {/* Minimap */}
      <div className={`${panelClass} pointer-events-auto w-[8.5rem] p-1.5 md:w-[14rem] md:p-2 phone:w-[8rem] phone:p-1.5 [@media(max-height:500px)]:w-[6.5rem]`}>
        <div className="flex items-center justify-between gap-1 px-1 pb-1 text-[0.63rem] font-semibold uppercase tracking-[0.18em] text-cyan-200/90 md:text-[0.68rem] phone:px-0.5 phone:text-[0.58rem] phone:tracking-[0.06em]">
          <span className="min-w-0 truncate"><span className="phone:hidden">Kart · </span><span ref={mapLabelRef}>Auto</span></span>
          <button
            type="button"
            data-explore-control
            aria-label="Kilder"
            className="hidden h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/15 text-[0.55rem] normal-case tracking-normal text-cyan-100/70 phone:inline-flex"
            onClick={() => setShowCredits((v) => !v)}
          >
            i
          </button>
          <button
            type="button"
            data-explore-control
            className="rounded-full border border-white/10 px-1.5 py-0.5 text-[0.58rem] tracking-[0.12em] text-cyan-100/80 transition hover:border-cyan-300/40"
            onClick={() => setMapMode((m) => MAP_MODES[(MAP_MODES.findIndex((x) => x.id === m) + 1) % MAP_MODES.length].id)}
          >
            {MAP_MODES.find((m) => m.id === mapMode).label}
          </button>
        </div>
        <canvas ref={mapRef} className="block aspect-square w-full rounded-xl bg-[#11111b]" />
        <p ref={mapFootRef} className="px-1 pt-1 text-[0.63rem] uppercase tracking-[0.12em] text-cyan-100/60" />
        {/* Required attribution while Earth tiles render. */}
        <p ref={terrainCreditRef} style={{ display: 'none' }} className={`px-1 pt-1 text-[0.52rem] leading-snug text-cyan-100/45 ${showCredits ? '' : 'phone:hidden'}`}>
          <a href="https://s2maps.eu" target="_blank" rel="noreferrer" data-explore-control className="pointer-events-auto hover:text-cyan-100/80">
            Sentinel-2 cloudless – s2maps.eu by EOX (Copernicus Sentinel data 2020) · Esri, Maxar, Earthstar Geographics
          </a>
          {' · '}
          <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noreferrer" data-explore-control className="pointer-events-auto hover:text-cyan-100/80">
            Terreng: AWS Terrain Tiles
          </a>
          {' · '}
          <a href="https://www.geonames.org" target="_blank" rel="noreferrer" data-explore-control className="pointer-events-auto hover:text-cyan-100/80">
            Stedsnavn: GeoNames (CC BY 4.0), Natural Earth
          </a>
          {' · '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" data-explore-control className="pointer-events-auto hover:text-cyan-100/80">
            Bygninger: © OpenStreetMap, OpenMapTiles (OpenFreeMap)
          </a>
          {' · '}
          <a href="https://celestrak.org" target="_blank" rel="noreferrer" data-explore-control className="pointer-events-auto hover:text-cyan-100/80">
            Satellitter: CelesTrak
          </a>
        </p>
        {/* Planet maps (CC BY 4.0): always credited. */}
        <p className={`px-1 pt-1 text-[0.52rem] leading-snug text-cyan-100/45 ${showCredits ? '' : 'phone:hidden'}`}>
          <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noreferrer" data-explore-control className="pointer-events-auto hover:text-cyan-100/80">
            Planetkart: Solar System Scope (CC BY 4.0), NASA
          </a>
          {' · Pluto: NASA/JHUAPL/SwRI'}
        </p>
      </div>

      <div className="flex flex-col items-end gap-2 md:flex-row md:items-end phone:flex-col phone:items-end">
        {/* Stats */}
        <div className={`${panelClass} w-[12.5rem] px-2.5 py-2 md:w-[17rem] md:px-3 md:py-2.5 phone:w-[11.5rem] phone:px-2 phone:py-1.5`}>
          <dl className="grid grid-cols-[3.9rem_1fr] gap-x-2 gap-y-1 text-[0.63rem] uppercase tracking-[0.1em] md:grid-cols-[5.2rem_1fr] md:text-[0.7rem] phone:grid-cols-[3.6rem_1fr] phone:text-[0.6rem]">
            {STAT_ROWS.map(([key, label, mobile]) => (
              <div key={key} className={mobile ? 'contents' : 'hidden md:contents phone:hidden'}>
                <dt className="text-cyan-200/55">{label}</dt>
                <dd ref={(el) => (statRefs.current[key] = el)} className="truncate text-right font-semibold text-cyan-50/90">
                  —
                </dd>
              </div>
            ))}
          </dl>
          <a
            href="https://github.com/astronexus/HYG-Database"
            target="_blank"
            rel="noreferrer"
            data-explore-control
            className="pointer-events-auto mt-2 hidden text-[0.58rem] uppercase tracking-[0.12em] text-cyan-100/35 hover:text-cyan-100/70 md:block phone:hidden"
          >
            Stjernedata: HYG v4.1 · CC BY-SA 4.0
          </a>
        </div>

        {/* Attitude */}
        <div className={`${panelClass} w-[8.5rem] p-1.5 md:w-[12rem] md:p-2 phone:fixed phone:bottom-[calc(env(safe-area-inset-bottom)+0.9rem)] phone:right-3 phone:w-[6.5rem] phone:p-1`}>
          <canvas ref={attRef} className="block aspect-[1/1.12] w-full" />
          <p className="px-1 pt-0.5 text-center text-[0.63rem] uppercase tracking-[0.16em] text-cyan-100/60">
            <span ref={frameRef}>—</span>
          </p>
        </div>
      </div>
    </div>
  )
}
