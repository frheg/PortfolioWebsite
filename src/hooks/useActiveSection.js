import { useEffect, useRef } from 'react'
import { setActiveChapter } from '../utils/chapterScroll'

// Tracks which chapter is currently centered in the viewport as the user
// scrolls the single merged page, and publishes it so FloatingNav can
// highlight the matching nav item.
export function useActiveSection(chapterRefs, chapterOrder) {
  const activeIndexRef = useRef(-1)

  useEffect(() => {
    const elements = chapterRefs.current.filter(Boolean)
    if (elements.length === 0) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (!mostVisible) return

        const index = chapterRefs.current.indexOf(mostVisible.target)
        if (index < 0 || index === activeIndexRef.current) return
        activeIndexRef.current = index

        setActiveChapter(chapterOrder[index])
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    )

    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
