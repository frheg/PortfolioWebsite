// Small hand-rolled outline icon set for FloatingNav — avoids pulling in an
// icon library for six glyphs.
const PATHS = {
  home: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h4.5v-6h4v6h4.5V9.5',
  projects: 'M4 7.5a2 2 0 0 1 2-2h3l1.8 2H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-10Z',
  journey: 'M6 20 6 8a2 2 0 0 1 2-2h1V4.5h6V6h1a2 2 0 0 1 2 2v12M9 20v-4h6v4',
  contact: 'M4 6h16v12H4V6Zm0 .5 8 6.5 8-6.5',
  chat: 'M5 5h14v10H9l-4 4V5Z',
  explore: 'M12 3l1.9 5.6L19.5 10.5 13.9 12.4 12 18 10.1 12.4 4.5 10.5 10.1 8.6 12 3Z',
}

export default function NavIcon({ name, className = 'h-5 w-5' }) {
  const d = PATHS[name]
  if (!d) return null

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={d} />
    </svg>
  )
}
