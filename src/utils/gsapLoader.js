// Dynamic-imported and memoized so /explore-only visits never pay for GSAP,
// same reasoning as ChatPage's dynamic import of @mlc-ai/web-llm. Every
// consumer awaits this same singleton promise, so ScrollTrigger only ever
// gets registered once.
let gsapPromise = null

export function loadGsap() {
  if (!gsapPromise) {
    gsapPromise = Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(
      ([gsapModule, scrollTriggerModule]) => {
        const gsap = gsapModule.gsap ?? gsapModule.default
        const { ScrollTrigger } = scrollTriggerModule
        gsap.registerPlugin(ScrollTrigger)
        return { gsap, ScrollTrigger }
      }
    )
  }
  return gsapPromise
}
