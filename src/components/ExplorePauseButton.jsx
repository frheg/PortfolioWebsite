// A small, always-reachable pause button for Explore mode on mobile, where
// there's no keyboard for the P/Esc shortcut. Desktop already has that, so
// this stays hidden there instead of duplicating it.
import { useSyncExternalStore } from 'react'
import { isExplorePaused, subscribeExplorePause, pauseExplore } from '../three/exploreState'

export default function ExplorePauseButton() {
  const paused = useSyncExternalStore(subscribeExplorePause, isExplorePaused, isExplorePaused)

  // While paused, ExplorePauseOverlay already covers the screen with its
  // own Resume button — no need for this one too.
  if (paused) return null

  return (
    <button
      type="button"
      data-explore-control="true"
      aria-label="Pause"
      onClick={pauseExplore}
      className="pointer-events-auto fixed right-4 top-4 z-40 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-slate-950/70 text-cyan-100 shadow-[0_10px_30px_rgba(17,17,27,0.5)] backdrop-blur-xl transition hover:border-cyan-300/40 hover:text-cyan-50 active:scale-95 sm:top-5 md:hidden"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
        <rect x="6" y="5" width="4" height="14" rx="1" />
        <rect x="14" y="5" width="4" height="14" rx="1" />
      </svg>
    </button>
  )
}
