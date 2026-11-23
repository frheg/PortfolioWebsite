// Sgr A* one-way wormhole. Camera hook: setApproach() each frame near horizon, trigger() on crossing.
// Render pipeline: overlay() → { alpha, flash } for a fullscreen fade (black in, white-hole flash out).
const EXIT_MS = 2600

let approach = 0
let exitStart = -Infinity

export function setWormholeApproach(value) {
  approach = value
}

export function triggerWormhole() {
  exitStart = performance.now()
  approach = 0
}

const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

// alpha: overlay opacity. flash: 0 = black, 1 = white-hole glare.
export function wormholeOverlay(now = performance.now()) {
  const u = (now - exitStart) / EXIT_MS
  if (u >= 0 && u < 1) return { alpha: 1 - smoothstep(0.1, 1, u), flash: smoothstep(0, 0.08, u) }
  return { alpha: approach, flash: 0 }
}
