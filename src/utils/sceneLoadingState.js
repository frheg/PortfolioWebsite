// Plain pub/sub, deliberately with no Three.js import — LoadingScreen is
// mounted eagerly in App.jsx, and importing from a module that pulls in
// `three` would drag the whole library out of the lazy BackgroundCanvas
// chunk and into the main bundle. src/three/sceneLoadingManager.js (only
// ever reached via BackgroundCanvas's lazy import chain) owns the actual
// THREE.LoadingManager and forwards progress here.
let progress = 0
let ready = false
const listeners = new Set()

function notify() {
  listeners.forEach((listener) => listener({ progress, ready }))
}

export function setSceneLoadProgress(nextProgress) {
  progress = nextProgress
  notify()
}

export function setSceneLoadReady() {
  progress = 1
  ready = true
  notify()
}

export function subscribeSceneLoading(listener) {
  listeners.add(listener)
  listener({ progress, ready })
  return () => listeners.delete(listener)
}
