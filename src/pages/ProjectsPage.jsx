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
        description="This page holds the fuller project view: the polished ones, the practical ones, and the side quests that taught me something useful."
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
          title="The projects I would show first."
          description="These are the builds that best represent the mix of software engineering, curiosity, and practical systems work I enjoy most."
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
          description="These may be smaller or more course-driven, but they still show how I like to explore tools, ideas, and implementations."
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
