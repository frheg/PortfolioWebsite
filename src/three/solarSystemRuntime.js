// Shared body registries for camera (collision/speed) + labels.
// collision bodies: solar system, rewritten each mount. POIs: labeled-only (named stars, ...), changes rarely.
let collisionBodies = []
let poiBodies = []
const poiListeners = new Set()

export function setSolarCollisionBodies(bodies) {
  collisionBodies = bodies
}

export function getSolarCollisionBodies() {
  return collisionBodies
}

export function setPoiBodies(bodies) {
  poiBodies = bodies
  poiListeners.forEach((listener) => listener())
}

export function getPoiBodies() {
  return poiBodies
}

export function subscribePoiBodies(listener) {
  poiListeners.add(listener)
  return () => poiListeners.delete(listener)
}
