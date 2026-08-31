import { useEffect, useRef } from 'react'
import selfPortrait from '../assets/Pictures/SelfPortrait-1400.webp'
import { Link } from 'react-router-dom'
import { useProfile } from '../data/useProfile'
import { useT } from '../i18n/useT'
import { loadGsap } from '../utils/gsapLoader'
import { prefersReducedMotion } from '../utils/motion'
import { scheduleScrollTriggerRefresh } from '../utils/scrollTriggerRefresh'

export default function Intro() {
  const profile = useProfile()
  const t = useT()
  const sectionRef = useRef(null)
  const eyebrowRef = useRef(null)
  const headlineRef = useRef(null)
  const ctaRef = useRef(null)
  const factsRef = useRef(null)
  const panelRef = useRef(null)

  useEffect(() => {
    if (prefersReducedMotion()) return undefined
    let scrollTrigger
    let cancelled = false

    loadGsap().then(({ gsap, ScrollTrigger }) => {
      if (cancelled || !sectionRef.current) return

      // Entrance: plays once on mount, not scroll-triggered — this is the
      // first thing a visitor sees.
      gsap.from(
        [eyebrowRef.current, headlineRef.current, ctaRef.current, factsRef.current, panelRef.current],
        {
          autoAlpha: 0,
          y: 28,
          duration: 0.8,
          ease: 'power2.out',
          stagger: 0.12,
        }
      )

      // Settle as the hero scrolls past — a subtle scale/fade so the
      // handoff to the About section beneath feels intentional rather than
      // an abrupt cut. Deliberately NOT pinned: pinning here fought with
      // this site's own scroll-driven camera system (which also measures
      // and re-scrolls the page), and that conflict was the actual source
      // of the animation glitches, not a tuning issue. A plain scrub — the
      // hero scrolls at the normal rate while also fading/scaling — gets a
      // similar "dissolving away" feel with none of that risk.
      const settleTimeline = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: 0.4,
        },
      })
      settleTimeline.to(sectionRef.current, { scale: 0.96, autoAlpha: 0.5, ease: 'power1.inOut' })

      scrollTrigger = settleTimeline.scrollTrigger
      scheduleScrollTriggerRefresh(ScrollTrigger)
    })

    return () => {
      cancelled = true
      scrollTrigger?.kill()
    }
  }, [])

  return (
    <section
      ref={sectionRef}
      id="welcome"
      className="relative flex min-h-[100svh] items-start px-4 pb-12 pt-10 sm:min-h-screen sm:px-6 sm:pb-14 sm:pt-14 lg:items-center lg:px-8 lg:pt-16"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="hero-glow hero-glow-one" />
        <div className="hero-glow hero-glow-two" />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-12">
        <div className="space-y-5 sm:space-y-6 lg:space-y-8">
          <div
            ref={eyebrowRef}
            className="inline-flex max-w-full items-center rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1.5 text-[0.65rem] font-medium uppercase tracking-[0.24em] text-cyan-100 shadow-[0_0_30px_rgba(148,162,249,0.12)] sm:px-4 sm:py-2 sm:text-xs sm:tracking-[0.32em]"
          >
            {profile.hero.eyebrow}
          </div>

          <div ref={headlineRef} className="space-y-4 sm:space-y-5">
            <p className="text-[0.72rem] uppercase tracking-[0.24em] text-cyan-300/70 sm:text-sm sm:tracking-[0.4em]">{profile.location}</p>
            <p className="max-w-2xl text-[1.1rem] leading-7 text-slate-100/90 sm:text-2xl sm:leading-9 lg:text-3xl">
              {profile.hero.description}
            </p>
          </div>

          <div ref={ctaRef} className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-3">
            <Link
              to={profile.hero.primaryCtaHref}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-cyan-300/50 bg-cyan-300/15 px-6 py-3 text-sm font-semibold text-cyan-50 transition hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-cyan-300/25 sm:min-h-0"
            >
              {profile.hero.primaryCtaLabel}
            </Link>
            <Link
              to={profile.hero.secondaryCtaHref}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 bg-black/20 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-cyan-300/40 hover:text-cyan-100 sm:min-h-0"
            >
              {profile.hero.secondaryCtaLabel}
            </Link>
          </div>

          <div ref={factsRef} className="flex flex-wrap gap-2 sm:gap-3">
            {profile.quickFacts.map((fact) => (
              <span key={fact} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[0.78rem] text-slate-100/90 backdrop-blur-sm sm:px-4 sm:py-2 sm:text-sm">
                {fact}
              </span>
            ))}
          </div>
        </div>

        <div ref={panelRef} className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div className="absolute -inset-8 rounded-full bg-cyan-400/10 blur-3xl" aria-hidden="true" />
          <div className="relative overflow-hidden rounded-[1.8rem] border border-cyan-300/20 bg-gradient-to-br from-cyan-300/12 via-slate-950/45 to-fuchsia-400/10 p-2.5 shadow-[0_30px_80px_rgba(17,17,27,0.55)] backdrop-blur-xl sm:rounded-[2rem] sm:p-3">
            <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
            <img
              src={selfPortrait}
              alt={t.loadingScreen.portraitAlt}
              loading="eager"
              className="aspect-[5/6] w-full rounded-[1.35rem] object-cover sm:aspect-[4/5] sm:rounded-[1.6rem]"
            />
          </div>

          <p className="mt-4 font-display text-base font-semibold text-white sm:text-lg">{profile.name}</p>

          <div className="mt-4 hidden items-center gap-3 text-sm text-cyan-200/80 sm:flex lg:mt-6">
            <span className="scroll-indicator" aria-hidden="true" />
            <span>{t.home.scrollHint}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
