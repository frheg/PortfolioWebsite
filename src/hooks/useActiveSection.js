import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// Tracks which chapter is currently centered in the viewport as the user
// scrolls the merged long page, and keeps the URL bar in sync via a
// replace-navigate (state.fromScrollSync marks it so LongPage's own
// pathname-watcher doesn't mistake it for a nav-link click and re-jump).
export function useActiveSection(chapterRefs, chapterOrder, initialPath) {
  const navigate = useNavigate()
  const [activePath, setActivePath] = useState(initialPath)
  const activeIndexRef = useRef(chapterOrder.indexOf(initialPath))

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

        const path = chapterOrder[index]
        setActivePath(path)
        navigate(path, { replace: true, state: { fromScrollSync: true } })
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    )

    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return activePath
}
