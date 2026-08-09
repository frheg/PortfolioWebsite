import { useEffect } from 'react'
import { loadGsap } from '../utils/gsapLoader'
import { prefersReducedMotion } from '../utils/motion'
import { scheduleScrollTriggerRefresh } from '../utils/scrollTriggerRefresh'

// A handful of distinct entrance shapes so repeated cards don't all move
// identically — picked by pickRevealVariant(index) for a fan-out feel
// across a grid/list.
const VARIANTS = {
  up: { x: 0, y: 46, scale: 1, rotation: 0 },
  down: { x: 0, y: -30, scale: 1, rotation: 0 },
  left: { x: -56, y: 12, scale: 1, rotation: 0 },
  right: { x: 56, y: 12, scale: 1, rotation: 0 },
  scale: { x: 0, y: 18, scale: 0.88, rotation: 0 },
  tilt: { x: 0, y: 30, scale: 0.96, rotation: -3 },
}

const VARIANT_KEYS = Object.keys(VARIANTS)

export function pickRevealVariant(index = 0) {
  return VARIANT_KEYS[Math.abs(index) % VARIANT_KEYS.length]
}

// Ties the reveal to scroll position (scrub) instead of playing a
// fixed-duration tween on toggle. A fixed-duration play/reverse tween can
// fall out of sync once the user scrolls faster than that duration or
// reverses direction mid-animation — the classic ScrollTrigger
// toggleActions gotcha, and what read as cards "jumping"/stuttering,
// especially scrolling back up through several of them quickly. Scrubbing
// makes the animated state a pure function of scroll position, so there's
// nothing left to fall out of sync: glide in over the first ~30% of the
// element's time in view, hold, glide out over the last ~30%.
export function useScrollReveal(
  ref,
  { variant = 'up', delay = 0, start = 'top 90%', end = 'bottom 10%' } = {}
) {
  useEffect(() => {
    if (prefersReducedMotion() || !ref.current) return undefined
    let scrollTrigger
    let cancelled = false

    loadGsap().then(({ gsap, ScrollTrigger }) => {
      if (cancelled || !ref.current) return
      const from = VARIANTS[variant] ?? VARIANTS.up

      // Stagger via a scroll-distance offset rather than a time delay, so
      // it stays fully scrub-driven instead of introducing a second clock.
      const offsetPx = Math.round(delay * 260)
      const startWithOffset = offsetPx ? `${start}+=${offsetPx}` : start

      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: ref.current,
          start: startWithOffset,
          end,
          scrub: 0.35,
        },
      })

      timeline
        .fromTo(
          ref.current,
          { autoAlpha: 0, x: from.x, y: from.y, scale: from.scale, rotation: from.rotation },
          { autoAlpha: 1, x: 0, y: 0, scale: 1, rotation: 0, ease: 'power1.out', duration: 0.3 }
        )
        .to(ref.current, { autoAlpha: 1, duration: 0.4 })
        .to(ref.current, {
          autoAlpha: 0,
          x: -from.x,
          y: -from.y * 0.6,
          scale: from.scale,
          rotation: -from.rotation,
          ease: 'power1.in',
          duration: 0.3,
        })

      scrollTrigger = timeline.scrollTrigger
      scheduleScrollTriggerRefresh(ScrollTrigger)
    })

    return () => {
      cancelled = true
      scrollTrigger?.kill()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
