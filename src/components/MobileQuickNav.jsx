import { NavLink } from 'react-router-dom'
import { navLinks } from '../content/navLinks'

export default function MobileQuickNav() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] md:hidden">
      <div className="pointer-events-auto mx-auto max-w-sm overflow-hidden rounded-[1.4rem] border border-white/10 bg-slate-950/88 shadow-[0_18px_50px_rgba(8,15,35,0.55)] backdrop-blur-xl">
        <div className="h-px bg-gradient-to-r from-transparent via-cyan-300/45 to-transparent" />
        <div className="grid grid-cols-5 gap-1.5 p-1.5">
          {navLinks.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `rounded-xl px-2 py-2 text-center text-[0.62rem] font-medium uppercase tracking-[0.16em] transition ${
                  isActive
                    ? 'bg-cyan-300/15 text-cyan-100 shadow-[0_0_14px_rgba(103,232,249,0.12)]'
                    : 'text-cyan-300/78 hover:bg-white/5 hover:text-cyan-100'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  )
}
