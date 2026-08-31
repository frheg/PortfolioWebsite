import { usePageMeta } from '../hooks/usePageMeta'

export default function ExplorePage() {
  usePageMeta({
    title: 'Fredric Hegland | Utforsk',
    description: 'Frittflygende utforskningsmodus gjennom porteføljens galakse-scene.',
  })

  return <div className="min-h-screen" aria-hidden="true" />
}
