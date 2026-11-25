// The 5 content items scroll to a section on the single page (`chapterKey`
// matches a chapters.js chapterOrder entry — named to avoid colliding with
// React's special `key` prop when spread into JSX). "Explore" is the only
// real route left in the app, so it alone carries a `route` for react-router.
// `action` items run something instead (tour: hands-off flight through the galaxies).
export const navLinks = [
  { chapterKey: '/', label: 'Hjem', icon: 'home' },
  { chapterKey: '/projects', label: 'Prosjekter', icon: 'projects' },
  { chapterKey: '/journey', label: 'Reise', icon: 'journey' },
  { chapterKey: '/contact', label: 'Kontakt', icon: 'contact' },
  { chapterKey: '/chat', label: 'Chat', icon: 'chat' },
  { action: 'tour', label: 'Omvisning', ariaLabel: 'Omvisning i galaksene', icon: 'tour' },
  { route: '/explore', label: 'Utforsk', icon: 'explore', featured: true, sticker: 'Utforsk galaksen' },
]
