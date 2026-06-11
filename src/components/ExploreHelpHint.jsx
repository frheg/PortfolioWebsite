export default function ExploreHelpHint() {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[4.9rem] z-40 px-4 sm:top-[5.3rem]">
      <div className="mx-auto flex max-w-6xl justify-end">
        <div className="max-w-[19rem] rounded-2xl border border-white/10 bg-slate-950/78 px-3.5 py-3 text-[0.68rem] uppercase tracking-[0.14em] text-cyan-100/82 shadow-[0_16px_44px_rgba(8,15,35,0.5)] backdrop-blur-xl sm:max-w-[22rem] sm:text-[0.72rem]">
          <p className="font-semibold tracking-[0.2em] text-cyan-200/92">Explore Mode</p>
          <p className="mt-1 hidden leading-6 text-cyan-100/72 md:block">
            Move: WASD, arrows, HJKL. Turn: mouse drag or Q/E. Pitch: Shift/Ctrl. Boost: Space while moving forward.
          </p>
          <p className="mt-1 leading-6 text-cyan-100/72 md:hidden">
            Drag to look. Use the on-screen pad to move.
          </p>
        </div>
      </div>
    </div>
  )
}
