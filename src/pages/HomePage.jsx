import { Link } from 'react-router-dom'
import Intro from '../components/Intro'
import ProjectCard from '../components/projects/ProjectCard'
import SectionCard from '../components/ui/SectionCard'
import profile from '../data/profile.json'

export default function HomePage() {
  const featuredProjects = profile.projects.filter((project) => project.featured)

  return (
    <>
      <Intro />

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-28 text-left sm:px-6 sm:pb-24 lg:px-8">
        <SectionCard
          id="about"
          eyebrow="About"
          title="A quick overview of what I do."
        >
          <div className="space-y-4 sm:space-y-6">
            <p className="text-base leading-7 text-slate-100/88 sm:text-lg sm:leading-8">{profile.about}</p>

            <div className="grid gap-3 sm:gap-4 sm:grid-cols-3">
              <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4 sm:rounded-[1.6rem] sm:p-6">
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/75">Currently</p>
                <ul className="mt-4 space-y-2.5 text-sm leading-6 text-slate-200/84">
                  {profile.currently.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-[1.2rem] border border-cyan-300/20 bg-cyan-300/10 p-4 sm:rounded-[1.6rem] sm:p-6">
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-100/90">Interests</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {profile.interests.map((item) => (
                    <span key={item} className="rounded-full border border-cyan-100/10 bg-black/20 px-3 py-1.5 text-sm text-slate-100/88">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4 sm:rounded-[1.6rem] sm:p-6">
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/75">Highlights</p>
                <ul className="mt-4 space-y-2.5 text-sm leading-6 text-slate-200/84">
                  {profile.highlights.map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          id="featured-projects"
          eyebrow="Featured Projects"
          title="A few things I've built."
        >
          <div className="grid gap-4 sm:gap-5 xl:grid-cols-3">
            {featuredProjects.map((project, index) => (
              <ProjectCard key={project.name} project={project} index={index} featured />
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-200/78">Want the full project list?</p>
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
