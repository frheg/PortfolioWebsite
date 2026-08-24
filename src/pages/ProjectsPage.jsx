import SectionCard from '../components/ui/SectionCard'
import OrbitDisclosure from '../components/ui/OrbitDisclosure'
import ProjectCard from '../components/projects/ProjectCard'
import profile from '../data/profile.json'

export default function ProjectsPage() {
  const featuredProjects = profile.projects.filter((project) => project.featured)
  const otherProjects = profile.projects.filter((project) => !project.featured)

  return (
    <>
      <div className="relative mx-auto w-full max-w-6xl px-4 pb-28 text-left sm:px-6 sm:pb-24 lg:px-8">
        <SectionCard
          id="projects"
          eyebrow="Featured"
          title="Featured projects."
        >
          <div className="grid gap-4 sm:gap-5 xl:grid-cols-3">
            {featuredProjects.map((project, index) => (
              <ProjectCard key={project.name} project={project} index={index} featured />
            ))}
          </div>
        </SectionCard>

        <SectionCard
          id="archive"
          eyebrow="Archive"
          title="More builds and experiments."
        >
          <OrbitDisclosure title="Open project archive" hint="University work, side explorations, and smaller builds" defaultOpen>
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
