import { useEffect, useRef, useState } from 'react'
import { subscribeSceneLoading } from '../utils/sceneLoadingState'

// Kept visible at least this long so it reads as an intentional entrance
// rather than a flash on a warm cache, and never longer than the max wait
// even if a texture load stalls or errors out.
const MIN_VISIBLE_MS = 700
const MAX_WAIT_MS = 8000
const EXIT_MS = 600

export default function LoadingScreen() {
  const [progress, setProgress] = useState(0)
  const [exiting, setExiting] = useState(false)
  const [dismissed, setDismissed] = useState(false)
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

    const unsubscribe = subscribeSceneLoading(({ progress: nextProgress, ready }) => {
      setProgress(nextProgress)
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
      className={`loading-screen${exiting ? ' loading-screen--exit' : ''}`}
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
