import SectionCard from '../components/ui/SectionCard'
import OrbitDisclosure from '../components/ui/OrbitDisclosure'
import PageHero from '../components/PageHero'
import ProjectCard from '../components/projects/ProjectCard'
import { usePageMeta } from '../hooks/usePageMeta'
import profile from '../data/profile.json'

export default function ProjectsPage() {
  usePageMeta({
    title: 'Fredric Hegland | Projects',
    description: 'Projects by Fredric Hegland across software engineering, AI systems, personal experiments, and university work.',
  })

  const featuredProjects = profile.projects.filter((project) => project.featured)
  const otherProjects = profile.projects.filter((project) => !project.featured)

  return (
    <>
      <PageHero
        eyebrow="Build Log"
        title="Projects, experiments, and the things I learn by building."
        description="The fuller project list: the finished ones, the in-progress ones, and a few side experiments."
        actions={[
          { label: 'Featured', href: '#projects' },
          { label: 'Archive', href: '#archive', kind: 'secondary' },
          { label: 'Contact', to: '/contact', kind: 'secondary' },
        ]}
      />

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-28 text-left sm:px-6 sm:pb-24 lg:px-8">
        <SectionCard
          id="projects"
          eyebrow="Featured"
          title="A few projects I'd point to first."
          description="A mix of software engineering, applied AI, and curiosity-driven builds."
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
          description="Smaller or more course-driven, but still part of how I like to explore tools and ideas."
        >
          <OrbitDisclosure title="Open project archive" hint="University work, side explorations, and smaller builds" defaultOpen>
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
              {otherProjects.map((project) => (
                <ProjectCard key={project.name} project={project} />
              ))}
            </div>
          </OrbitDisclosure>
        </SectionCard>
      </div>
    </>
  )
}
