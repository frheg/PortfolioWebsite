import { Link } from 'react-router-dom'

function HeroAction({ item }) {
  const className = item.kind === 'secondary'
    ? 'inline-flex min-h-10 items-center justify-center rounded-full border border-white/15 bg-black/20 px-3.5 py-2 text-[0.8rem] font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-cyan-300/40 hover:text-cyan-100 sm:min-h-11 sm:px-4 sm:py-2.5 sm:text-sm'
    : 'inline-flex min-h-10 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-300/10 px-3.5 py-2 text-[0.8rem] font-semibold text-cyan-100 transition hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-cyan-300/18 sm:min-h-11 sm:px-4 sm:py-2.5 sm:text-sm'

  if (item.to) {
    return <Link to={item.to} className={className}>{item.label}</Link>
  }

  return <a href={item.href} className={className}>{item.label}</a>
}

export default function PageHero({ eyebrow, title, description, actions = [] }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-24 sm:px-6 sm:pt-28 lg:px-8 lg:pt-32">
      <div className="relative overflow-hidden rounded-[1.8rem] border border-white/10 bg-slate-950/45 p-5 shadow-[0_30px_80px_rgba(8,15,35,0.4)] backdrop-blur-xl sm:rounded-[2rem] sm:p-6 md:p-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-cyan-300/10 blur-3xl" />
        <p className="mb-3 text-[0.7rem] font-medium uppercase tracking-[0.24em] text-cyan-300/75 sm:text-xs sm:tracking-[0.34em]">{eyebrow}</p>
        <h1 className="font-display text-[2rem] font-semibold tracking-[0.02em] text-white sm:text-5xl">
          {title}
        </h1>
        <p className="mt-3 max-w-3xl text-[0.95rem] leading-6 text-slate-200/84 sm:mt-4 sm:text-[1.05rem] sm:leading-7">
          {description}
        </p>
        {actions.length ? (
          <div className="mt-5 flex flex-wrap gap-2.5 sm:mt-6 sm:gap-3">
            {actions.map((item) => (
              <HeroAction key={`${item.label}-${item.to || item.href}`} item={item} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
