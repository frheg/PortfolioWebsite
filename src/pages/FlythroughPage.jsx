import { usePageMeta } from '../hooks/usePageMeta'

export default function FlythroughPage() {
  usePageMeta({
    title: 'Fredric Hegland | Home',
    description: 'Drift through the galaxy and discover Fredric Hegland’s portfolio one stop at a time.',
  })

  return <div className="min-h-screen" aria-hidden="true" />
}
