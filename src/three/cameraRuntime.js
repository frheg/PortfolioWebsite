// Shared camera telemetry for non-Three.js consumers (speed HUD, audio).
// useScrollCamera writes every explore frame.

let _speed = 0
let _throttle = 0

// km/s
export function setCameraSpeed(speed) {
  _speed = speed
}

export function getCameraSpeed() {
  return _speed
}

// 0..1, speed vs local cap. Speed itself spans ~12 decades → useless for audio.
export function setCameraThrottle(throttle) {
  _throttle = throttle
}

export function getCameraThrottle() {
  return _throttle
}

// Live camera object (rotation only; world pos = floatingOrigin.origin). For HUD instruments.
let _camera = null

export function setActiveCamera(camera) {
  _camera = camera
}

export function getActiveCamera() {
  return _camera
}

// Speed streaks: strength 0..1 + world travel dir. Written by camera, read by post composite.
const _warp = { strength: 0, x: 0, y: 0, z: -1 }

export function setWarp(strength, x, y, z) {
  _warp.strength = strength
  _warp.x = x
  _warp.y = y
  _warp.z = z
}

export function getWarp() {
  return _warp
}

// Boost tunnel vision 0..1 (eased boost blend). Written by camera, read by post composite.
let _tunnel = 0

export function setTunnel(value) {
  _tunnel = value
}

export function getTunnel() {
  return _tunnel
}
