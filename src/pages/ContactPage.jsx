import PageHero from '../components/PageHero'
import SectionCard from '../components/ui/SectionCard'
import { usePageMeta } from '../hooks/usePageMeta'
import profile from '../data/profile.json'

function formatLastUpdated() {
  return new Date(document.lastModified).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export default function ContactPage() {
  usePageMeta({
    title: 'Fredric Hegland | Contact',
    description: 'Contact Fredric Hegland and browse skills, tools, and ways to connect.',
  })

  return (
    <>
      <PageHero
        eyebrow="Toolkit and Contact"
        title="Skills, tools, and the best ways to reach me."
        description="This page keeps the practical part together: what I work with, where I can be reached, and the channels I keep active."
        actions={[
          { label: 'Skills', href: '#skills' },
          { label: 'Contact', href: '#contact', kind: 'secondary' },
          { label: 'Projects', to: '/projects', kind: 'secondary' },
        ]}
      />

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-28 text-left sm:px-6 sm:pb-24 lg:px-8">
        <SectionCard
          id="skills"
          eyebrow="Toolkit"
          title="A broad technical range, grouped by how I think about work."
          description="I like being useful across layers of a system. That usually means understanding the engineering core, the surrounding infrastructure, and the interface people actually touch."
        >
          <div className="grid gap-3 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
            {profile.skillGroups.map((group) => (
              <article key={group.title} className="flex min-w-0 flex-col rounded-[1.2rem] border border-white/10 bg-black/20 p-4 sm:rounded-[1.6rem] sm:p-6">
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/75">{group.title}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {group.items.map((item) => (
                    <span key={item} className="break-words rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100/88">
                      {item}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          id="contact"
          eyebrow="Open Channel"
          title="If you want to build something thoughtful and technically solid, I’m happy to talk."
          description="The easiest way to reach me is by email or LinkedIn. GitHub is where the side projects, experiments, and slightly nerdy detours keep growing."
        >
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_0.9fr]">
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
              <a
                href={`mailto:${profile.contact.email}`}
                className="flex min-w-0 flex-col rounded-[1.2rem] border border-white/10 bg-black/20 p-4 transition hover:-translate-y-1 hover:border-cyan-300/35 sm:min-h-[11rem] sm:rounded-[1.6rem] sm:p-6"
              >
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/70">Email</p>
                <p className="mt-4 break-words font-display text-lg font-semibold leading-tight text-white">{profile.contact.email}</p>
              </a>

              <a
                href={profile.contact.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 flex-col rounded-[1.2rem] border border-white/10 bg-black/20 p-4 transition hover:-translate-y-1 hover:border-cyan-300/35 sm:min-h-[11rem] sm:rounded-[1.6rem] sm:p-6"
              >
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/70">LinkedIn</p>
                <p className="mt-4 break-words font-display text-lg font-semibold leading-tight text-white">Connect professionally</p>
              </a>

              <a
                href={profile.contact.github}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 flex-col rounded-[1.2rem] border border-white/10 bg-black/20 p-4 transition hover:-translate-y-1 hover:border-cyan-300/35 sm:min-h-[11rem] sm:rounded-[1.6rem] sm:p-6"
              >
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/70">GitHub</p>
                <p className="mt-4 break-words font-display text-lg font-semibold leading-tight text-white">See the builds</p>
              </a>

              <a
                href={profile.contact.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 flex-col rounded-[1.2rem] border border-white/10 bg-black/20 p-4 transition hover:-translate-y-1 hover:border-cyan-300/35 sm:min-h-[11rem] sm:rounded-[1.6rem] sm:p-6"
              >
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/70">Website</p>
                <p className="mt-4 break-words font-display text-lg font-semibold leading-tight text-white">{profile.contact.website}</p>
              </a>
            </div>

            <div className="rounded-[1.2rem] border border-cyan-300/20 bg-gradient-to-br from-cyan-300/12 via-slate-950/80 to-slate-950 p-4 sm:rounded-[1.8rem] sm:p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/75">Navigation data</p>
              <div className="mt-5 space-y-4 text-sm leading-7 text-slate-200/84">
                <p>{profile.contact.location}</p>
                <p>{profile.contact.note}</p>
                <p>
                  © {new Date().getFullYear()} {profile.name}
                </p>
                <p>Last updated: {formatLastUpdated()}</p>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </>
  )
}
