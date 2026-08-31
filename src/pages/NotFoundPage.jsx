import { Link } from 'react-router-dom'
import PageHero from '../components/PageHero'
import SectionCard from '../components/ui/SectionCard'
import { usePageMeta } from '../hooks/usePageMeta'

export default function NotFoundPage() {
  usePageMeta({
    title: 'Fredric Hegland | Siden finnes ikke',
    description: 'Fant ikke siden du lette etter.',
  })

  return (
    <>
      <PageHero
        eyebrow="404"
        title="Siden finnes ikke."
        description="Denne siden finnes ikke. Resten av nettsiden er fortsatt her."
      />

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-20 text-left sm:px-6 lg:px-8">
        <SectionCard title="Gå tilbake til hjemmesiden" description="Tilbake til hjemmesiden.">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-300/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-cyan-300/18"
          >
            Gå til hjemmesiden
          </Link>
        </SectionCard>
      </div>
    </>
  )
}
