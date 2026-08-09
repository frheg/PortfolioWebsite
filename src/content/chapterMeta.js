// Single source of truth for the merged long-page's chapter order and
// per-chapter title/description. Order here must match
// spaceConfig.camera.pageStops in src/three/spaceConfig.js — that file's
// orbit angles are keyed by these same path strings, in this same order.
export const chapterOrder = ['/', '/projects', '/journey', '/contact', '/chat']

export const chapterMeta = {
  '/': {
    title: 'Fredric Hegland | Home',
    description: 'Home page for Fredric Hegland: software engineering, projects, interests, and current focus.',
  },
  '/projects': {
    title: 'Fredric Hegland | Projects',
    description: 'Projects by Fredric Hegland across software engineering, AI systems, personal experiments, and university work.',
  },
  '/journey': {
    title: 'Fredric Hegland | Journey',
    description: 'Experience, education, leadership, and learning journey for Fredric Hegland.',
  },
  '/contact': {
    title: 'Fredric Hegland | Contact',
    description: 'Contact Fredric Hegland and browse skills, tools, and ways to connect.',
  },
  '/chat': {
    title: 'Fredric Hegland | Local Chat',
    description: 'Chat with a small local AI model running entirely inside your browser via WebGPU — pick a size that fits your device.',
  },
}
