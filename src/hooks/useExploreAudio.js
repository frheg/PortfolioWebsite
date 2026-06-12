// useExploreAudio — ambient + dynamic engine sounds for the explore page.
//
// Ambient:
//   Loops the entire time /explore is active (including while paused).
//   Stopped and released only when leaving the page.
//
// Engine (velocity-driven):
//   Always playing, even while paused, but at a quiet idle.
//   Volume and playbackRate track the camera's real linear speed each frame:
//
//     speed = 0          → idle   (vol IDLE_VOL, rate IDLE_RATE)
//     speed = MAX_SPEED  → max    (vol MAX_VOL,  rate MAX_RATE)
//
//   Transitions use per-frame lerp with a configurable smoothing factor so
//   the engine spools up and down smoothly with the ship's inertia.
import { useEffect } from 'react'
import { getCameraSpeed } from '../three/cameraRuntime'
import ambientUrl from '../assets/Sounds/audiopapkin-ambient-soundscapes-007-space-atmosphere-304974.mp3'
import engineUrl from '../assets/Sounds/fronbondi_skegs-sfx-growling-pulsating-engine-sound-effect-359943.mp3'

// ── Engine tuning ─────────────────────────────────────────────────────────────
const IDLE_VOL   = 0.40   // volume at rest
const MAX_VOL    = 2.92   // volume at full speed
const IDLE_RATE  = 0.90   // playbackRate at rest  (low rumble)
const MAX_RATE   = 5   // playbackRate at max speed (high roar)
const MAX_SPEED  = 100    // world-units/sec (≈ new moveSpeed × boostMultiplier)
const LERP       = 3.5    // smoothing factor (higher = tighter tracking)

export function useExploreAudio(isExplore) {
  useEffect(() => {
    if (!isExplore) return undefined

    // ── Ambient ─────────────────────────────────────────────────────────────
    const ambient = new Audio(ambientUrl)
    ambient.loop   = true
    ambient.volume = 0.30
    ambient.play().catch(() => {})   // starts on the Resume user-gesture

    // ── Engine ──────────────────────────────────────────────────────────────
    const engine = new Audio(engineUrl)
    engine.loop         = true
    engine.volume       = IDLE_VOL
    engine.playbackRate = IDLE_RATE
    engine.play().catch(() => {})

    let currentVol  = IDLE_VOL
    let currentRate = IDLE_RATE
    let lastTs      = performance.now()
    let rafId       = null

    const tick = (now) => {
      rafId = requestAnimationFrame(tick)

      const dt = Math.min((now - lastTs) / 1000, 0.1)
      lastTs = now

      // Map actual camera speed to a 0–1 ratio
      const ratio = Math.min(getCameraSpeed() / MAX_SPEED, 1)

      const targetVol  = IDLE_VOL  + (MAX_VOL  - IDLE_VOL)  * ratio
      const targetRate = IDLE_RATE + (MAX_RATE  - IDLE_RATE) * ratio

      // Smooth lerp — same factor both ways so the engine mirrors the ship inertia
      const t = Math.min(LERP * dt, 1)
      currentVol  += (targetVol  - currentVol)  * t
      currentRate += (targetRate - currentRate) * t

      engine.volume       = currentVol
      engine.playbackRate = currentRate
    }

    rafId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafId)
      ambient.pause()
      engine.pause()
      ambient.src = ''
      engine.src  = ''
    }
  }, [isExplore])
}
