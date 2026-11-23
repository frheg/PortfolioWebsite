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
