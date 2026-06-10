import { Link } from 'react-router-dom'
import Intro from '../components/Intro'
import ProjectCard from '../components/projects/ProjectCard'
import SectionCard from '../components/ui/SectionCard'
import OrbitDisclosure from '../components/ui/OrbitDisclosure'
import { usePageMeta } from '../hooks/usePageMeta'
import profile from '../data/profile.json'

export default function HomePage() {
  usePageMeta({
    title: 'Fredric Hegland | Home',
    description: 'Home page for Fredric Hegland: software engineering, projects, interests, and current focus.',
  })

  const leadHighlights = profile.highlights.slice(0, 3)
  const moreHighlights = profile.highlights.slice(3)
  const featuredProjects = profile.projects.filter((project) => project.featured)

  return (
    <>
      <Intro />

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-28 text-left sm:px-6 sm:pb-24 lg:px-8">
        <SectionCard
          id="about"
          eyebrow="Mission Control"
          title="A playful portfolio, with a fairly serious interest in good engineering."
          description="I like software that is practical, polished, and well thought through. That can mean architecture, UX, AI workflows, or just making the rough edges smaller."
        >
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4 sm:space-y-6">
              <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4 sm:rounded-[1.6rem] sm:p-6">
                <p className="text-lg leading-8 text-slate-100/88">{profile.about}</p>
              </div>

              <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
                <div className="h-full rounded-[1.2rem] border border-white/10 bg-black/20 p-4 sm:rounded-[1.6rem] sm:p-6">
                  <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/75">Highlights</p>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-200/84">
                    {leadHighlights.map((item) => (
                      <li key={item} className="flex gap-3">
                        <span className="mt-2 h-2 w-2 rounded-full bg-cyan-300" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  {moreHighlights.length ? (
                    <div className="mt-5">
                      <OrbitDisclosure title="More context" hint="A few extra things that matter">
                        <ul className="space-y-3 text-sm leading-6 text-slate-200/84">
                          {moreHighlights.map((item) => (
                            <li key={item} className="flex gap-3">
                              <span className="mt-2 h-2 w-2 rounded-full bg-cyan-300" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </OrbitDisclosure>
                    </div>
                  ) : null}
                </div>

                <div className="h-full rounded-[1.2rem] border border-white/10 bg-black/20 p-4 sm:rounded-[1.6rem] sm:p-6">
                  <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/75">Currently in orbit</p>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-200/84">
                    {profile.currently.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div className="rounded-[1.2rem] border border-cyan-300/20 bg-cyan-300/10 p-4 sm:rounded-[1.6rem] sm:p-6">
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-100/90">Outside the IDE</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {profile.interests.map((item) => (
                    <span key={item} className="rounded-full border border-cyan-100/10 bg-black/20 px-4 py-2 text-sm text-slate-100/88">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4 sm:rounded-[1.6rem] sm:p-6">
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/75">How I like to work</p>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-200/84">
                  <li>Prefer simple tools and clear architecture over unnecessary complexity.</li>
                  <li>Like understanding the whole system, not just one layer of it.</li>
                  <li>Care about polish, but only after the fundamentals are doing their job.</li>
                </ul>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          id="featured-projects"
          eyebrow="Featured Orbit"
          title="A few builds that represent me best."
          description="Rather than placing everything on the front page, these are the projects I would start with. The rest live on their own page."
          className="mt-20 sm:mt-24 md:mt-28"
        >
          <div className="grid gap-4 sm:gap-5 xl:grid-cols-3">
            {featuredProjects.map((project, index) => (
              <ProjectCard key={project.name} project={project} index={index} featured />
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-200/78">Want the fuller project list, including smaller experiments and university work?</p>
            <Link
              to="/projects"
              className="inline-flex items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-300/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-cyan-300/18"
            >
              Open Projects Page
            </Link>
          </div>
        </SectionCard>
      </div>
    </>
  )
}
