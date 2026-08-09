// Shared "how fast does real astronomical time pass" state for Explore
// mode's real-ephemeris solar system. 1x is true real-world speed (real
// orbital motion is imperceptibly slow on a human timescale) and also the
// floor — this is a way to speed time up from reality, not slow it down.
const PRESETS = [1, 10, 100, 1_000, 10_000, 100_000, 1_000_000]
const LABELS = ['1×', '10×', '100×', '1K×', '10K×', '100K×', '1M×']

let index = 0
const listeners = new Set()

function emit() {
  listeners.forEach((listener) => listener())
}

export function getSpeedMultiplier() {
  return PRESETS[index]
}

export function getSpeedLabel() {
  return LABELS[index]
}

export function subscribeSpeedMultiplier(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function stepSpeedUp() {
  if (index >= PRESETS.length - 1) return
  index += 1
  emit()
}

export function stepSpeedDown() {
  if (index <= 0) return
  index -= 1
  emit()
}

export function canStepSpeedUp() {
  return index < PRESETS.length - 1
}

export function canStepSpeedDown() {
  return index > 0
}

// The date the real-ephemeris solar system is currently simulating —
// published by useSolarSystem.js each frame (it's the one already doing this
// math for planet positions) and polled by HUD readouts, same pattern as
// cameraRuntime.js's speed. Advances with the multiplier above, so cranking
// speed up visibly fast-forwards this too, not just the planets.
let simulatedDateMs = Date.now()

export function setSimulatedDateMs(ms) {
  simulatedDateMs = ms
}

export function getSimulatedDateMs() {
  return simulatedDateMs
}
