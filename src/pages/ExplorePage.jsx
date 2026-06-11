import { usePageMeta } from '../hooks/usePageMeta'

export default function ExplorePage() {
  usePageMeta({
    title: 'Fredric Hegland | Explore',
    description: 'Free-flight exploration mode through the portfolio galaxy scene.',
  })

  return <div className="min-h-screen" aria-hidden="true" />
}
