import { useT } from '../i18n/useT'

// Single source of truth for the merged long-page's chapter order. Order
// here must match spaceConfig.camera.pageStops in src/three/spaceConfig.js —
// that file's orbit angles are keyed by these same path strings, in this
// same order.
export const chapterOrder = ['/', '/projects', '/journey', '/contact', '/chat']

// Per-chapter title/description come from the active translation so the
// document title and meta description update on a language toggle.
export function useChapterMeta() {
  const t = useT()
  return {
    '/': t.meta.home,
    '/projects': t.meta.projects,
    '/journey': t.meta.journey,
    '/contact': t.meta.contact,
    '/chat': t.meta.chat,
  }
}
