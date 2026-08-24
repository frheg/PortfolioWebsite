// FloatingNav — the site's only navigation: a compact floating pill-bar
// anchored to the bottom of the viewport, used on both desktop and mobile.
// Icon-first on narrow screens (stacked icon + tiny label, like a native tab
// bar) since there isn't room for six full text labels in one row there;
// icon + label side by side once there's more width.
import { NavLink } from 'react-router-dom'
import { navLinks } from '../content/navLinks'
import NavIcon from './NavIcon'

export default function FloatingNav() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.6rem)]"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="pointer-events-auto mx-auto w-full overflow-visible sm:w-fit sm:max-w-2xl">
        <div className="overflow-visible rounded-[1.4rem] border border-white/10 bg-slate-950/88 shadow-[0_18px_50px_rgba(17,17,27,0.55)] backdrop-blur-xl">
          <div className="h-px bg-gradient-to-r from-transparent via-cyan-300/45 to-transparent" />
          <div className="flex items-center justify-between gap-1 overflow-visible p-1.5 sm:justify-center sm:gap-1.5">
            {navLinks.map(({ to, label, icon, featured, sticker }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                aria-label={label}
                className={({ isActive }) =>
                  `relative isolate flex flex-1 flex-col items-center gap-0.5 overflow-visible whitespace-nowrap rounded-xl px-1.5 py-1.5 text-center text-[0.58rem] font-medium uppercase tracking-[0.1em] transition sm:flex-none sm:flex-row sm:gap-1.5 sm:px-3 sm:py-2 sm:text-[0.62rem] sm:tracking-[0.16em] ${
                    featured
                      ? isActive
                        ? 'explore-pill-mobile bg-cyan-300/18 text-cyan-50 shadow-[0_0_18px_rgba(148,162,249,0.16)]'
                        : 'explore-pill-mobile text-cyan-100 shadow-[0_0_16px_rgba(148,162,249,0.12)] hover:bg-cyan-300/12 hover:text-cyan-50'
                      : isActive
                        ? 'bg-cyan-300/15 text-cyan-100 shadow-[0_0_14px_rgba(148,162,249,0.12)]'
                        : 'text-cyan-300/78 hover:bg-white/5 hover:text-cyan-100'
                  }`
                }
              >
                <span className="relative inline-flex items-center justify-center overflow-visible">
                  <NavIcon name={icon} className="h-5 w-5 sm:h-4 sm:w-4" />
                  {featured ? <span className="explore-sticker explore-sticker--mobile">{sticker}</span> : null}
                </span>
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
