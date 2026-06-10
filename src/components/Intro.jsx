import selfPortrait from '../assets/Pictures/SelfPortrait-1400.jpg'
import { Link } from 'react-router-dom'
import profile from '../data/profile.json'

export default function Intro() {
  const stats = [
    { label: 'Builds', value: profile.projects.length },
    { label: 'Roles', value: profile.experience.length },
    { label: 'Areas', value: profile.skillGroups?.length || 3 },
  ]

  const homeShortcuts = [
    { label: 'Featured work', href: '#featured-projects' },
    { label: 'Journey', to: '/journey' },
    { label: 'Contact', to: '/contact' },
  ]

  return (
    <section id="welcome" className="relative flex min-h-[100svh] items-start px-4 pb-12 pt-20 sm:min-h-screen sm:px-6 sm:pb-14 sm:pt-24 lg:items-center lg:px-8 lg:pt-28">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="hero-glow hero-glow-one" />
        <div className="hero-glow hero-glow-two" />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-12">
        <div className="space-y-5 sm:space-y-6 lg:space-y-8">
          <div className="inline-flex max-w-full items-center rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1.5 text-[0.65rem] font-medium uppercase tracking-[0.24em] text-cyan-100 shadow-[0_0_30px_rgba(103,232,249,0.12)] sm:px-4 sm:py-2 sm:text-xs sm:tracking-[0.32em]">
            {profile.hero.eyebrow}
          </div>

          <div className="space-y-4 sm:space-y-5">
            <p className="text-[0.72rem] uppercase tracking-[0.24em] text-cyan-300/70 sm:text-sm sm:tracking-[0.4em]">{profile.location}</p>
            <h1 className="max-w-4xl font-display text-[2rem] font-semibold leading-[1.05] tracking-[0.02em] text-white sm:text-5xl lg:text-7xl">
              {profile.hero.headline}
            </h1>
            <p className="max-w-2xl text-[0.95rem] leading-6 text-slate-200/88 sm:text-xl sm:leading-8">
              {profile.hero.description}
            </p>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-3">
            <Link
              to={profile.hero.primaryCtaHref}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-cyan-300/50 bg-cyan-300/15 px-6 py-3 text-sm font-semibold text-cyan-50 transition hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-cyan-300/25 sm:min-h-0"
            >
              {profile.hero.primaryCtaLabel}
            </Link>
            <Link
              to={profile.hero.secondaryCtaHref}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 bg-black/20 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-cyan-300/40 hover:text-cyan-100 sm:min-h-0"
            >
              {profile.hero.secondaryCtaLabel}
            </Link>
          </div>

          <div className="flex flex-wrap gap-2">
            {homeShortcuts.map((item) =>
              item.to ? (
                <Link
                  key={item.label}
                  to={item.to}
                  className="inline-flex items-center justify-center rounded-full border border-white/10 bg-black/15 px-3 py-2 text-[0.7rem] font-medium uppercase tracking-[0.18em] text-cyan-200/88 transition hover:border-cyan-300/30 hover:text-cyan-100"
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.label}
                  href={item.href}
                  className="inline-flex items-center justify-center rounded-full border border-white/10 bg-black/15 px-3 py-2 text-[0.7rem] font-medium uppercase tracking-[0.18em] text-cyan-200/88 transition hover:border-cyan-300/30 hover:text-cyan-100"
                >
                  {item.label}
                </a>
              )
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-3xl border border-white/10 bg-slate-950/35 p-3 backdrop-blur-md sm:p-4">
                <div className="text-xl font-semibold text-white sm:text-3xl">{stat.value}</div>
                <div className="mt-1 text-[0.65rem] uppercase tracking-[0.24em] text-cyan-300/70 sm:text-xs sm:tracking-[0.3em]">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 sm:gap-3">
            {profile.quickFacts.map((fact) => (
              <span key={fact} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[0.78rem] text-slate-100/90 backdrop-blur-sm sm:px-4 sm:py-2 sm:text-sm">
                {fact}
              </span>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div className="absolute -inset-8 rounded-full bg-cyan-400/10 blur-3xl" aria-hidden="true" />
          <div className="relative overflow-hidden rounded-[1.8rem] border border-white/10 bg-slate-950/45 p-4 shadow-[0_30px_80px_rgba(8,15,35,0.55)] backdrop-blur-xl sm:rounded-[2rem] sm:p-5">
            <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
            <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-200/90 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-display font-semibold tracking-[0.08em] text-white">{profile.name}</p>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/75">{profile.hero.panelLabel}</p>
              </div>
              <span className="inline-flex max-w-full items-center self-start rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[0.65rem] uppercase tracking-[0.18em] text-emerald-200 sm:self-auto sm:text-xs sm:tracking-[0.24em]">
                {profile.hero.status}
              </span>
            </div>

            <div className="overflow-hidden rounded-[1.35rem] border border-cyan-300/20 bg-gradient-to-br from-cyan-300/12 via-transparent to-fuchsia-400/10 p-2.5 sm:rounded-[1.6rem] sm:p-3">
              <img
                src={selfPortrait}
                alt="Portrait of Fredric Hegland"
                loading="eager"
                className="aspect-[5/6] w-full rounded-[1rem] object-cover sm:aspect-[4/5] sm:rounded-[1.2rem]"
              />
            </div>

            <div className="mt-4 grid gap-3 sm:mt-5 sm:gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-3.5 sm:p-4">
                <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/70">Currently</p>
                <ul className="mt-2.5 space-y-2 text-sm leading-6 text-slate-200/88 sm:mt-3">
                  {profile.currently.slice(0, 1).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/25 p-3.5 sm:p-4">
                <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/70">Off-screen interests</p>
                <ul className="mt-2.5 space-y-2 text-sm leading-6 text-slate-200/88 sm:mt-3">
                  {profile.interests.slice(0, 2).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-4 hidden items-center gap-3 text-sm text-cyan-200/80 sm:flex lg:mt-6">
            <span className="scroll-indicator" aria-hidden="true" />
            <span>Scroll to move through projects, work, and the rest of the orbit.</span>
          </div>
        </div>
      </div>
    </section>
  )
}
