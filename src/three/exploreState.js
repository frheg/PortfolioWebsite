// Shared pause + pointer-lock state for Explore mode.
// Uses module-level pub/sub so any component or hook can subscribe without React context.

let paused = true // start paused — requires a click/keypress to enter play
const listeners = new Set()

function emit() {
  listeners.forEach((l) => l())
}

export function isExplorePaused() {
  return paused
}

export function setExplorePaused(value) {
  if (paused !== value) {
    paused = value
    emit()
  }
}

export function subscribeExplorePause(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Resume play: clear pause flag and request pointer lock.
 * The lock hides the cursor and provides raw movementX/Y deltas so the
 * mouse can rotate freely without hitting screen edges.
 */
export function resumeExplore() {
  setExplorePaused(false)
  const promise = document.body.requestPointerLock?.()
  // Modern browsers return a Promise; catch silently so play still works
  // even if lock is denied (e.g. mobile/iframe).
  promise?.catch?.(() => {})
}

/**
 * Pause play and release pointer lock if active.
 */
export function pauseExplore() {
  setExplorePaused(true)
  if (document.pointerLockElement) {
    document.exitPointerLock?.()
  }
}

/**
 * Called when leaving the /explore route to reset state for the next visit.
 */
export function resetExplorePauseState() {
  paused = true
  emit()
}
