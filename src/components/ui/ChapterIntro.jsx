import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { loadGsap } from '../../utils/gsapLoader'
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

// Chapter-break moment for the merged long page: pins briefly at the top
// of the viewport while heading/description/actions reveal, then releases
// into the chapter's own content beneath. Replaces the old per-route
// PageHero card with something closer to the "chapter break" feel used
// throughout the reference site the animation direction is modeled on.
export default function ChapterIntro({ eyebrow, title, description, actions = [] }) {
  const sectionRef = useRef(null)
  const headingRef = useRef(null)
  const descRef = useRef(null)
  const actionsRef = useRef(null)

  useEffect(() => {
    if (prefersReducedMotion()) return undefined
    let scrollTrigger
    let cancelled = false

    loadGsap().then(({ gsap }) => {
      if (cancelled || !sectionRef.current) return

      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: '+=55%',
          scrub: 0.6,
          pin: true,
          pinSpacing: true,
        },
      })

      timeline
        .from(headingRef.current, { autoAlpha: 0, y: 70, scale: 0.94, ease: 'power2.out', duration: 1 })
        .from(descRef.current, { autoAlpha: 0, y: 30, ease: 'power2.out', duration: 0.8 }, '-=0.55')
        .from(actionsRef.current, { autoAlpha: 0, y: 20, ease: 'power2.out', duration: 0.7 }, '-=0.5')

      scrollTrigger = timeline.scrollTrigger
    })

    return () => {
      cancelled = true
      scrollTrigger?.kill()
    }
  }, [])

  return (
    <section
      ref={sectionRef}
      className="relative mx-auto flex min-h-[70svh] w-full max-w-6xl flex-col justify-center px-4 py-12 sm:min-h-[85vh] sm:px-6 lg:px-8"
    >
      <div className="relative overflow-hidden rounded-[1.8rem] border border-white/10 bg-slate-950/45 p-5 shadow-[0_30px_80px_rgba(8,15,35,0.4)] backdrop-blur-xl sm:rounded-[2rem] sm:p-8 md:p-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-cyan-300/10 blur-3xl" />
        <p className="mb-3 text-[0.7rem] font-medium uppercase tracking-[0.24em] text-cyan-300/75 sm:text-xs sm:tracking-[0.34em]">{eyebrow}</p>
        <h1 ref={headingRef} className="font-display text-[2.1rem] font-semibold tracking-[0.02em] text-white sm:text-6xl lg:text-7xl">
          {title}
        </h1>
        <p ref={descRef} className="mt-4 max-w-3xl text-[0.98rem] leading-6 text-slate-200/84 sm:mt-5 sm:text-xl sm:leading-8">
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
