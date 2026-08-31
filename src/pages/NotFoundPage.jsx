import { Link } from 'react-router-dom'
import PageHero from '../components/PageHero'
import SectionCard from '../components/ui/SectionCard'
import { usePageMeta } from '../hooks/usePageMeta'
import { useT } from '../i18n/useT'

export default function NotFoundPage() {
  const t = useT()
  usePageMeta(t.meta.notFound)

  return (
    <>
      <PageHero
        eyebrow={t.notFound.eyebrow}
        title={t.notFound.title}
        description={t.notFound.description}
      />

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-20 text-left sm:px-6 lg:px-8">
        <SectionCard title={t.notFound.cardTitle} description={t.notFound.cardDescription}>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-300/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-cyan-300/18"
          >
            {t.notFound.goHome}
          </Link>
        </SectionCard>
      </div>
    </>
  )
}
