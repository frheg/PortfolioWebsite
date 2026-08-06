import { usePageMeta } from '../hooks/usePageMeta'

export default function ProjectsPage() {
  usePageMeta({
    title: 'Fredric Hegland | Projects',
    description: 'Projects by Fredric Hegland across software engineering, AI systems, personal experiments, and university work. See the floating card near this stop on the flythrough.',
  })

  return <div className="min-h-screen" aria-hidden="true" />
}
