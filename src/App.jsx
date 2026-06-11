import { Suspense, lazy } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { RouteProvider } from './context/RouteProvider'
import MobileQuickNav from './components/MobileQuickNav'
import Nav from './components/Nav'
import ScrollToTop from './components/ScrollToTop'

const BackgroundCanvas = lazy(() => import('./components/BackgroundCanvas'))
const HomePage = lazy(() => import('./pages/HomePage'))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'))
const JourneyPage = lazy(() => import('./pages/JourneyPage'))
const ContactPage = lazy(() => import('./pages/ContactPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

export default function App() {
  const location = useLocation()

  return (
    <main className="relative isolate overflow-x-clip">
      <RouteProvider>
        <Nav />
        <Suspense fallback={null}>
          <BackgroundCanvas />
        </Suspense>
      </RouteProvider>
      <ScrollToTop />
      <div key={location.pathname} className="route-stage">
        <Suspense fallback={<div className="route-loading" />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/journey" element={<JourneyPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </div>
      <MobileQuickNav />
    </main>
  )
}
