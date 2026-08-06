import { usePageMeta } from '../hooks/usePageMeta'

export default function HomePage() {
  usePageMeta({
    title: 'Fredric Hegland | About',
    description: 'About Fredric Hegland: software engineering, current focus, and interests. See the floating card near this stop on the flythrough.',
  })

  return <div className="min-h-screen" aria-hidden="true" />
}
