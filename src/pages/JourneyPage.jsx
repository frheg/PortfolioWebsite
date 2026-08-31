import SectionCard from '../components/ui/SectionCard'
import Reveal from '../components/ui/Reveal'
import { useProfile } from '../data/useProfile'
import { useT } from '../i18n/useT'

export default function JourneyPage() {
  const profile = useProfile()
  const t = useT()
  return (
    <>
      <div className="relative mx-auto w-full max-w-6xl px-4 pb-28 text-left sm:px-6 sm:pb-24 lg:px-8">
        <SectionCard
          id="journey"
          eyebrow={t.journey.eyebrow}
          title={t.journey.title}
        >
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-display text-2xl font-semibold text-white">{t.journey.experience}</h3>
                <span className="pt-1 text-right text-xs uppercase leading-none tracking-[0.28em] text-sky-300/80">{t.journey.professional}</span>
              </div>
              {profile.experience.map((job, index) => (
                <Reveal
                  key={`${job.company}-${job.title}`}
                  as="article"
                  variant="left"
                  delay={Math.min(index * 0.08, 0.32)}
                  className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4 sm:rounded-[1.6rem] sm:p-6"
                >
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
                    {job.details.map((detail) => (
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
                      {job.linkLabel || t.journey.learnMore}
                    </a>
                  ) : null}
                </Reveal>
              ))}
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-display text-2xl font-semibold text-white">{t.journey.education}</h3>
                <span className="pt-1 text-right text-xs uppercase leading-none tracking-[0.28em] text-pink-300/80">{t.journey.academic}</span>
              </div>
              {profile.education.map((ed, index) => (
                <Reveal
                  key={`${ed.school}-${ed.program}`}
                  as="article"
                  variant="right"
                  delay={Math.min(index * 0.08, 0.32)}
                  className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4 sm:rounded-[1.6rem] sm:p-6"
                >
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
                </Reveal>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>
    </>
  )
}
