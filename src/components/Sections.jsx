import selfPortrait from '../assets/Pictures/SelfPortrait.png'
import SectionCard from './ui/SectionCard'
import profile from '../data/profile.json'

export default function Sections() {
  return (
  <div id="board" className="relative w-11/12 md:w-4/5 mx-auto font-sans text-left px-3 sm:px-0 mt-10 md:mt-12">
      <div id="content">
        <img
          id="selfportrait"
          src={selfPortrait}
          alt="Self Portrait"
          loading="lazy"
          decoding="async"
          className="mx-auto rounded-full w-2/3 sm:w-1/2 md:w-1/3 shadow-lg"
        />

        <h1 id="title" className="text-center font-bold text-3xl md:text-4xl tracking-wide mt-7">I am Fredric Hegland!</h1>

        <SectionCard id="welcome" title="Welcome to my portfolio-website!">
          <p>Here you can find information about me, my projects and my contact information.</p>
        </SectionCard>

        <SectionCard id="about" title="About me">
          <p>{profile.about}</p>
          {profile.highlights?.length ? (
            <ul className="mt-4 list-disc list-inside space-y-1 text-sm opacity-90">
              {profile.highlights.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          ) : null}
        </SectionCard>

        <SectionCard id="experience" title="Experience">
          <h4 className="mb-2">I have had multiple part time jobs since I startet to study:</h4>
          {profile.experience.map((job, idx) => (
            <div key={idx} className="mb-3">
              <p>
                {job.company} - {job.title} ({job.period})
              </p>
              <p className="italic text-sm">
                {job.details}
                {job.link && (
                  <>
                    {' '}
                    <a
                      href={job.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-300 hover:text-cyan-200 underline-offset-4 hover:underline transition-colors"
                    >
                      {job.linkLabel || job.link}
                    </a>
                  </>
                )}
              </p>
            </div>
          ))}
        </SectionCard>

        <SectionCard id="education" title="Education">
          {profile.education.map((ed, idx) => (
            <p key={idx}>
              {ed.school} -{' '}
              {ed.link ? (
                <a
                  href={ed.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-300 hover:text-cyan-200 underline-offset-4 hover:underline transition-colors"
                >
                  {ed.program}
                </a>
              ) : (
                ed.program
              )}{' '}
              ({ed.period})
            </p>
          ))}
        </SectionCard>

        <SectionCard id="projects" title="Projects">
          <ul className="list-disc list-inside space-y-1">
            {profile.projects.map((p, idx) => (
              <li key={idx}>
                {p.name} – {p.description}
                {p.tech?.length ? (
                  <span className="block text-sm italic opacity-80">Tech: {p.tech.join(', ')}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard id="boardpositions" title="Board positions and volunteer work">
          {profile.boardPositions.map((b, idx) => (
            <div key={idx} className="mb-3">
              <p>{b.title} ({b.period})</p>
              <p className="italic text-sm">{b.details}</p>
            </div>
          ))}
        </SectionCard>

        <SectionCard id="courses" title="Courses and certificates">
          {profile.courses.map((c, idx) => (
            <div key={idx} className="mb-2">
              <p>
                {c.name} ({c.date})
              </p>
              {c.id && <p className="italic text-sm">ID: {c.id}</p>}
            </div>
          ))}
        </SectionCard>

        <SectionCard id="skills" title="Skills">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            {profile.skills.map((s, idx) => (
              <div key={idx} className="opacity-90">{s}</div>
            ))}
          </div>
        </SectionCard>

        {profile.languages?.length ? (
          <SectionCard id="languages" title="Languages">
            <ul className="list-disc list-inside space-y-1">
              {profile.languages.map((l, idx) => (
                <li key={idx} className="opacity-90">
                  {l.name} – <span className="italic text-sm">{l.level}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        ) : null}

        <SectionCard id="contact" title="Contact">
          <h4>Feel free to contact me on any of these platforms:</h4>
          <p>
            <a href={profile.contact.linkedin} target="_blank" rel="noopener noreferrer" className="text-cyan-300 hover:text-cyan-200 underline-offset-4 hover:underline transition-colors">
              LinkedIn
            </a>
          </p>
          <p>
            <a href={profile.contact.github} target="_blank" rel="noopener noreferrer" className="text-cyan-300 hover:text-cyan-200 underline-offset-4 hover:underline transition-colors">
              GitHub
            </a>
          </p>
          <p>
            Email: <a href={`mailto:${profile.contact.email}`} className="text-cyan-300 hover:text-cyan-200 underline-offset-4 hover:underline transition-colors">{profile.contact.email}</a>
          </p>
          <p>
            Phone: <a href="tel:+4745667372" className="text-cyan-300 hover:text-cyan-200 underline-offset-4 hover:underline transition-colors">{profile.contact.phone}</a>
          </p>
        </SectionCard>

        <SectionCard id="footer">
          <footer>
            <p>© 2025 Fredric Hegland</p>
          </footer>
        </SectionCard>
      </div>
    </div>
  )
}
