import { useSyncExternalStore } from 'react'
import { getExploreBoostSnapshot, subscribeExploreInput } from '../three/exploreControls'

export default function ExploreBoostOverlay() {
  const boostActive = useSyncExternalStore(subscribeExploreInput, getExploreBoostSnapshot, getExploreBoostSnapshot)
  const className = `explore-boost ${boostActive ? 'explore-boost--active' : ''}`

  return <div className={className} aria-hidden="true" />
}
