export default function SectionCard({
  id,
  eyebrow,
  title,
  description,
  children,
  className = '',
  contentClassName = '',
}) {
  return (
    <section
      id={id}
      className={`relative z-10 my-8 scroll-mt-24 overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-4 shadow-[0_30px_80px_rgba(8,15,35,0.45)] backdrop-blur-xl sm:my-10 sm:rounded-[2rem] sm:p-6 md:my-14 md:p-8 ${className}`}
      aria-labelledby={title ? `${id}-title` : undefined}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 h-36 w-36 rounded-full bg-cyan-300/8 blur-3xl" />
      {(eyebrow || title || description) && (
        <header className="mb-6 max-w-3xl sm:mb-8 md:mb-10">
          {eyebrow ? (
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.34em] text-cyan-300/75">{eyebrow}</p>
          ) : null}
          {title ? (
            <h2 id={`${id}-title`} className="font-display text-[1.8rem] font-semibold tracking-[0.02em] text-white sm:text-3xl md:text-4xl">
              {title}
            </h2>
          ) : null}
          {description ? <p className="mt-3 text-[0.95rem] leading-6 text-slate-200/82 sm:mt-4 sm:text-base sm:leading-7 md:text-lg">{description}</p> : null}
        </header>
      )}
      <div className={contentClassName}>{children}</div>
    </section>
  )
}
