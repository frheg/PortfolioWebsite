// The 5 content items scroll to a section on the single page (`chapterKey`
// matches a chapters.js chapterOrder entry — named to avoid colliding with
// React's special `key` prop when spread into JSX). "Explore" is the only
// real route left in the app, so it alone carries a `route` for react-router.
export const navLinks = [
  { chapterKey: '/', label: 'Hjem', icon: 'home' },
  { chapterKey: '/projects', label: 'Prosjekter', icon: 'projects' },
  { chapterKey: '/journey', label: 'Reise', icon: 'journey' },
  { chapterKey: '/contact', label: 'Kontakt', icon: 'contact' },
  { chapterKey: '/chat', label: 'Chat', icon: 'chat' },
  { route: '/explore', label: 'Utforsk', icon: 'explore', featured: true, sticker: 'Utforsk galaksen' },
]
