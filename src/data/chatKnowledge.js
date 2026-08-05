import profile from './profile.json'
import { planetFacts } from './planetFacts'

// A hand-trimmed view of profile.json + planetFacts.js, small enough (with
// the wrapper text below) to sit alongside the whole conversation inside the
// ~4k-token context window this model runs with. No retrieval step: the
// entire "knowledge base" is just always in context as a system message.
function buildProfileSummary() {
  const lines = [
    `${profile.name}, ${profile.location}.`,
    profile.hero.description,
    `Currently: ${profile.currently.join('; ')}.`,
    `Interests: ${profile.interests.join('; ')}.`,
    `Experience: ${profile.experience
      .map((job) => `${job.title} at ${job.company} (${job.period})`)
      .join('; ')}.`,
    `Education: ${profile.education
      .map((ed) => `${ed.program}, ${ed.school} (${ed.period})`)
      .join('; ')}.`,
    `Projects: ${profile.projects
      .map((project) => `${project.name}: ${project.highlight || project.description}`)
      .join(' | ')}.`,
    `Skills: ${profile.skills.join(', ')}.`,
    `Leadership: ${profile.boardPositions.map((position) => position.title).join('; ')}.`,
    `Languages: ${profile.languages.map((lang) => `${lang.name} (${lang.level})`).join(', ')}.`,
    `Contact: email ${profile.contact.email}, LinkedIn ${profile.contact.linkedin}, GitHub ${profile.contact.github}, site ${profile.contact.website}.`,
  ]
  return lines.join('\n')
}

function buildPlanetSummary() {
  return planetFacts
    .map((body) => `${body.name}: ${body.facts.slice(0, 2).join('; ')}`)
    .join('\n')
}

export const chatSystemPrompt = `You are the small local assistant embedded on Fredric Hegland's portfolio site. You run entirely in the visitor's browser via WebGPU.

Answer using the knowledge below. If something isn't covered here, say you don't know rather than guessing, and suggest the visitor check the site's Projects, Journey, or Contact pages, or email Fredric directly. Keep answers short and conversational.

--- About Fredric ---
${buildProfileSummary()}

--- Solar system trivia (from the site's 3D background) ---
${buildPlanetSummary()}
--- end knowledge base ---`
