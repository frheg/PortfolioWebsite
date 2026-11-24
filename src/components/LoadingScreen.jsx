import { useEffect, useRef, useState } from 'react'
import { subscribeSceneLoading } from '../utils/sceneLoadingState'

// Kept visible at least this long so it reads as an intentional entrance
// rather than a flash on a warm cache, and never longer than the max wait
// even if a texture load stalls or errors out.
const MIN_VISIBLE_MS = 1800 // intro shot (Milky Way) gets a moment even on a warm cache
const MAX_WAIT_MS = 50000 // waits for every asset (textures + home-stop tiles); cap only for dead networks
const EXIT_MS = 900

export default function LoadingScreen() {
  const [progress, setProgress] = useState(0)
  const [exiting, setExiting] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [seeThrough, setSeeThrough] = useState(false)
  const [introDone, setIntroDone] = useState(false)
  const mountedAtRef = useRef(typeof performance !== 'undefined' ? performance.now() : 0)
  const exitStartedRef = useRef(false)

  useEffect(() => {
    const startExit = () => {
      if (exitStartedRef.current) return
      exitStartedRef.current = true
      setExiting(true)
      window.setTimeout(() => setDismissed(true), EXIT_MS)
    }

    const scheduleExitOnceReady = () => {
      const elapsed = performance.now() - mountedAtRef.current
      window.setTimeout(startExit, Math.max(MIN_VISIBLE_MS - elapsed, 0))
    }

    const unsubscribe = subscribeSceneLoading(({ progress: nextProgress, ready, visible, introDone: nextIntroDone }) => {
      setProgress(nextProgress)
      if (visible) setSeeThrough(true)
      if (nextIntroDone) setIntroDone(true)
      if (ready) scheduleExitOnceReady()
    })

    // Safety net — a stalled/failed load should never leave visitors stuck
    // behind the loading screen indefinitely.
    const maxTimer = window.setTimeout(startExit, MAX_WAIT_MS)

    return () => {
      unsubscribe()
      window.clearTimeout(maxTimer)
    }
  }, [])

  // Intro shot (3D behind see-through screen) → page UI hidden until the camera glide lands. Safety: 20 s after dismiss.
  useEffect(() => {
    if (!seeThrough || introDone) return undefined
    document.body.classList.add('intro-active')
    const safety = dismissed ? window.setTimeout(() => setIntroDone(true), 20000) : null
    return () => {
      document.body.classList.remove('intro-active')
      if (safety) window.clearTimeout(safety)
    }
  }, [seeThrough, introDone, dismissed])

  useEffect(() => {
    if (dismissed) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [dismissed])

  if (dismissed) return null

  const percent = Math.round(progress * 100)

  return (
    <div
      className={`loading-screen${seeThrough ? ' loading-screen--see-through' : ''}${exiting ? ' loading-screen--exit' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={`Laster, ${percent}%`}
    >
      <div className="loading-screen-glow" aria-hidden="true" />
      <div className="loading-orbit" aria-hidden="true">
        <span className="loading-orbit-ring" />
        <span className="loading-orbit-dot" />
      </div>
      <p className="loading-screen-label">Fredric Hegland</p>
      <p className="loading-screen-percent">{percent}%</p>
    </div>
  )
}
