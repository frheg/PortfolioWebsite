import { Link } from 'react-router-dom'

export default function TakeControlButton() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.6rem)] z-30 flex justify-center px-4">
      <Link
        to="/explore"
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-slate-950/80 px-5 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100 shadow-[0_18px_50px_rgba(8,15,35,0.55)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-cyan-300/15"
      >
        Take control
      </Link>
    </div>
  )
}
