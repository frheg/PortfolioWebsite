// Shared chapter scroll-offset telemetry. LongPage (DOM) measures each
// chapter section's offsetTop and writes here; useScrollCamera (Three.js
// render loop) reads it every frame. The two live in sibling trees under
// App.jsx with no prop path between them, so this is a tiny module-level
// singleton, mirroring cameraRuntime.js's get/set pattern.
let _offsets = []

export function setChapterOffsets(offsets) {
  _offsets = offsets
}

export function getChapterOffsets() {
  return _offsets
}

// Travel ranges [startY, endY] per gap between chapters (LongPage spacers). Camera flies only inside these.
let _travel = []

export function setTravelRanges(ranges) {
  _travel = ranges
}

export function getTravelRanges() {
  return _travel
}

// Bergen-stop progress 0..1 (0 before it, hold 0 → 1, 1 after). Drives Bergen's scroll-mode time of day.
let _home = 0

export function setHomeProgress(value) {
  _home = value
}

export function getHomeProgress() {
  return _home
}
