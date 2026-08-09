// Speed control for Explore mode's real-ephemeris solar system, embedded in
// the pause menu — real orbital motion is imperceptibly slow, so this lets
// the visitor speed simulated time up from the 1x (true real-world speed)
// floor. Only ever rendered while paused (see ExplorePauseOverlay), so no
// positioning or pause-visibility logic of its own.
import { useSyncExternalStore } from 'react'
import {
  getSpeedLabel,
  subscribeSpeedMultiplier,
  stepSpeedUp,
  stepSpeedDown,
  canStepSpeedUp,
  canStepSpeedDown,
} from '../three/ephemerisTime'

export default function ExploreTimeControl() {
  const label = useSyncExternalStore(subscribeSpeedMultiplier, getSpeedLabel, getSpeedLabel)
  const canUp = useSyncExternalStore(subscribeSpeedMultiplier, canStepSpeedUp, canStepSpeedUp)
  const canDown = useSyncExternalStore(subscribeSpeedMultiplier, canStepSpeedDown, canStepSpeedDown)

  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
      <span className="text-[0.62rem] uppercase tracking-[0.18em] text-cyan-100/70">Time speed</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Slower"
          onClick={stepSpeedDown}
          disabled={!canDown}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-sm text-cyan-100 transition hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent active:scale-95"
        >
          −
        </button>
        <span className="w-12 select-none text-center text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-cyan-100">
          {label}
        </span>
        <button
          type="button"
          aria-label="Faster"
          onClick={stepSpeedUp}
          disabled={!canUp}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-sm text-cyan-100 transition hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent active:scale-95"
        >
          +
        </button>
      </div>
    </div>
  )
}
