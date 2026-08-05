import { Link } from 'react-router-dom'

export default function ReturnToRailroadButton() {
  return (
    <div className="pointer-events-none fixed right-4 top-[4.9rem] z-40 sm:top-[5.3rem]">
      <Link
        to="/"
        data-explore-control="true"
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-slate-950/82 px-4 py-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-cyan-100 shadow-[0_16px_44px_rgba(8,15,35,0.5)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-cyan-300/15"
      >
        Return to railroad
      </Link>
    </div>
  )
}
