// Shared body registries for camera (collision/speed) + labels.
// collision: solar system (rewritten each mount) + deep bodies (black holes, promoted star).
// POIs: labeled-only, grouped by source (named stars, nebulae, ...). Changes rarely → subscribe.
let collisionBodies = []
let deepBodies = []
const poiGroups = new Map()
let poiBodies = []
const poiListeners = new Set()

export function setSolarCollisionBodies(bodies) {
  collisionBodies = bodies
}

export function getSolarCollisionBodies() {
  return collisionBodies
}

export function setDeepBodies(bodies) {
  deepBodies = bodies
}

export function getDeepBodies() {
  return deepBodies
}

export function setPoiGroup(name, bodies) {
  if (bodies.length) poiGroups.set(name, bodies)
  else poiGroups.delete(name)
  poiBodies = [...poiGroups.values()].flat()
  poiListeners.forEach((listener) => listener())
}

export function getPoiBodies() {
  return poiBodies
}

export function subscribePoiBodies(listener) {
  poiListeners.add(listener)
  return () => poiListeners.delete(listener)
}
