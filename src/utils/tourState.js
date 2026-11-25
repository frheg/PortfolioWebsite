// Guided tour state (pub/sub, no three → navbar + overlay import it without the 3D chunk).
// UI: requestTour() / stopTour(). Camera (useScrollCamera): takes the request, drives steps, ends it.
let state = { active: false, requested: false, step: -1, phase: 'idle', progress: 0, total: 0 }
const listeners = new Set()

function set(patch) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function getTourState() {
  return state
}

export function subscribeTour(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Navbar button. Camera picks it up next frame (scroll pages only). */
export function requestTour() {
  if (state.active || state.requested) return
  set({ requested: true })
}

/** Overlay "Avslutt" / Esc → camera flies back to the page. */
export function stopTour() {
  if (state.active && state.phase !== 'return') set({ phase: 'stopping' })
  else if (state.requested) set({ requested: false })
}

// ── camera side ──
export function beginTour(total) {
  set({ active: true, requested: false, step: -1, phase: 'leg', progress: 0, total })
}

/** phase: 'leg' (flying to step) | 'hold' (at step, caption up) | 'return' (back to the page). */
export function setTourStep(step, phase, progress) {
  if (step === state.step && phase === state.phase && Math.abs(progress - state.progress) < 0.005) return
  set({ step, phase, progress })
}

export function endTour() {
  set({ active: false, requested: false, step: -1, phase: 'idle', progress: 0 })
}
