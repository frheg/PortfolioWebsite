// Shared "nearest stop" telemetry: useScrollCamera writes here every flythrough
// frame with whichever page's cluster the camera is currently closest to, and
// FloatingNav reads it to highlight the right link — the URL itself never
// changes while flying the loop, so route-based active-link matching alone
// can't reflect where on the railroad you actually are.
let _activePath = null
const listeners = new Set()

export function setActiveStopPath(path) {
  if (path === _activePath) return
  _activePath = path
  listeners.forEach((listener) => listener())
}

export function getActiveStopPath() {
  return _activePath
}

export function subscribeActiveStop(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
