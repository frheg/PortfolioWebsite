import { useEffect, useState } from 'react'

const sections = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'about', label: 'About' },
  { id: 'experience', label: 'Experience' },
  { id: 'education', label: 'Education' },
  { id: 'projects', label: 'Projects' },
  { id: 'boardpositions', label: 'Board' },
  { id: 'courses', label: 'Courses' },
  { id: 'skills', label: 'Skills' },
  { id: 'contact', label: 'Contact' },
]

export default function Nav() {
  const [active, setActive] = useState(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const observers = []
    sections.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActive(id)
        },
        { root: null, rootMargin: '0px 0px -60% 0px', threshold: 0.1 }
      )
      obs.observe(el)
      observers.push(obs)
    })
    return () => observers.forEach((o) => o.disconnect())
  }, [])

  const linkClass = (isActive) =>
    `whitespace-nowrap px-3 py-2 rounded-md text-sm transition-colors ${
      isActive ? 'bg-cyan-500/20 text-cyan-200' : 'text-cyan-300 hover:text-cyan-200'
    }`

  const Links = ({ vertical = false }) => (
    <div className={`${vertical ? 'flex flex-col py-2' : 'flex items-center gap-2'} overflow-x-auto`}>
      {sections.map(({ id, label }) => {
        const isActive = active === id
        return (
          <a
            key={id}
            href={`#${id}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => setOpen(false)}
            className={linkClass(isActive)}
          >
            {label}
          </a>
        )
      })}
    </div>
  )

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-30 bg-black/50 backdrop-blur-sm border-b border-white/10"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
        <a href="#welcome" className="font-semibold text-cyan-200 hover:text-cyan-100">
          FH
        </a>
        <button
          className="md:hidden inline-flex items-center justify-center rounded-md px-3 py-2 text-cyan-200 hover:text-cyan-100 hover:bg-white/10 transition"
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
      <div id="mobile-menu" className={`${open ? 'block' : 'hidden'} md:hidden border-t border-white/10 px-4 pb-2`}>
        <Links vertical />
      </div>
    </nav>
  )
}
