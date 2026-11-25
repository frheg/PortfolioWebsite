// Render quality presets. Auto-picked per device, user override persisted (localStorage), live-applied.
// Three-free → pause menu (main bundle) can import it. Consumers read `quality` (mutated in place).
const PRESETS = {
  low: { pixelRatio: 1, msaa: 0, bloom: false, atmoSteps: 10, terrainSplitScale: 1.6 },
  medium: { pixelRatio: 1.5, msaa: 0, bloom: true, atmoSteps: 14, terrainSplitScale: 1.2 },
  high: { pixelRatio: 2, msaa: 4, bloom: true, atmoSteps: 20, terrainSplitScale: 1 },
}

export const QUALITY_LEVELS = [
  { id: 'low', label: 'Lav' },
  { id: 'medium', label: 'Middels' },
  { id: 'high', label: 'Høy' },
]

const STORAGE_KEY = 'space-quality'

function autoLevel() {
  if (typeof navigator === 'undefined') return 'high'
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || navigator.maxTouchPoints > 2
  return mobile ? 'medium' : 'high'
}

function storedLevel() {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    return v && PRESETS[v] ? v : null
  } catch {
    return null
  }
}

let level = storedLevel() ?? autoLevel()
export const quality = { level, ...PRESETS[level] }
const listeners = new Set()

export function getQualityLevel() {
  return level
}

export function setQualityLevel(next) {
  if (!PRESETS[next] || next === level) return
  level = next
  Object.assign(quality, { level, ...PRESETS[next] })
  try {
    window.localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // private mode etc → session-only
  }
  listeners.forEach((l) => l())
}

export function subscribeQuality(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
