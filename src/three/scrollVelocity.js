// Shared scroll-speed telemetry, separate from cameraRuntime.js's explore
// ship-velocity channel (that one is explore-specific and gets zeroed
// outside of explore mode — reusing it here would either no-op or corrupt
// useExploreAudio's engine-sound mapping). useScrollCamera publishes a
// smoothed 0-1 "how fast is the user scrolling" value; useStarField reads
// it to blend the same visual boost explore mode already uses.
let _velocity = 0

export function setScrollVelocity(velocity) {
  _velocity = velocity
}

export function getScrollVelocity() {
  return _velocity
}
