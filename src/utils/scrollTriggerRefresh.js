let refreshTimer = null

// ScrollTrigger measures each trigger's start/end against the DOM layout at
// creation time. Pins add height to the page, and every reveal/pin on this
// site loads GSAP independently (each behind its own dynamic import), so
// triggers created early can get measured before later pins have inserted
// their spacers — drifting their calculated positions, worse the further
// down the page a trigger sits. Debounced so the flood of near-simultaneous
// registrations on initial mount collapses into one recalculation after
// everything has settled, instead of one refresh per component.
export function scheduleScrollTriggerRefresh(ScrollTrigger) {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    ScrollTrigger.refresh()
    refreshTimer = null
  }, 150)
}
