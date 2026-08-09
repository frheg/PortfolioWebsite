import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useScrollReveal } from '../../hooks/useScrollReveal'
import { prefersReducedMotion } from '../../utils/motion'

function ChapterAction({ item }) {
  const className = item.kind === 'secondary'
    ? 'inline-flex min-h-10 items-center justify-center rounded-full border border-white/15 bg-black/20 px-3.5 py-2 text-[0.8rem] font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-cyan-300/40 hover:text-cyan-100 sm:min-h-11 sm:px-4 sm:py-2.5 sm:text-sm'
    : 'inline-flex min-h-10 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-300/10 px-3.5 py-2 text-[0.8rem] font-semibold text-cyan-100 transition hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-cyan-300/18 sm:min-h-11 sm:px-4 sm:py-2.5 sm:text-sm'

  if (item.to) {
    return <Link to={item.to} className={className}>{item.label}</Link>
  }

  // In-chapter anchor jumps use an explicit scrollIntoView call rather than
  // relying on native anchor + CSS scroll-behavior, so they stay well
  // defined alongside ScrollTrigger's own scroll-position math.
  const onClick = (event) => {
    const id = item.href?.replace('#', '')
    const target = id ? document.getElementById(id) : null
    if (!target) return
    event.preventDefault()
    target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
  }

  return <a href={item.href} onClick={onClick} className={className}>{item.label}</a>
}

// Chapter-break moment for the merged long page. Reuses the same
// scrub-based useScrollReveal every other card on the page uses, rather
// than a bespoke pinned timeline — an earlier pinned version kept fighting
// this site's own scroll-driven camera system (which also measures and
// re-scrolls the page), producing glitches on every one of these that a
// pin-timing tweak couldn't reliably fix. This is deliberately simpler.
export default function ChapterIntro({ eyebrow, title, description, actions = [] }) {
  const headingRef = useRef(null)
  const descRef = useRef(null)
  const actionsRef = useRef(null)

  useScrollReveal(headingRef, { variant: 'up' })
  useScrollReveal(descRef, { variant: 'up', delay: 0.08 })
  useScrollReveal(actionsRef, { variant: 'up', delay: 0.16 })

  return (
    <section className="relative mx-auto flex min-h-[70svh] w-full max-w-6xl flex-col justify-center px-4 py-12 sm:min-h-[85vh] sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-[1.8rem] border border-white/10 bg-slate-950/45 p-5 shadow-[0_30px_80px_rgba(8,15,35,0.4)] backdrop-blur-xl sm:rounded-[2rem] sm:p-8 md:p-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-cyan-300/10 blur-3xl" />
        <p className="mb-3 text-[0.7rem] font-medium uppercase tracking-[0.24em] text-cyan-300/75 sm:text-xs sm:tracking-[0.34em]">{eyebrow}</p>
        <h1 ref={headingRef} className="font-display text-[2rem] font-semibold tracking-[0.02em] text-white sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        <p ref={descRef} className="mt-4 max-w-3xl text-[0.95rem] leading-6 text-slate-200/84 sm:mt-5 sm:text-lg sm:leading-8">
          {description}
        </p>
        {actions.length ? (
          <div ref={actionsRef} className="mt-6 flex flex-wrap gap-2.5 sm:mt-8 sm:gap-3">
            {actions.map((item) => (
              <ChapterAction key={`${item.label}-${item.to || item.href}`} item={item} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
