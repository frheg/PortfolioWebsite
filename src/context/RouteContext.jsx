import { createContext, useContext } from 'react'

export const RouteContext = createContext('/')

export function useRoutePath() {
  return useContext(RouteContext)
}
