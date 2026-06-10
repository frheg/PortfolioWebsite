import PageHero from '../components/PageHero'
import SectionCard from '../components/ui/SectionCard'
import OrbitDisclosure from '../components/ui/OrbitDisclosure'
import { usePageMeta } from '../hooks/usePageMeta'
import profile from '../data/profile.json'

function splitDetails(text) {
  return text
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
}

export default function JourneyPage() {
  usePageMeta({
    title: 'Fredric Hegland | Journey',
    description: 'Experience, education, leadership, and learning journey for Fredric Hegland.',
  })

  return (
    <>
      <PageHero
        eyebrow="Trajectory"
        title="Work, study, and a few responsibilities that shaped how I think."
        description="This is the background behind the projects: experience, education, and some of the leadership roles that taught me how to work with both systems and people."
        actions={[
          { label: 'Experience', href: '#journey' },
          { label: 'Leadership', href: '#leadership', kind: 'secondary' },
          { label: 'Contact', to: '/contact', kind: 'secondary' },
        ]}
      />

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-28 text-left sm:px-6 sm:pb-24 lg:px-8">
        <SectionCard
          id="journey"
          eyebrow="Professional and Academic"
          title="A mix of engineering, study, service work, and leadership."
          description="That range has made me comfortable switching between people, systems, and different kinds of problems without losing interest in the details."
        >
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-display text-2xl font-semibold text-white">Experience</h3>
                <span className="pt-1 text-right text-xs uppercase leading-none tracking-[0.28em] text-cyan-300/70">Professional</span>
              </div>
              {profile.experience.map((job) => (
                <article key={`${job.company}-${job.title}`} className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4 sm:rounded-[1.6rem] sm:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h4 className="font-display text-lg font-semibold text-white">{job.title}</h4>
                      <p className="text-sm text-cyan-200/85">{job.company}</p>
                    </div>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-200/72">
                      {job.period}
                    </span>
                  </div>
                  <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-200/82">
                    {splitDetails(job.details).map((detail) => (
                      <li key={detail} className="flex gap-3">
                        <span className="mt-2 h-2 w-2 rounded-full bg-cyan-300" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                  {job.link ? (
                    <a
                      href={job.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex text-sm font-medium text-cyan-200 transition hover:text-cyan-100"
                    >
                      {job.linkLabel || 'Learn more'}
                    </a>
                  ) : null}
                </article>
              ))}
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-display text-2xl font-semibold text-white">Education</h3>
                <span className="pt-1 text-right text-xs uppercase leading-none tracking-[0.28em] text-cyan-300/70">Academic</span>
              </div>
              {profile.education.map((ed) => (
                <article key={`${ed.school}-${ed.program}`} className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4 sm:rounded-[1.6rem] sm:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.26em] text-cyan-300/70">{ed.school}</p>
                      {ed.link ? (
                        <a
                          href={ed.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex font-display text-lg font-semibold text-white transition hover:text-cyan-100"
                        >
                          {ed.program}
                        </a>
                      ) : (
                        <h4 className="mt-2 font-display text-lg font-semibold text-white">{ed.program}</h4>
                      )}
                    </div>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-200/72">
                      {ed.period}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          id="leadership"
          eyebrow="Signals"
          title="Leadership, languages, and continued learning."
          description="The technical side matters a lot to me, but so does communication, organizing people, and learning beyond the minimum."
          className="mt-20 sm:mt-24 md:mt-28"
        >
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_0.8fr]">
            <div className="space-y-3 sm:space-y-4">
              <h3 className="font-display text-2xl font-semibold text-white">Leadership and volunteer work</h3>
              {profile.boardPositions.map((position) => (
                <article key={`${position.title}-${position.period}`} className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4 sm:rounded-[1.6rem] sm:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <h4 className="font-display text-lg font-semibold text-white">{position.title}</h4>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-200/72">
                      {position.period}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-200/82">{position.details}</p>
                </article>
              ))}
            </div>

            <div className="space-y-4 sm:space-y-6">
              <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4 sm:rounded-[1.6rem] sm:p-6">
                <h3 className="font-display text-2xl font-semibold text-white">Languages</h3>
                <div className="mt-5 grid gap-3">
                  {profile.languages.map((language) => (
                    <div key={language.name} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100/88">
                      <span>{language.name}</span>
                      <span className="text-cyan-200/75">{language.level}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4 sm:rounded-[1.6rem] sm:p-6">
                <h3 className="font-display text-2xl font-semibold text-white">Courses and certificates</h3>
                <div className="mt-5">
                  <OrbitDisclosure title="Open course list" hint="Relevant certificates and short courses">
                    <div className="space-y-4">
                      {profile.courses.map((course) => (
                        <div key={`${course.name}-${course.id || course.date}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <p className="font-medium text-white">{course.name}</p>
                          <p className="mt-1 text-sm text-slate-200/78">{course.date}</p>
                          {course.id ? <p className="mt-2 text-xs uppercase tracking-[0.24em] text-cyan-300/70">ID: {course.id}</p> : null}
                        </div>
                      ))}
                    </div>
                  </OrbitDisclosure>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </>
  )
}
