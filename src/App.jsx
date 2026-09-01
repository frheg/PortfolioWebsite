import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import ExploreBoostOverlay from './components/ExploreBoostOverlay'
import ExploreDateHud from './components/ExploreDateHud'
import ExploreHelpHint from './components/ExploreHelpHint'
import ExplorePauseButton from './components/ExplorePauseButton'
import ExplorePauseOverlay from './components/ExplorePauseOverlay'
import ExploreSpeedHud from './components/ExploreSpeedHud'
import { useExploreAudio } from './hooks/useExploreAudio'
import { RouteProvider } from './context/RouteProvider'
import ExploreMobileControls from './components/ExploreMobileControls'
import FloatingNav from './components/FloatingNav'
import LoadingScreen from './components/LoadingScreen'
import { prefersReducedMotion } from './utils/motion'

const BackgroundCanvas = lazy(() => import('./components/BackgroundCanvas'))
const LongPage = lazy(() => import('./pages/LongPage'))
const ExplorePage = lazy(() => import('./pages/ExplorePage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

const ROUTE_EXIT_MS = 220
const ROUTE_ENTER_MS = 420

export default function App() {
  const location = useLocation()
  const isExploreRoute = location.pathname === '/explore'
  useExploreAudio(isExploreRoute)
  const [displayedLocation, setDisplayedLocation] = useState(location)
  const [routeStage, setRouteStage] = useState('idle')
  const latestLocationRef = useRef(location)
  const displayedPathRef = useRef(location.pathname)
  const timersRef = useRef([])

  latestLocationRef.current = location
  displayedPathRef.current = displayedLocation.pathname

  useEffect(() => {
    if (location.pathname === displayedPathRef.current) return undefined

    if (prefersReducedMotion()) {
      setDisplayedLocation(latestLocationRef.current)
      displayedPathRef.current = latestLocationRef.current.pathname
      setRouteStage('idle')
      return undefined
    }

    timersRef.current.forEach(window.clearTimeout)
    setRouteStage('exit')

    const swapTimer = window.setTimeout(() => {
      setDisplayedLocation(latestLocationRef.current)
      displayedPathRef.current = latestLocationRef.current.pathname
      setRouteStage('enter')
    }, ROUTE_EXIT_MS)

    const settleTimer = window.setTimeout(() => {
      setRouteStage('idle')
    }, ROUTE_EXIT_MS + ROUTE_ENTER_MS)

    timersRef.current = [swapTimer, settleTimer]

    return () => {
      timersRef.current.forEach(window.clearTimeout)
      timersRef.current = []
    }
  }, [location.pathname])

  useEffect(() => () => {
    timersRef.current.forEach(window.clearTimeout)
  }, [])

  const routeStageClassName = `route-stage route-stage--${routeStage}`
  const routeVeilClassName = `route-veil route-veil--${routeStage}`
  const routeScanClassName = `route-scan route-scan--${routeStage}`

  return (
    <main className="relative isolate overflow-x-clip">
      <LoadingScreen />
      <RouteProvider>
        <Suspense fallback={null}>
          <BackgroundCanvas />
        </Suspense>
      </RouteProvider>
      <div className={routeVeilClassName} aria-hidden="true" />
      <div className={routeScanClassName} aria-hidden="true" />
      {isExploreRoute ? <ExploreBoostOverlay /> : null}
      {isExploreRoute ? <ExplorePauseOverlay /> : null}
      {isExploreRoute ? <ExplorePauseButton /> : null}
      {isExploreRoute ? <ExploreSpeedHud /> : null}
      {isExploreRoute ? <ExploreDateHud /> : null}
      <div className={routeStageClassName}>
        <Suspense fallback={<div className="route-loading" />}>
          <Routes location={displayedLocation}>
            <Route path="/" element={<LongPage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </div>
      {isExploreRoute ? <ExploreHelpHint /> : null}
      {isExploreRoute ? <ExploreMobileControls /> : <FloatingNav />}
    </main>
  )
}
