// Always-on readout of the real-ephemeris solar system's current simulated
// date, top-left — mirrors ExploreSpeedHud's placement/behavior.
import { useSyncExternalStore } from 'react'
import { isExplorePaused, subscribeExplorePause } from '../three/exploreState'
import ExploreDateReadout from './ExploreDateReadout'

export default function ExploreDateHud() {
  const paused = useSyncExternalStore(subscribeExplorePause, isExplorePaused, isExplorePaused)

  if (paused) return null

  return (
    <div className="pointer-events-none fixed left-4 top-4 z-40 sm:top-5">
      <div className="rounded-full border border-white/15 bg-slate-950/70 px-4 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-cyan-100 shadow-[0_10px_30px_rgba(17,17,27,0.5)] backdrop-blur-xl">
        <ExploreDateReadout />
      </div>
    </div>
  )
}
