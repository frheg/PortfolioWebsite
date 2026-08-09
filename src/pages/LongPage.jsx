import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import HomePage from './HomePage'
import ProjectsPage from './ProjectsPage'
import JourneyPage from './JourneyPage'
import ContactPage from './ContactPage'
import ChatPage from './ChatPage'
import GoToTopButton from '../components/GoToTopButton'
import { usePageMeta } from '../hooks/usePageMeta'
import { useActiveSection } from '../hooks/useActiveSection'
import { chapterOrder, chapterMeta } from '../content/chapterMeta'
import { setChapterOffsets } from '../three/scrollChapters'

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

function scrollToOffset(offsetY, behavior) {
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

export default function LongPage() {
  const location = useLocation()
  const chapterRefs = useRef(CHAPTERS.map(() => null))
  const prevPathnameRef = useRef(location.pathname)

  const measureAndPublish = () => {
    const offsets = chapterRefs.current.map((el) => (el ? el.offsetTop : 0))
    setChapterOffsets(offsets)
    return offsets
  }

  // Layout effect (not a regular effect) so scroll position is correct
  // before the background canvas's rAF loop reads it on its first frame.
  useLayoutEffect(() => {
    const offsets = measureAndPublish()
    const index = chapterOrder.indexOf(location.pathname)
    scrollToOffset(index >= 0 ? offsets[index] : 0, 'auto')

    const observer = new ResizeObserver(() => measureAndPublish())
    observer.observe(document.documentElement)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Later pathname changes (nav-link clicks) smooth-scroll to the target
  // chapter. Scroll-driven URL updates from useActiveSection are tagged
  // with state.fromScrollSync and skipped here, since the URL is just
  // catching up to a scroll that already happened.
  useEffect(() => {
    if (location.pathname === prevPathnameRef.current) return
    prevPathnameRef.current = location.pathname
    if (location.state?.fromScrollSync) return

    const offsets = measureAndPublish()
    const index = chapterOrder.indexOf(location.pathname)
    if (index < 0) return
    scrollToOffset(offsets[index], 'smooth')
  }, [location.pathname, location.state])

  const activePath = useActiveSection(chapterRefs, chapterOrder, location.pathname)
  usePageMeta(chapterMeta[activePath] ?? chapterMeta['/'])

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
