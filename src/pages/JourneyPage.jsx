import { usePageMeta } from '../hooks/usePageMeta'

export default function JourneyPage() {
  usePageMeta({
    title: 'Fredric Hegland | Journey',
    description: 'Experience, education, and leadership for Fredric Hegland. See the floating card near this stop on the flythrough.',
  })

  return <div className="min-h-screen" aria-hidden="true" />
}
