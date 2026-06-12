// Shared camera telemetry for non-Three.js consumers (e.g. the audio hook).
// useScrollCamera writes here every explore frame; useExploreAudio reads it.

let _speed = 0

export function setCameraSpeed(speed) {
  _speed = speed
}

export function getCameraSpeed() {
  return _speed
}
