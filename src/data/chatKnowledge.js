import profile from './profile.en.json'

// A hand-trimmed view of profile.json, small enough (with the wrapper text
// below) to sit alongside the whole conversation inside the ~4k-token context
// window both the desktop and mobile models run with. No retrieval step: the
// entire "knowledge base" is just always in context as a system message.
// Kept to Fredric only (no solar-system trivia) to leave more of that budget
// free for actual conversation.
function buildProfileSummary() {
  const currentJob = profile.experience.find((job) => job.period.includes('Present')) || profile.experience[0]
  const currentEducation = profile.education[0]
  const lines = [
    `${profile.name}, ${profile.location}.`,
    `Currently: ${profile.currently.join('; ')}.`,
    `Interests: ${profile.interests.join('; ')}.`,
    `Role: ${currentJob.title} at ${currentJob.company} (${currentJob.period}).`,
    `Studying: ${currentEducation.program}, ${currentEducation.school} (${currentEducation.period}).`,
    `Projects: ${profile.projects.map((project) => project.name).join(', ')}.`,
    `Skills: ${profile.skills.join(', ')}.`,
    `Contact: email ${profile.contact.email}, LinkedIn ${profile.contact.linkedin}, GitHub ${profile.contact.github}, site ${profile.contact.website}.`,
  ]
  return lines.join('\n')
}

export const chatSystemPrompt = `You are the small local assistant embedded on Fredric Hegland's portfolio site. You run entirely in the visitor's browser via WebGPU.

Answer using the knowledge below. If something isn't covered here, say you don't know rather than guessing, and suggest the visitor check the site's Projects, Journey, or Contact pages, or email Fredric directly. Keep answers short and conversational.

--- About Fredric ---
${buildProfileSummary()}
--- end knowledge base ---`
