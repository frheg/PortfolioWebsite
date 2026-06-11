import { useEffect, useRef, useSyncExternalStore } from 'react'
import { getExploreBoostSnapshot, setExploreMove, subscribeExploreInput } from '../three/exploreControls'

const BOOST_DRAG_THRESHOLD = 22

function ExploreButton({ direction, label, children, enableBoostDrag = false }) {
  const boostActive = useSyncExternalStore(subscribeExploreInput, getExploreBoostSnapshot, getExploreBoostSnapshot)
  const pointerIdRef = useRef(null)
  const startYRef = useRef(0)

  const updateBoost = (currentY) => {
    if (!enableBoostDrag) return
    setExploreMove('boost', startYRef.current - currentY > BOOST_DRAG_THRESHOLD)
  }

  const activate = (event) => {
    event.preventDefault()
    pointerIdRef.current = event.pointerId
    startYRef.current = event.clientY
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setExploreMove(direction, true)
    updateBoost(event.clientY)
  }

  const deactivate = () => {
    pointerIdRef.current = null
    setExploreMove(direction, false)
    if (enableBoostDrag) {
      setExploreMove('boost', false)
    }
  }

  const onPointerMove = (event) => {
    if (pointerIdRef.current !== event.pointerId) return
    event.preventDefault()
    updateBoost(event.clientY)
  }

  const className = `pointer-events-auto inline-flex h-14 w-14 select-none items-center justify-center rounded-2xl border backdrop-blur-xl touch-none active:scale-95 ${
    enableBoostDrag && boostActive
      ? 'explore-forward-boost border-cyan-200/70 bg-cyan-300/18 text-cyan-50 shadow-[0_0_30px_rgba(103,232,249,0.45)]'
      : 'border-cyan-300/25 bg-slate-950/82 text-cyan-100 shadow-[0_14px_40px_rgba(8,15,35,0.55)]'
  }`

  return (
    <button
      type="button"
      data-explore-control="true"
      aria-label={label}
      className={className}
      draggable="false"
      onPointerDown={activate}
      onPointerMove={onPointerMove}
      onPointerUp={deactivate}
      onPointerLeave={deactivate}
      onPointerCancel={deactivate}
    >
      <span className="select-none text-xl leading-none" aria-hidden="true">{children}</span>
    </button>
  )
}

export default function ExploreMobileControls() {
  useEffect(() => () => {
    setExploreMove('forward', false)
    setExploreMove('backward', false)
    setExploreMove('left', false)
    setExploreMove('right', false)
    setExploreMove('boost', false)
  }, [])

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+0.9rem)] md:hidden">
      <div className="mx-auto flex max-w-6xl items-end justify-between gap-4">
        <div className="grid grid-cols-3 gap-2.5">
          <div />
          <ExploreButton direction="forward" label="Move forward or drag up to boost" enableBoostDrag>^</ExploreButton>
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
