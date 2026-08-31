import { useSyncExternalStore } from 'react'
import {
  isExplorePaused,
  subscribeExplorePause,
  resumeExplore,
} from '../three/exploreState'
import ExploreDateReadout from './ExploreDateReadout'
import ExploreTimeControl from './ExploreTimeControl'
import ExplorePauseNav from './ExplorePauseNav'
import { useT } from '../i18n/useT'

export default function ExplorePauseOverlay() {
  const paused = useSyncExternalStore(
    subscribeExplorePause,
    isExplorePaused,
    isExplorePaused
  )
  const t = useT()

  if (!paused) return null

  return (
    /* Full-screen backdrop (inset-0) so there is no gap, but z-30 keeps it
       below the navbar (z-40) so the nav is never blurred or dimmed. */
    <div
      className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm"
      aria-label={t.explore.modePausedAria}
    >
      <div
        className="pointer-events-auto mx-4 max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/88 px-8 py-8 text-center shadow-[0_24px_64px_rgba(17,17,27,0.7)] backdrop-blur-xl"
      >
        <p className="text-[0.6rem] uppercase tracking-[0.35em] text-cyan-400/70">{t.explore.modeLabel}</p>
        <h2 className="mt-1 text-2xl font-light uppercase tracking-[0.25em] text-cyan-100">
          {t.explore.paused}
        </h2>
        <ExploreDateReadout className="mt-2 block text-[0.62rem] uppercase tracking-[0.14em] text-cyan-100/55" />

        <div className="my-6 h-px bg-white/8" />

        <div className="space-y-1 text-[0.68rem] uppercase tracking-[0.16em] text-cyan-100/60">
          <p>{t.explore.controlsMove}</p>
          <p>{t.explore.controlsTurn}</p>
          <p>{t.explore.controlsLook}</p>
          <p>{t.explore.controlsTiltBoost}</p>
          <p className="mt-2 text-cyan-400/50">{t.explore.controlsPause}</p>
        </div>

        <div className="my-6 h-px bg-white/8" />

        <ExploreTimeControl />

        <div className="my-6 h-px bg-white/8" />

        <p className="mb-3 text-[0.6rem] uppercase tracking-[0.28em] text-cyan-100/50">{t.nav.goTo}</p>
        <ExplorePauseNav />

        <div className="my-6 h-px bg-white/8" />

        <button
          type="button"
          onClick={resumeExplore}
          className="w-full rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-6 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-cyan-200 transition-all hover:bg-cyan-400/20 hover:border-cyan-300/50 active:scale-95"
        >
          {t.explore.resume}
        </button>
        <p className="mt-3 text-[0.58rem] uppercase tracking-[0.18em] text-white/25">
          {t.explore.resumeHint}
        </p>
      </div>
    </div>
  )
}
