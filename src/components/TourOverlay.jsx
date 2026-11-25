// Guided tour captions: title + facts per stop (fade in on arrival), progress line, exit (button / Esc).
// Page UI hidden + scroll locked meanwhile (body.tour-active).
import { useEffect, useSyncExternalStore } from 'react'
import { getTourState, stopTour, subscribeTour } from '../utils/tourState'
import { spaceConfig } from '../three/spaceConfig'

const stops = spaceConfig.camera.tour.stops

export default function TourOverlay() {
  const tour = useSyncExternalStore(subscribeTour, getTourState, getTourState)
  const { active, step, phase, progress } = tour

  useEffect(() => {
    if (!active) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') stopTour()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [active])

  if (!active) return null
  // Flying on (leg / return): keep the last stop's text while it fades out.
  const shownStep = phase === 'hold' ? step : step - 1
  const stop = stops[shownStep]
  const showCaption = phase === 'hold' && stop

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-3 px-4 pb-[calc(env(safe-area-inset-bottom)+1.2rem)]">
      <div
        className={`tour-caption w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/70 px-5 py-4 text-center shadow-[0_18px_50px_rgba(17,17,27,0.55)] backdrop-blur-xl ${showCaption ? 'tour-caption--in' : ''}`}
      >
        {stop ? (
          <>
            <p className="text-[0.6rem] uppercase tracking-[0.32em] text-cyan-300/70">
              Omvisning · {shownStep + 1} / {stops.length}
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-wide text-cyan-50">{stop.title}</h2>
            <ul className="mt-2 space-y-1 text-[0.8rem] leading-relaxed text-cyan-100/85">
              {stop.facts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
      <div className="flex w-full max-w-md items-center gap-3">
        <div className="h-px flex-1 overflow-hidden bg-white/10">
          <div className="h-full origin-left bg-cyan-300/70" style={{ transform: `scaleX(${progress})` }} />
        </div>
        <button
          type="button"
          onClick={stopTour}
          disabled={phase === 'return' || phase === 'stopping'}
          className="pointer-events-auto rounded-xl border border-white/10 bg-slate-950/70 px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.16em] text-cyan-200 backdrop-blur-xl transition hover:bg-white/10 disabled:opacity-40"
        >
          Avslutt
        </button>
      </div>
    </div>
  )
}
