import { Link } from 'react-router-dom'
import PageHero from '../components/PageHero'
import SectionCard from '../components/ui/SectionCard'
import { usePageMeta } from '../hooks/usePageMeta'

export default function NotFoundPage() {
  usePageMeta({
    title: 'Fredric Hegland | Page Not Found',
    description: 'The requested page could not be found.',
  })

  return (
    <>
      <PageHero
        eyebrow="404"
        title="Page not found."
        description="This route doesn't exist. The rest of the site is still here."
      />

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-20 text-left sm:px-6 lg:px-8">
        <SectionCard title="Go back home" description="Back to the home page.">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-300/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-cyan-300/18"
          >
            Go Home
          </Link>
        </SectionCard>
      </div>
    </>
  )
}
