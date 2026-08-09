// Live "what date is the solar system simulating right now" text — shared by
// the always-on HUD and the pause menu so both read the same ticking clock.
// Direct DOM text mutation each frame, same pattern as ExploreSpeedHud.
import { useEffect, useRef } from 'react'
import { getSimulatedDateMs } from '../three/ephemerisTime'

const formatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export default function ExploreDateReadout({ className = '' }) {
  const textRef = useRef(null)

  useEffect(() => {
    let frameId

    const tick = () => {
      const el = textRef.current
      if (el) el.textContent = formatter.format(new Date(getSimulatedDateMs()))
      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [])

  return (
    <span ref={textRef} className={className}>
      —
    </span>
  )
}
