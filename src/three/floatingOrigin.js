// Floating origin. World pos = float64 km (JS numbers). GPU = float32 → jitter far from 0.
// Fix: camera sits at render 0. Each frame: object.position = world - origin.
// Camera hook writes origin; systems track anchors; BackgroundCanvas calls syncAnchors() pre-render.
import * as THREE from 'three'

// Camera world pos, km.
export const origin = new THREE.Vector3()

const anchors = new Map() // Object3D → world Vector3 (live ref)

export function trackAnchor(object, world) {
  anchors.set(object, world)
}

export function untrackAnchor(object) {
  anchors.delete(object)
}

export function syncAnchors() {
  anchors.forEach((world, object) => {
    object.position.subVectors(world, origin)
  })
}

export function toRender(world, out) {
  return out.subVectors(world, origin)
}
