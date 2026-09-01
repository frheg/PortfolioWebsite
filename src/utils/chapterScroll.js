// Scrolling to a section on the single merged page, and tracking which
// section is currently in view — used by FloatingNav (same-page scroll) and
// ExplorePauseNav (navigates back to '/' then deep-links to a section, see
// LongPage's mount effect). Module-level pub/sub for the active section,
// mirroring exploreState.js's pattern, since FloatingNav and LongPage live
// in sibling trees under App.jsx with no prop path between them.
import { chapterOrder } from '../content/chapters'
import { getChapterOffsets } from '../three/scrollChapters'
import { prefersReducedMotion } from './motion'

export function scrollToOffset(offsetY, behavior = 'smooth') {
  const doc = document.documentElement
  const body = document.body
  const prevDocBehavior = doc.style.scrollBehavior
  const prevBodyBehavior = body.style.scrollBehavior

  doc.style.scrollBehavior = 'auto'
  body.style.scrollBehavior = 'auto'
  window.scrollTo({ top: offsetY, left: 0, behavior })
  doc.style.scrollBehavior = prevDocBehavior
  body.style.scrollBehavior = prevBodyBehavior
}

export function scrollToChapter(key) {
  const index = chapterOrder.indexOf(key)
  if (index < 0) return
  const offsets = getChapterOffsets()
  scrollToOffset(offsets[index] ?? 0, prefersReducedMotion() ? 'auto' : 'smooth')
}

let activeChapter = chapterOrder[0]
const listeners = new Set()

export function getActiveChapter() {
  return activeChapter
}

export function setActiveChapter(key) {
  if (key === activeChapter) return
  activeChapter = key
  listeners.forEach((listener) => listener())
}

export function subscribeActiveChapter(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
