import { useLocation } from 'react-router-dom'
import { RouteContext } from './RouteContext'

export function RouteProvider({ children }) {
  const location = useLocation()
  return (
    <RouteContext.Provider value={location.pathname}>
      {children}
    </RouteContext.Provider>
  )
}
