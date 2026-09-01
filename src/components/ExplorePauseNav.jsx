// Compact page-navigation grid embedded in the pause menu — Explore mode has
// no persistent navbar of its own (FloatingNav is hidden there so it doesn't
// clutter the flight view), so this is how you get back to the main page
// from it. The 5 content items navigate to '/' and ask LongPage to
// deep-link straight to that section (see LongPage's mount effect).
import { Link, NavLink } from 'react-router-dom'
import { navLinks } from '../content/navLinks'
import NavIcon from './NavIcon'

const INACTIVE_CLASS = 'border-white/10 bg-black/20 text-cyan-100/70 hover:border-cyan-300/25 hover:text-cyan-100'
const ITEM_CLASS = 'flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-[0.58rem] font-medium uppercase tracking-[0.08em] transition'

export default function ExplorePauseNav() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {navLinks.map((item) =>
        item.route ? (
          <NavLink
            key={item.route}
            to={item.route}
            className={({ isActive }) =>
              `${ITEM_CLASS} ${isActive ? 'border-cyan-300/40 bg-cyan-300/15 text-cyan-100' : INACTIVE_CLASS}`
            }
          >
            <NavIcon name={item.icon} className="h-4 w-4" />
            <span>{item.label}</span>
          </NavLink>
        ) : (
          <Link
            key={item.chapterKey}
            to="/"
            state={{ scrollToChapter: item.chapterKey }}
            className={`${ITEM_CLASS} ${INACTIVE_CLASS}`}
          >
            <NavIcon name={item.icon} className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        )
      )}
    </div>
  )
}
