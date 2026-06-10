import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { navLinks } from '../content/navLinks'

export default function Nav() {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    const onResize = () => setOpen(false)
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  const linkClass = (isActive) =>
    `whitespace-nowrap rounded-full border px-3 py-2 text-sm font-medium tracking-[0.18em] uppercase transition duration-300 ${
      isActive
        ? 'border-cyan-300/50 bg-cyan-300/15 text-cyan-100 shadow-[0_0_18px_rgba(103,232,249,0.18)]'
        : 'border-white/10 bg-black/10 text-cyan-300 hover:border-cyan-300/30 hover:text-cyan-100 hover:bg-cyan-300/10'
    }`

  const Links = ({ vertical = false }) => (
    <div className={`${vertical ? 'flex flex-col gap-2 py-2' : 'flex items-center gap-2'} overflow-x-auto`}>
      {navLinks.map(({ to, label }) => {
        return (
          <NavLink
            key={to}
            to={to}
            onClick={() => setOpen(false)}
            className={({ isActive }) => `${linkClass(isActive)} ${vertical ? 'w-full justify-center py-3 text-center' : ''}`}
            end={to === '/'}
          >
            {label}
          </NavLink>
        )
      })}
    </div>
  )

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-40 border-b border-white/10 bg-slate-950/40 backdrop-blur-xl"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="group flex items-center gap-3 text-cyan-100">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-300/10 font-display text-sm font-semibold shadow-[0_0_22px_rgba(103,232,249,0.18)] transition group-hover:scale-105 group-hover:border-cyan-200/70">
            FH
          </span>
          <span className="hidden sm:block leading-none">
            <span className="block font-display text-sm font-semibold tracking-[0.26em] text-cyan-100">FREDRIC HEGLAND</span>
            <span className="mt-1 block text-xs uppercase tracking-[0.28em] text-cyan-300/80">Software engineering in orbit</span>
          </span>
        </Link>
        <button
          className="inline-flex items-center justify-center rounded-full border border-white/10 bg-black/20 px-3 py-2 text-cyan-200 transition hover:border-cyan-300/40 hover:text-cyan-100 hover:bg-white/10 md:hidden"
          aria-label="Toggle menu"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6">
            {open ? (
              <path
                fillRule="evenodd"
                d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            ) : (
              <path
                fillRule="evenodd"
                d="M3.75 6.75a.75.75 0 0 1 .75-.75h15a.75.75 0 0 1 0 1.5H4.5a.75.75 0 0 1-.75-.75Zm0 5.25c0-.414.336-.75.75-.75h15a.75.75 0 0 1 0 1.5H4.5a.75.75 0 0 1-.75-.75Zm.75 4.5a.75.75 0 0 0 0 1.5h15a.75.75 0 0 0 0-1.5H4.5Z"
                clipRule="evenodd"
              />
            )}
          </svg>
        </button>
        <div className="hidden md:block">
          <Links />
        </div>
      </div>
      <div className={`${open ? 'block' : 'hidden'} md:hidden`}>
        <button
          type="button"
          aria-label="Close menu overlay"
          className="fixed inset-0 top-[72px] bg-slate-950/55 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
        <div id="mobile-menu" className="relative border-t border-white/10 px-4 pb-4 pt-3">
          <div className="mx-auto max-w-6xl rounded-[1.75rem] border border-white/10 bg-slate-950/90 p-3 shadow-[0_20px_60px_rgba(8,15,35,0.55)]">
            <Links vertical />
          </div>
        </div>
      </div>
    </nav>
  )
}
