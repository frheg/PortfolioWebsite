function ActionLink({ href, label }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-cyan-100 transition hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-cyan-300/18"
    >
      {label}
    </a>
  )
}

export default function ProjectCard({ project, index, featured = false }) {
  if (featured) {
    return (
      <article className="group relative flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-white/10 bg-gradient-to-b from-cyan-300/12 via-slate-950/78 to-slate-950/95 p-4 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/35 hover:shadow-[0_24px_50px_rgba(6,182,212,0.12)] sm:rounded-[1.8rem] sm:p-6">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full bg-cyan-300/10 blur-3xl transition duration-300 group-hover:bg-cyan-300/16" />
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/70">{project.type}</p>
            <span className="inline-flex rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.24em] text-slate-100/75">
              0{index + 1}
            </span>
          </div>
          <span className="inline-flex min-h-9 min-w-[7.75rem] shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-black/20 px-3 py-1 text-center text-xs uppercase tracking-[0.24em] text-cyan-100/85">
            {project.status}
          </span>
        </div>
        <div className="mt-5 flex flex-1 flex-col">
          <h3 className="font-display text-2xl font-semibold leading-tight tracking-[0.03em] text-white">{project.name}</h3>
          <p className="mt-4 text-sm leading-7 text-slate-200/84">{project.description}</p>
          <div className="mt-4 rounded-[1rem] border border-cyan-300/15 bg-black/20 p-3 text-sm leading-7 text-cyan-100/90 sm:mt-5 sm:rounded-[1.25rem] sm:p-4">
            {project.highlight}
          </div>
        </div>
        <div className="mt-auto pt-5">
          <p className="mb-3 text-[0.68rem] uppercase tracking-[0.24em] text-cyan-300/65">Stack</p>
          <div className="flex flex-wrap content-start gap-2">
            {project.tech.map((tech) => (
              <span key={tech} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-100/80">
                {tech}
              </span>
            ))}
          </div>
          {project.repo || project.link ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {project.repo ? <ActionLink href={project.repo} label="Repo" /> : null}
              {project.link ? <ActionLink href={project.link} label={project.linkLabel || 'Link'} /> : null}
            </div>
          ) : null}
        </div>
      </article>
    )
  }

  return (
    <article className="flex h-full flex-col rounded-[1rem] border border-white/10 bg-black/20 p-4 transition duration-300 hover:border-cyan-300/20 hover:bg-black/25 sm:rounded-[1.4rem] sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <h3 className="max-w-[18rem] font-display text-lg font-semibold leading-tight tracking-[0.03em] text-white sm:max-w-none">
          {project.name}
        </h3>
        <span className="shrink-0 pt-0.5 text-right text-xs uppercase leading-none tracking-[0.28em] text-cyan-300/65">{project.type}</span>
      </div>
      <p className="mt-3 flex-1 text-sm leading-7 text-slate-200/80">{project.description}</p>
      <div className="mt-4 flex flex-wrap items-start gap-2">
        {project.tech.map((tech) => (
          <span key={tech} className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200/75">
            {tech}
          </span>
        ))}
      </div>
      {project.repo || project.link ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {project.repo ? <ActionLink href={project.repo} label="Repo" /> : null}
          {project.link ? <ActionLink href={project.link} label={project.linkLabel || 'Link'} /> : null}
        </div>
      ) : null}
    </article>
  )
}
