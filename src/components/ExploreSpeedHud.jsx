// Tiny always-on HUD for Explore mode: shows the camera's real-world-scaled
// flight speed. Reuses the per-frame speed useScrollCamera already publishes
// (see cameraRuntime.js) — no new tracking needed, just a unit conversion.
// Direct DOM text mutation each frame (no React state) to avoid a 60fps
// re-render, matching the pattern already used by PlanetLabels/FlythroughCards.
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { getCameraSpeed } from '../three/cameraRuntime'
import { spaceConfig } from '../three/spaceConfig'
import { isExplorePaused, subscribeExplorePause } from '../three/exploreState'

const EARTH_RADIUS_KM = 6371
const earthDef = spaceConfig.solarSystem.bodies.find((body) => body.key === 'earth')
// Same anchoring idea as ephemeris.js's AU scale: derive a real-world scale
// from the one body whose real size we know, rather than inventing a number.
const KM_PER_SCENE_UNIT = EARTH_RADIUS_KM / earthDef.radius
const LIGHT_SPEED_KM_PER_H = 299792.458 * 3600

export default function ExploreSpeedHud() {
  const textRef = useRef(null)
  const paused = useSyncExternalStore(subscribeExplorePause, isExplorePaused, isExplorePaused)

  useEffect(() => {
    let frameId

    const tick = () => {
      const kmPerHour = getCameraSpeed() * KM_PER_SCENE_UNIT * 3600
      const el = textRef.current
      if (el) {
        el.textContent =
          kmPerHour >= LIGHT_SPEED_KM_PER_H
            ? `${(kmPerHour / LIGHT_SPEED_KM_PER_H).toFixed(2)}c`
            : `${Math.round(kmPerHour).toLocaleString('en-US')} km/t`
      }
      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [])

  if (paused) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center sm:top-5">
      <div className="rounded-full border border-white/15 bg-slate-950/70 px-4 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-cyan-100 shadow-[0_10px_30px_rgba(17,17,27,0.5)] backdrop-blur-xl">
        <span ref={textRef}>0 km/t</span>
      </div>
    </div>
  )
}
