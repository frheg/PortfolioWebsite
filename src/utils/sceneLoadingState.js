// Plain pub/sub, deliberately with no Three.js import — LoadingScreen is
// mounted eagerly in App.jsx, and importing from a module that pulls in
// `three` would drag the whole library out of the lazy BackgroundCanvas
// chunk and into the main bundle. src/three/sceneLoadingManager.js (only
// ever reached via BackgroundCanvas's lazy import chain) owns the actual
// THREE.LoadingManager and forwards progress here.
let progress = 0
let status = 'Bygger galaksen' // what's loading now (loading screen status line)
let ready = false
let visible = false // 3D intro running (behind the loading screen until it fades)
let introDone = false // camera glide reached the first stop → page content fades in
const listeners = new Set()

function notify() {
  listeners.forEach((listener) => listener({ progress, ready, visible, introDone, status }))
}

// Monotonic: totals grow while loading (more textures queued, terrain refines) → never show the bar going back.
export function setSceneLoadProgress(nextProgress) {
  if (nextProgress <= progress) return
  progress = nextProgress
  notify()
}

export function setSceneLoadStatus(text) {
  if (text === status) return
  status = text
  notify()
}

export function setSceneLoadReady() {
  progress = 1
  ready = true
  status = 'Klar for avgang'
  notify()
}

export function setSceneVisible() {
  if (visible) return
  visible = true
  notify()
}

export function setIntroDone() {
  if (introDone) return
  introDone = true
  notify()
}

export function isSceneLoadReady() {
  return ready
}

export function subscribeSceneLoading(listener) {
  listeners.add(listener)
  listener({ progress, ready, visible, introDone, status })
  return () => listeners.delete(listener)
}
