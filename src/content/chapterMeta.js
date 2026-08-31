// Single source of truth for the merged long-page's chapter order and
// per-chapter title/description. Order here must match
// spaceConfig.camera.pageStops in src/three/spaceConfig.js — that file's
// orbit angles are keyed by these same path strings, in this same order.
export const chapterOrder = ['/', '/projects', '/journey', '/contact', '/chat']

export const chapterMeta = {
  '/': {
    title: 'Fredric Hegland | Hjem',
    description: 'Hjemmeside for Fredric Hegland: programvareutvikling, prosjekter, interesser og hva jeg jobber med nå.',
  },
  '/projects': {
    title: 'Fredric Hegland | Prosjekter',
    description: 'Prosjekter av Fredric Hegland innen programvareutvikling, AI-systemer, personlige eksperimenter og skolearbeid.',
  },
  '/journey': {
    title: 'Fredric Hegland | Reise',
    description: 'Erfaring, utdanning, ledelse og læringsreise for Fredric Hegland.',
  },
  '/contact': {
    title: 'Fredric Hegland | Kontakt',
    description: 'Kontakt Fredric Hegland og se ferdigheter, verktøy og måter å ta kontakt på.',
  },
  '/chat': {
    title: 'Fredric Hegland | Lokal Chat',
    description: 'Chat med en liten lokal AI-modell som kjører helt i nettleseren din via WebGPU — velg en størrelse som passer enheten din.',
  },
}
