import { useEffect, useState } from 'react'
import { prefersReducedMotion } from '../utils/motion'

export default function GoToTopButton() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.6)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })}
      aria-label="Til toppen"
      className="fixed bottom-24 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-slate-950/80 text-cyan-200 shadow-[0_10px_30px_rgba(17,17,27,0.5)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-cyan-300/40 hover:text-cyan-100 sm:bottom-28 sm:right-6"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M12 19V5" />
        <path d="M5 12l7-7 7 7" />
      </svg>
    </button>
  )
}
