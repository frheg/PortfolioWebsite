import SectionCard from '../components/ui/SectionCard'
import OrbitDisclosure from '../components/ui/OrbitDisclosure'
import ProjectCard from '../components/projects/ProjectCard'
import { useProfile } from '../data/useProfile'
import { useT } from '../i18n/useT'

export default function ProjectsPage() {
  const profile = useProfile()
  const t = useT()
  const featuredProjects = profile.projects.filter((project) => project.featured)
  const otherProjects = profile.projects.filter((project) => !project.featured)

  return (
    <>
      <div className="relative mx-auto w-full max-w-6xl px-4 pb-28 text-left sm:px-6 sm:pb-24 lg:px-8">
        <SectionCard
          id="projects"
          eyebrow={t.projects.featuredEyebrow}
          title={t.projects.featuredTitle}
        >
          <div className="grid gap-4 sm:gap-5 xl:grid-cols-3">
            {featuredProjects.map((project, index) => (
              <ProjectCard key={project.name} project={project} index={index} featured />
            ))}
          </div>
        </SectionCard>

        <SectionCard
          id="archive"
          eyebrow={t.projects.archiveEyebrow}
          title={t.projects.archiveTitle}
        >
          <OrbitDisclosure title={t.projects.archiveOpenTitle} hint={t.projects.archiveHint} defaultOpen>
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
              {otherProjects.map((project, index) => (
                <ProjectCard key={project.name} project={project} index={index} />
              ))}
            </div>
          </OrbitDisclosure>
        </SectionCard>
      </div>
    </>
  )
}
