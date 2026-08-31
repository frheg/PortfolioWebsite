import { usePageMeta } from '../hooks/usePageMeta'
import { useT } from '../i18n/useT'

export default function ExplorePage() {
  const t = useT()
  usePageMeta(t.meta.explore)

  return <div className="min-h-screen" aria-hidden="true" />
}
