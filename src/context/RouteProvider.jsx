import { useLocation } from 'react-router-dom'
import { RouteContext } from './RouteContext'

export function RouteProvider({ children }) {
  const location = useLocation()
  // The 3D camera keys its chapter poses off this value (see
  // useScrollCamera's routeRef/chapterOffsetForPath). Pathname alone used to
  // be enough — each chapter had its own route — but now every chapter lives
  // at '/', so a deep-link arriving via Explore's pause menu (Link state)
  // has to override it, or the camera settles on Home instead of the
  // requested chapter.
  const routeKey =
    location.pathname === '/' && location.state?.scrollToChapter
      ? location.state.scrollToChapter
      : location.pathname

  return (
    <RouteContext.Provider value={routeKey}>
      {children}
    </RouteContext.Provider>
  )
}
