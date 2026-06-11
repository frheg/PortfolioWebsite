import { useEffect } from 'react'
import { setExploreMove } from '../three/exploreControls'

function ExploreButton({ direction, label, children }) {
  const activate = (event) => {
    event.preventDefault()
    setExploreMove(direction, true)
  }

  const deactivate = () => {
    setExploreMove(direction, false)
  }

  return (
    <button
      type="button"
      data-explore-control="true"
      aria-label={label}
      className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/25 bg-slate-950/82 text-cyan-100 shadow-[0_14px_40px_rgba(8,15,35,0.55)] backdrop-blur-xl touch-none active:scale-95"
      onPointerDown={activate}
      onPointerUp={deactivate}
      onPointerLeave={deactivate}
      onPointerCancel={deactivate}
    >
      <span className="text-xl leading-none">{children}</span>
    </button>
  )
}

export default function ExploreMobileControls() {
  useEffect(() => () => {
    setExploreMove('forward', false)
    setExploreMove('backward', false)
    setExploreMove('left', false)
    setExploreMove('right', false)
  }, [])

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+0.9rem)] md:hidden">
      <div className="mx-auto flex max-w-6xl items-end justify-between gap-4">
        <div className="grid grid-cols-3 gap-2.5">
          <div />
          <ExploreButton direction="forward" label="Move forward">^</ExploreButton>
          <div />
          <ExploreButton direction="left" label="Move left">&lt;</ExploreButton>
          <div className="pointer-events-none h-14 w-14 rounded-2xl border border-white/8 bg-slate-950/35 backdrop-blur-md" />
          <ExploreButton direction="right" label="Move right">&gt;</ExploreButton>
          <div />
          <ExploreButton direction="backward" label="Move backward">v</ExploreButton>
          <div />
        </div>
      </div>
    </div>
  )
}
