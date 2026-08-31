import { useT } from '../i18n/useT'

// Route/icon are language-independent; label and sticker text come from the
// active translation so the bottom nav (and the Explore pause-menu nav that
// reuses it) update immediately on a language toggle.
export function useNavLinks() {
  const t = useT()
  return [
    { to: '/', label: t.nav.home, icon: 'home' },
    { to: '/projects', label: t.nav.projects, icon: 'projects' },
    { to: '/journey', label: t.nav.journey, icon: 'journey' },
    { to: '/contact', label: t.nav.contact, icon: 'contact' },
    { to: '/chat', label: t.nav.chat, icon: 'chat' },
    { to: '/explore', label: t.nav.explore, icon: 'explore', featured: true, sticker: t.nav.exploreSticker },
  ]
}
