import { usePageMeta } from '../hooks/usePageMeta'

export default function ContactPage() {
  usePageMeta({
    title: 'Fredric Hegland | Contact',
    description: 'Contact Fredric Hegland: email, LinkedIn, GitHub. See the floating card near this stop on the flythrough.',
  })

  return <div className="min-h-screen" aria-hidden="true" />
}
