import SectionCard from '../components/ui/SectionCard'
import Reveal from '../components/ui/Reveal'
import { pickRevealVariant } from '../hooks/useScrollReveal'
import profile from '../data/profile.json'

function formatLastUpdated() {
  return new Date(document.lastModified).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

const SKILL_GROUP_COLORS = ['text-teal-300/80', 'text-sky-300/80', 'text-pink-300/80']

export default function ContactPage() {
  return (
    <>
      <div className="relative mx-auto w-full max-w-6xl px-4 pb-28 text-left sm:px-6 sm:pb-24 lg:px-8">
        <SectionCard
          id="skills"
          eyebrow="Toolkit"
          title="What I work with, grouped by area."
        >
          <div className="grid gap-3 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
            {profile.skillGroups.map((group, index) => (
              <Reveal
                key={group.title}
                as="article"
                variant={pickRevealVariant(index)}
                delay={Math.min(index * 0.06, 0.3)}
                className="flex min-w-0 flex-col rounded-[1.2rem] border border-white/10 bg-black/20 p-4 sm:rounded-[1.6rem] sm:p-6"
              >
                <p className={`text-xs uppercase tracking-[0.3em] ${SKILL_GROUP_COLORS[index % SKILL_GROUP_COLORS.length]}`}>{group.title}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {group.items.map((item) => (
                    <span key={item} className="break-words rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100/88">
                      {item}
                    </span>
                  ))}
                </div>
              </Reveal>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          id="contact"
          eyebrow="Get in Touch"
          title="Feel free to reach out."
          description="The easiest way to reach me is by email or LinkedIn. GitHub is where the side projects and experiments live."
        >
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_0.9fr]">
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
              <Reveal
                as="a"
                href={`mailto:${profile.contact.email}`}
                variant="left"
                className="flex min-w-0 flex-col rounded-[1.2rem] border border-white/10 bg-black/20 p-4 transition hover:-translate-y-1 hover:border-teal-300/35 sm:min-h-[11rem] sm:rounded-[1.6rem] sm:p-6"
              >
                <p className="text-xs uppercase tracking-[0.3em] text-teal-300/80">Email</p>
                <p className="mt-4 break-words font-display text-lg font-semibold leading-tight text-white">{profile.contact.email}</p>
              </Reveal>

              <Reveal
                as="a"
                href={profile.contact.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                variant="right"
                delay={0.06}
                className="flex min-w-0 flex-col rounded-[1.2rem] border border-white/10 bg-black/20 p-4 transition hover:-translate-y-1 hover:border-sky-300/35 sm:min-h-[11rem] sm:rounded-[1.6rem] sm:p-6"
              >
                <p className="text-xs uppercase tracking-[0.3em] text-sky-300/80">LinkedIn</p>
                <p className="mt-4 break-words font-display text-lg font-semibold leading-tight text-white">Connect professionally</p>
              </Reveal>

              <Reveal
                as="a"
                href={profile.contact.github}
                target="_blank"
                rel="noopener noreferrer"
                variant="left"
                delay={0.12}
                className="flex min-w-0 flex-col rounded-[1.2rem] border border-white/10 bg-black/20 p-4 transition hover:-translate-y-1 hover:border-pink-300/35 sm:min-h-[11rem] sm:rounded-[1.6rem] sm:p-6"
              >
                <p className="text-xs uppercase tracking-[0.3em] text-pink-300/80">GitHub</p>
                <p className="mt-4 break-words font-display text-lg font-semibold leading-tight text-white">See the builds</p>
              </Reveal>

              <Reveal
                as="a"
                href={profile.contact.website}
                target="_blank"
                rel="noopener noreferrer"
                variant="right"
                delay={0.18}
                className="flex min-w-0 flex-col rounded-[1.2rem] border border-white/10 bg-black/20 p-4 transition hover:-translate-y-1 hover:border-yellow-300/35 sm:min-h-[11rem] sm:rounded-[1.6rem] sm:p-6"
              >
                <p className="text-xs uppercase tracking-[0.3em] text-yellow-300/80">Website</p>
                <p className="mt-4 break-words font-display text-lg font-semibold leading-tight text-white">{profile.contact.website}</p>
              </Reveal>
            </div>

            <Reveal
              variant="scale"
              delay={0.1}
              className="rounded-[1.2rem] border border-green-300/20 bg-gradient-to-br from-green-300/12 via-slate-950/80 to-slate-950 p-4 sm:rounded-[1.8rem] sm:p-6"
            >
              <p className="text-xs uppercase tracking-[0.3em] text-green-300/80">Details</p>
              <div className="mt-5 space-y-4 text-sm leading-7 text-slate-200/84">
                <p>{profile.contact.location}</p>
                <p>{profile.contact.note}</p>
                <p>
                  © {new Date().getFullYear()} {profile.name}
                </p>
                <p>Last updated: {formatLastUpdated()}</p>
              </div>
            </Reveal>
          </div>
        </SectionCard>
      </div>
    </>
  )
}
