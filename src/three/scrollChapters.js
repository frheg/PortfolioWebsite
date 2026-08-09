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
