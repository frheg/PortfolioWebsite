import Intro from '../components/Intro'
import SectionCard from '../components/ui/SectionCard'
import Reveal from '../components/ui/Reveal'
import profile from '../data/profile.json'

export default function HomePage() {
  return (
    <>
      <Intro />

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-28 text-left sm:px-6 sm:pb-24 lg:px-8">
        <SectionCard
          id="about"
          eyebrow="About"
          title="What I do."
        >
          <div className="space-y-4 sm:space-y-6">
            <p className="text-base leading-7 text-slate-100/88 sm:text-lg sm:leading-8">{profile.about}</p>

            <div className="grid gap-3 sm:gap-4 sm:grid-cols-3">
              <Reveal variant="left" className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4 sm:rounded-[1.6rem] sm:p-6">
                <p className="text-xs uppercase tracking-[0.3em] text-teal-300/80">Currently</p>
                <ul className="mt-4 space-y-2.5 text-sm leading-6 text-slate-200/84">
                  {profile.currently.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </Reveal>

              <Reveal variant="scale" delay={0.08} className="rounded-[1.2rem] border border-pink-300/20 bg-pink-300/10 p-4 sm:rounded-[1.6rem] sm:p-6">
                <p className="text-xs uppercase tracking-[0.3em] text-pink-300/90">Interests</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {profile.interests.map((item) => (
                    <span key={item} className="rounded-full border border-pink-300/10 bg-black/20 px-3 py-1.5 text-sm text-slate-100/88">
                      {item}
                    </span>
                  ))}
                </div>
              </Reveal>

              <Reveal variant="right" delay={0.16} className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4 sm:rounded-[1.6rem] sm:p-6">
                <p className="text-xs uppercase tracking-[0.3em] text-yellow-300/80">Highlights</p>
                <ul className="mt-4 space-y-2.5 text-sm leading-6 text-slate-200/84">
                  {profile.highlights.map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-300" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
          </div>
        </SectionCard>
      </div>
    </>
  )
}
