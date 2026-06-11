import { useSyncExternalStore } from 'react'
import {
  isExplorePaused,
  subscribeExplorePause,
  resumeExplore,
} from '../three/exploreState'

export default function ExplorePauseOverlay() {
  const paused = useSyncExternalStore(
    subscribeExplorePause,
    isExplorePaused,
    isExplorePaused
  )

  if (!paused) return null

  return (
    /* Clicking the backdrop also resumes — quick shortcut for experienced players */
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm"
      onClick={resumeExplore}
      aria-label="Explore mode paused — click to resume"
    >
      {/* Card — stopPropagation so inner clicks don't bubble to backdrop */}
      <div
        className="mx-4 w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950/88 px-8 py-8 text-center shadow-[0_24px_64px_rgba(0,0,0,0.7)] backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[0.6rem] uppercase tracking-[0.35em] text-cyan-400/70">Explore Mode</p>
        <h2 className="mt-1 text-2xl font-light uppercase tracking-[0.25em] text-cyan-100">
          Paused
        </h2>

        <div className="my-6 h-px bg-white/8" />

        <div className="space-y-1 text-[0.68rem] uppercase tracking-[0.16em] text-cyan-100/60">
          <p>Move &nbsp;·&nbsp; W / S &nbsp;·&nbsp; Arrows &nbsp;·&nbsp; K / J</p>
          <p>Turn &nbsp;·&nbsp; A / D &nbsp;·&nbsp; Arrows &nbsp;·&nbsp; H / L</p>
          <p>Look &nbsp;·&nbsp; Mouse</p>
          <p>Tilt &nbsp;·&nbsp; E / Q &nbsp;&nbsp;&nbsp; Boost &nbsp;·&nbsp; Space</p>
          <p className="mt-2 text-cyan-400/50">Pause &nbsp;·&nbsp; P &nbsp;or&nbsp; Esc</p>
        </div>

        <div className="my-6 h-px bg-white/8" />

        <button
          type="button"
          onClick={resumeExplore}
          className="w-full rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-6 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-cyan-200 transition-all hover:bg-cyan-400/20 hover:border-cyan-300/50 active:scale-95"
        >
          Resume
        </button>
        <p className="mt-3 text-[0.58rem] uppercase tracking-[0.18em] text-white/25">
          or press P · or click anywhere
        </p>
      </div>
    </div>
  )
}
