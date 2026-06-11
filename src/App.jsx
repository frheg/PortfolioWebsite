import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import ExploreBoostOverlay from './components/ExploreBoostOverlay'
import ExploreHelpHint from './components/ExploreHelpHint'
import { RouteProvider } from './context/RouteProvider'
import ExploreMobileControls from './components/ExploreMobileControls'
import MobileQuickNav from './components/MobileQuickNav'
import Nav from './components/Nav'

const BackgroundCanvas = lazy(() => import('./components/BackgroundCanvas'))
const HomePage = lazy(() => import('./pages/HomePage'))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'))
const JourneyPage = lazy(() => import('./pages/JourneyPage'))
const ContactPage = lazy(() => import('./pages/ContactPage'))
const ExplorePage = lazy(() => import('./pages/ExplorePage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

const ROUTE_EXIT_MS = 220
const ROUTE_ENTER_MS = 420

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function App() {
  const location = useLocation()
  const isExploreRoute = location.pathname === '/explore'
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
      <RouteProvider>
        <Nav />
        <Suspense fallback={null}>
          <BackgroundCanvas />
        </Suspense>
      </RouteProvider>
      <div className={routeVeilClassName} aria-hidden="true" />
      <div className={routeScanClassName} aria-hidden="true" />
      {isExploreRoute ? <ExploreBoostOverlay /> : null}
      <div className={routeStageClassName}>
        <Suspense fallback={<div className="route-loading" />}>
          <Routes location={displayedLocation}>
            <Route path="/" element={<HomePage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/journey" element={<JourneyPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </div>
      {isExploreRoute ? <ExploreHelpHint /> : null}
      {isExploreRoute ? <ExploreMobileControls /> : <MobileQuickNav />}
    </main>
  )
}
