import { useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import HomePage from './HomePage'
import ProjectsPage from './ProjectsPage'
import JourneyPage from './JourneyPage'
import ContactPage from './ContactPage'
import ChatPage from './ChatPage'
import GoToTopButton from '../components/GoToTopButton'
import { useActiveSection } from '../hooks/useActiveSection'
import { chapterOrder } from '../content/chapters'
import { setChapterOffsets } from '../three/scrollChapters'
import { scrollToOffset } from '../utils/chapterScroll'
import { loadGsap } from '../utils/gsapLoader'
import { scheduleScrollTriggerRefresh } from '../utils/scrollTriggerRefresh'

const CHAPTER_COMPONENTS = {
  '/': HomePage,
  '/projects': ProjectsPage,
  '/journey': JourneyPage,
  '/contact': ContactPage,
  '/chat': ChatPage,
}

// Derived from chapterOrder rather than listed separately, so the rendered
// DOM order can never drift out of sync with the order everything else
// (camera offsets, scroll-spy) keys off.
const CHAPTERS = chapterOrder.map((path) => ({ path, Component: CHAPTER_COMPONENTS[path] }))

export default function LongPage() {
  // Only read for the one-time "arriving from Explore's pause menu, deep-link
  // to a section" case below — the page itself no longer has per-section
  // routes, so nothing here reacts to pathname changes.
  const location = useLocation()
  const chapterRefs = useRef(CHAPTERS.map(() => null))

  const measureAndPublish = () => {
    const offsets = chapterRefs.current.map((el) => (el ? el.offsetTop : 0))
    setChapterOffsets(offsets)
    // Same signal that keeps the camera's chapter breakpoints correct as
    // late-loading images/content shift the page also needs to re-sync
    // every GSAP ScrollTrigger's cached pin/trigger positions — otherwise a
    // one-time refresh early on drifts again as soon as anything below it
    // changes height.
    loadGsap().then(({ ScrollTrigger }) => scheduleScrollTriggerRefresh(ScrollTrigger))
    return offsets
  }

  // Layout effect (not a regular effect) so scroll position is correct
  // before the background canvas's rAF loop reads it on its first frame.
  useLayoutEffect(() => {
    const offsets = measureAndPublish()
    const targetKey = location.state?.scrollToChapter
    const index = targetKey ? chapterOrder.indexOf(targetKey) : -1
    if (index >= 0) scrollToOffset(offsets[index], 'auto')

    const observer = new ResizeObserver(() => measureAndPublish())
    observer.observe(document.documentElement)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useActiveSection(chapterRefs, chapterOrder)

  return (
    <>
      {CHAPTERS.map((chapter, index) => {
        const ChapterComponent = chapter.Component
        return (
          <section
            key={chapter.path}
            data-camera-stop={chapter.path}
            ref={(el) => {
              chapterRefs.current[index] = el
            }}
          >
            <ChapterComponent />
          </section>
        )
      })}
      <GoToTopButton />
    </>
  )
}
