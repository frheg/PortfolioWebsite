// Compact page-navigation grid embedded in the pause menu — Explore mode has
// no persistent navbar of its own (FloatingNav is hidden there so it doesn't
// clutter the flight view), so this is how you get to another page from it.
import { NavLink } from 'react-router-dom'
import { useNavLinks } from '../content/navLinks'
import NavIcon from './NavIcon'

export default function ExplorePauseNav() {
  const navLinks = useNavLinks()
  return (
    <div className="grid grid-cols-3 gap-2">
      {navLinks.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-[0.58rem] font-medium uppercase tracking-[0.08em] transition ${
              isActive
                ? 'border-cyan-300/40 bg-cyan-300/15 text-cyan-100'
                : 'border-white/10 bg-black/20 text-cyan-100/70 hover:border-cyan-300/25 hover:text-cyan-100'
            }`
          }
        >
          <NavIcon name={icon} className="h-4 w-4" />
          <span>{label}</span>
        </NavLink>
      ))}
    </div>
  )
}
