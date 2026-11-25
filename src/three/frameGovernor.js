// Frame smoothness. Two tricks:
// 1. Upload queue: new drawables (star cells, building tiles) go live ≤ N per frame → GPU buffer/texture uploads spread out, no hitch bursts.
// 2. Dynamic resolution: sustained slow frames → step render scale down; fast again for a while → step back up.
//    Discrete steps + hysteresis + backoff → rare target reallocs, no flicker. Scales post targets only (canvas fixed).
import { spaceConfig } from './spaceConfig'

const cfg = spaceConfig.renderer.dynamicRes

// ── upload queue ──
const jobs = []
let rendererRef = null

/** fn(): build + add to scene (must self-check it's still wanted). textures: pre-uploaded right before. */
export function queueUpload(fn, textures) {
  jobs.push({ fn, textures })
}

/** Upload textures to the GPU now (drawables that stay hidden for a while, e.g. preloaded terrain). */
export function preuploadTextures(textures) {
  textures.forEach((t) => t && rendererRef?.initTexture(t))
}

function flushJobs() {
  for (let n = 0; n < cfg.uploadsPerFrame && jobs.length; n += 1) {
    const job = jobs.shift()
    if (job.fn() === false) {
      n -= 1 // dropped meanwhile → free slot
      continue
    }
    job.textures?.forEach((t) => rendererRef?.initTexture(t))
  }
}

// ── dynamic resolution ──
let step = 0
let slowS = 0
let fastS = 0
let emaMs = 16
let upHoldS = cfg.upHoldS
let lastUpAt = -Infinity
let clock = 0
const listeners = new Set()

export function getRenderScale() {
  return cfg.steps[step]
}

export function subscribeRenderScale(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// three's PointsMaterial sizes px via renderer pixel ratio (canvas) → × scale to keep size on screen.
const points = new Map() // material → base size

/** Register a PointsMaterial; returns it. Unregisters on dispose. */
export function scaledPoints(material) {
  points.set(material, material.size)
  material.size *= cfg.steps[step]
  material.addEventListener('dispose', () => points.delete(material))
  return material
}

const setStep = (next) => {
  step = next
  points.forEach((base, m) => (m.size = base * cfg.steps[step]))
  slowS = 0
  fastS = 0
  listeners.forEach((l) => l())
}

/** Once per frame. rawDt: real seconds since last frame (unclamped). capped: fps deliberately limited → skip res logic. */
export function frameTick(rawDt, renderer, capped = false) {
  rendererRef = renderer
  flushJobs()
  if (!cfg.enabled || capped || rawDt > 0.25 || document.hidden) return // tab switch / stall → not a perf signal
  clock += rawDt
  emaMs += (rawDt * 1000 - emaMs) * 0.1
  if (emaMs > cfg.downMs) {
    slowS += rawDt
    fastS = 0
  } else if (emaMs < cfg.upMs) {
    fastS += rawDt
    slowS = Math.max(0, slowS - rawDt)
  } else {
    slowS = Math.max(0, slowS - rawDt)
    fastS = 0
  }
  if (slowS > cfg.downHoldS && step < cfg.steps.length - 1) {
    // Up-step just reverted → it oscillates; wait longer next time.
    if (clock - lastUpAt < cfg.upHoldS * 2) upHoldS = Math.min(upHoldS * 2, cfg.maxUpHoldS)
    setStep(step + 1)
  } else if (fastS > upHoldS && step > 0) {
    lastUpAt = clock
    setStep(step - 1)
  }
}
